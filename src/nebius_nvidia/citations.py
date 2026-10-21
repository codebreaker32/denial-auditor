"""Citation gate: an appeal can be exported only if every quote in it is real.

A quote passes only if, after text.normalize(), it is a substring of a source
fetched in THIS session (policy documents) or of the case's chart notes.
Normalization forgives only meaning-free differences (curly quotes, whitespace,
invisible characters, a stray space before punctuation); words, digits, case
and dashes must match exactly. Elided quotes ("..." / "…") are not allowed.

Quote syntax recognised in rendered letters:
  - block quotes: consecutive lines starting with "> " form one quote; a line
    starting "> —" is the citation line and is not part of the quote;
  - inline quotes: text in "double" or “curly” quotes of 3+ words, outside blocks.
"""

import re

from nebius_nvidia.models import GateResult, QuoteCheck
from nebius_nvidia.text import normalize

ELLIPSIS = re.compile(r"\.\.\.|…")
INLINE = re.compile(r'"([^"\n]+)"|“([^”\n]+)”')


class Session:
    """The sources a gate check may match against: fetched documents and chart notes."""

    def __init__(self) -> None:
        self.sources: dict[str, str] = {}

    def add(self, source_id: str, text: str) -> None:
        self.sources[source_id] = text

    def find(self, quote: str) -> str | None:
        needle = normalize(quote)
        if not needle:
            return None
        for sid, text in self.sources.items():
            if needle in normalize(text):
                return sid
        return None


def extract_quotes(rendered: str) -> list[str]:
    quotes: list[str] = []
    block: list[str] = []
    prose: list[str] = []

    def flush():
        if block:
            quotes.append("\n".join(block))
            block.clear()

    for line in rendered.splitlines():
        if line.startswith(">"):
            body = line[1:].lstrip()
            if body.startswith(("—", "--", "-- ")):
                flush()  # citation line ends the quote
            elif body:
                block.append(body)
        else:
            flush()
            prose.append(line)
    flush()

    for m in INLINE.finditer("\n".join(prose)):
        q = m.group(1) or m.group(2)
        if len(q.split()) >= 3:
            quotes.append(q)
    return quotes


def check(rendered: str, session: Session) -> GateResult:
    quotes = extract_quotes(rendered)
    if not quotes:
        return GateResult(ok=False, checks=[], reason="The letter quotes no policy text, so nothing can be verified.")
    checks = []
    for q in quotes:
        if ELLIPSIS.search(q):
            checks.append(QuoteCheck(text=q, status="not_found", source_id=None))
            continue
        sid = session.find(q)
        checks.append(QuoteCheck(text=q, status="verified" if sid else "not_found", source_id=sid))
    bad = sum(c.status != "verified" for c in checks)
    return GateResult(
        ok=bad == 0,
        checks=checks,
        reason="" if bad == 0 else f"{bad} of {len(checks)} quotes do not match a fetched source exactly.",
    )
