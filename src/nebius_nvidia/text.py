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
        if ch in ",.;:)!?" and out and out[-1] == " ":
            # "condition , such" == "condition, such": a stray space before punctuation
            # (common in CMS text) doesn't change meaning.
            out.pop()
            idx.pop()
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


_ABBREVIATIONS = {"e.g", "i.e", "etc", "vs", "dr", "mr", "mrs", "ms", "no", "fig", "approx", "u.s"}


def segment(text: str) -> list[tuple[int, int]]:
    """Split text into sentence-level units, as (start, end) offsets into `text`.

    Paragraphs split on blank lines; a bullet ("• ...") is one unit; other
    paragraphs split into sentences, skipping abbreviations like "e.g.".
    Every unit is text[start:end] with surrounding whitespace excluded.
    """
    units: list[tuple[int, int]] = []
    for para in re.finditer(r"\S(?:.*?\S)?(?=\n\s*\n|\s*\Z)", text, flags=re.S):
        p_start, p_text = para.start(), para.group()
        if p_text.startswith("•"):
            units.append((p_start, para.end()))
            continue
        cursor = 0
        for m in re.finditer(r'[.!?]["”)]?\s+(?=["“(]?[A-Z0-9])', p_text):
            word = re.search(r"([A-Za-z.]+)[.!?]$", p_text[cursor : m.start() + 1])
            if word and word.group(1).lower().rstrip(".") in _ABBREVIATIONS:
                continue
            end = m.end() - len(m.group()) + len(m.group().rstrip())
            units.append((p_start + cursor, p_start + end))
            cursor = m.end()
        if cursor < len(p_text):
            units.append((p_start + cursor, p_start + len(p_text)))
    return units
