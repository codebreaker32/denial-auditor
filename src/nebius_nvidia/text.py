"""Text utilities shared by the policy client, span verification and the citation gate.

normalize() is deliberately narrow: it only forgives differences that don't
change meaning (invisible characters, curly vs straight quotes, whitespace).
It is case-sensitive and never touches digits, dashes or ellipses, so "four"
vs "two" or "6-week" vs "6 week" still fail the gate.
"""

import html
import re

_INVISIBLE = {"­", "​", "‌", "‍", "﻿"}
_QUOTE_MAP = {
    "‘": "'", "’": "'", "‚": "'", "‛": "'", "′": "'",
    "“": '"', "”": '"', "„": '"', "‟": '"', "″": '"',
}


def html_to_text(raw: str | None) -> str:
    """CMS Coverage API fields are HTML that is itself HTML-escaped; return plain text."""
    s = html.unescape(html.unescape(raw or ""))
    # Comments, including CMS's mangled "<!&mdash;StartFragment&mdash;>" variant.
    s = re.sub(r"<!--.*?-->|<!&mdash;.*?&mdash;>|<!—.*?—>", "", s, flags=re.S)
    s = re.sub(r"<(br|/p|/ul|/ol|/h\d|/tr|/div)\s*/?>", "\n", s, flags=re.I)
    s = re.sub(r"<li[^>]*>", "\n• ", s, flags=re.I)
    s = re.sub(r"<[^>]+>", "", s)
    s = html.unescape(s).replace("\xa0", " ")
    s = re.sub(r"[ \t]+", " ", s)
    s = re.sub(r" *\n *", "\n", s)
    s = re.sub(r"\n{3,}", "\n\n", s)
    return s.strip()


def _normalize_with_map(s: str) -> tuple[str, list[int]]:
    """Normalized string plus, for each output char, its index in the input."""
    out: list[str] = []
    idx: list[int] = []
    for i, ch in enumerate(s):
        if ch in _INVISIBLE:
            continue
        ch = _QUOTE_MAP.get(ch, ch)
        if ch.isspace():
            if not out or out[-1] == " ":
                continue
            ch = " "
        out.append(ch)
        idx.append(i)
    if out and out[-1] == " ":
        out.pop()
        idx.pop()
    return "".join(out), idx


def normalize(s: str) -> str:
    return _normalize_with_map(s)[0]


def locate(span: str, text: str) -> tuple[int, int] | None:
    """Find span in text after normalization; return (start, end) offsets into the ORIGINAL text.

    text[start:end] is the source passage the span matched. Returns None if the
    span is empty or not present.
    """
    needle = normalize(span)
    if not needle:
        return None
    hay, idx = _normalize_with_map(text)
    pos = hay.find(needle)
    if pos < 0:
        return None
    return idx[pos], idx[pos + len(needle) - 1] + 1
