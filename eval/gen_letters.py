#!/usr/bin/env python3
"""Write a synthetic denial letter for each scenario: letter.txt and a "faxed" letter.png.

Templated, no LLM. The image is greyscale, slightly rotated, speckled and
watermarked SYNTHETIC so the vision model gets a realistic scan to read.
CPT is printed as a bare code with our own plain label (no AMA descriptor).

Usage: ./.venv/bin/python eval/gen_letters.py [--cases cases]
"""

import argparse
import hashlib
import random
import textwrap
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont

from nebius_nvidia.scenario import SYNTHETIC_BANNER, Scenario

FONT_DIRS = ["/usr/share/fonts/truetype/dejavu", "/usr/share/fonts/dejavu"]
APPEAL_WINDOW = {
    "MA": "You may request a reconsideration within 60 calendar days of receiving this notice.",
    "MEDICARE_FFS": "You may request a redetermination within 120 days of receiving this notice.",
}
COMMERCIAL_WINDOW = "You may file an internal appeal within 180 days of receiving this notice."


def font(name: str, size: int):
    for d in FONT_DIRS:
        p = Path(d) / name
        if p.exists():
            return ImageFont.truetype(str(p), size)
    return ImageFont.load_default()


def letter_text(s: Scenario) -> str:
    member_id = f"SYN-{int(hashlib.sha256(s.case_id.encode()).hexdigest(), 16) % 10**7:07d}"
    window = APPEAL_WINDOW.get(s.plan_type, COMMERCIAL_WINDOW)
    codes = ", ".join(s.carc) if s.carc else "n/a"
    return "\n".join([
        SYNTHETIC_BANNER,
        "FICTIONAL TEST NOTICE - not issued by any insurer",
        "",
        f"Payer: {s.payer}",
        "",
        f"Date of notice: {s.notice_date:%m/%d/%Y}",
        "",
        "NOTICE OF DENIAL OF PAYMENT",
        "",
        f"Member: {s.patient_name}",
        f"Member ID: {member_id}",
        "Provider: Example Spine & Joint Clinic (synthetic)",
        "Service: Lumbar spine MRI",
        f"CPT: {s.cpt}",
        f"Diagnosis: {', '.join(s.icd10)}",
        f"Date of service: {s.dos:%m/%d/%Y}",
        *([f"Billed amount: ${s.billed_usd:,.2f}", "Amount paid: $0.00"] if s.billed_usd else []),
        "",
        "Decision: DENIED",
        f"Reason code(s): {codes}",
        f"Reason: {s.reason_text}",
        "",
        "If you disagree with this decision, you have the right to appeal. " + window,
        "Send your request with any supporting medical records to the address on this notice.",
        "",
        "This notice was generated for software testing and refers to no real person.",
    ])


def render(text: str, seed: int) -> Image.Image:
    rng = random.Random(seed)
    w, h = 1700, 2200  # ~200 dpi letter page
    img = Image.new("L", (w, h), 255)
    d = ImageDraw.Draw(img)
    body, bold = font("DejaVuSans.ttf", 30), font("DejaVuSans-Bold.ttf", 34)
    y = 140
    for line in text.splitlines():
        f = bold if line in ("NOTICE OF DENIAL OF PAYMENT", SYNTHETIC_BANNER) else body
        for chunk in textwrap.wrap(line, 88) or [""]:
            d.text((140, y), chunk, fill=rng.randint(20, 60), font=f)
            y += 44
    # Watermark.
    wm = Image.new("L", (w, h), 0)
    ImageDraw.Draw(wm).text((260, 1150), "SYNTHETIC", fill=70, font=font("DejaVuSans-Bold.ttf", 230))
    img = Image.composite(Image.new("L", (w, h), 200), img, wm.rotate(30, fillcolor=0))
    # Fax look: slight skew, speckle, blur.
    img = img.rotate(rng.uniform(-0.9, 0.9), fillcolor=255, resample=Image.BICUBIC)
    px = img.load()
    for _ in range(9000):
        x, yy = rng.randrange(w), rng.randrange(h)
        px[x, yy] = rng.choice((0, 90, 160))
    return img.filter(ImageFilter.GaussianBlur(0.6))


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--cases", default="cases")
    args = ap.parse_args()
    n = 0
    for case_dir in sorted(Path(args.cases).iterdir()):
        if not (case_dir / "scenario.json").exists():
            continue
        s = Scenario.load(case_dir)
        text = letter_text(s)
        (case_dir / "letter.txt").write_text(text)
        render(text, seed=int(s.case_id.split("_")[1])).save(case_dir / "letter.png", optimize=True)
        n += 1
    print(f"wrote {n} letters (letter.txt + letter.png)")


if __name__ == "__main__":
    main()
