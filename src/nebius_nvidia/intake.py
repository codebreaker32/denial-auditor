"""Read a denial letter into a structured Denial.

- An image or scanned PDF is read by Nemotron 3.5 Super-VL.
- Plain text (or a PDF with a text layer) is read by Nemotron 3 Nano with
  reasoning off, which is ~10x faster and cheaper for simple extraction.

CPT is kept as a bare 5-digit code. The letter's own wording of the reason is
kept verbatim in reason_text.
"""

import base64
import io
from datetime import date
from pathlib import Path

from pydantic import BaseModel, Field

from nebius_nvidia.llm import NANO, SUPER_VL, structured
from nebius_nvidia.models import Denial, PlanType

SYSTEM = """You read health-insurance denial notices for a medical billing team and extract the fields exactly as printed.

- Dates as YYYY-MM-DD.
- cpt: the 5-digit procedure code only, no description.
- icd10: diagnosis codes as printed.
- carc: the reason/adjustment code numbers as printed (strings), or [] if none.
- reason_text: the denial reason sentence copied as printed.
- plan_type: MA if the payer is a Medicare Advantage plan; MEDICARE_FFS if it is traditional Medicare (a MAC);
  COMMERCIAL_ACA or COMMERCIAL_ERISA for commercial or employer plans (use COMMERCIAL_ERISA for employer health plans,
  COMMERCIAL_ACA otherwise); MEDICAID; UNKNOWN if you cannot tell."""


class DenialDraft(BaseModel):
    payer_name: str
    plan_type: PlanType
    cpt: str = Field(pattern=r"^\d{5}$")
    icd10: list[str]
    dos: date
    notice_date: date
    carc: list[str] = Field(default_factory=list)
    reason_text: str


def _png_data_url(path: Path, max_width: int = 1275) -> str:
    """Downscale to ~150 dpi to keep the request small; return a data: URL."""
    from PIL import Image

    img = Image.open(path).convert("L")
    if img.width > max_width:
        img = img.resize((max_width, round(img.height * max_width / img.width)))
    buf = io.BytesIO()
    img.save(buf, format="PNG", optimize=True)
    return "data:image/png;base64," + base64.b64encode(buf.getvalue()).decode()


def read_denial(path: Path, tracker=None, practice_state: str | None = None) -> Denial:
    path = Path(path)
    if path.suffix.lower() in {".png", ".jpg", ".jpeg"}:
        model = SUPER_VL
        content = [
            {"type": "text", "text": "Extract the fields from this denial notice."},
            {"type": "image_url", "image_url": {"url": _png_data_url(path)}},
        ]
        thinking = None
    else:
        model = NANO
        content = f"<notice>\n{path.read_text()}\n</notice>"
        thinking = False
    draft = structured(
        model,
        [{"role": "system", "content": SYSTEM}, {"role": "user", "content": content}],
        DenialDraft,
        max_tokens=4096,
        step="intake",
        tracker=tracker,
        thinking=thinking,
    )
    return Denial(**draft.model_dump(), practice_state=practice_state, extracted_by=model)
