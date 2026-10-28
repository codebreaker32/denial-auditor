#!/usr/bin/env python3
"""Build submission/Denial_Auditor_Testing_Instructions.pdf for the judges.

Page 1 is the idea; page 2 is the testing instructions from docs/devpost.md, with the
live-run passcode filled in from DEMO_PASSCODE in .env. The passcode is never printed,
the intermediate HTML is deleted, and submission/ is gitignored, so the PDF is the only
file that holds it.

Usage: ./.venv/bin/python scripts/build_judges_pdf.py
"""

import html
import os
import re
import tempfile
from pathlib import Path

from dotenv import dotenv_values
from playwright.sync_api import sync_playwright

OUT = Path("submission/Denial_Auditor_Testing_Instructions.pdf")
PLACEHOLDER = "[DEMO PASSCODE — paste into the Devpost field only, never into this file]"
URL = "https://denial-auditor-898760356208.us-central1.run.app"

IDEA = """
<h2>The idea</h2>
<p class=lead>Payers check an MRI order criterion by criterion. Denial Auditor lets a three-doctor practice do the same.</p>
<h3>The problem</h3>
<p>Billers at small medical practices face a steady stream of health-insurance denials. Winning an appeal means finding the payer's policy as it stood on the date of service, checking every requirement against the chart, and quoting both exactly. Most practices never try: in Medicare Advantage in 2024, <b>80.7%</b> of appealed prior-authorization denials were overturned, yet only <b>11.5%</b> were appealed (KFF, January 2026).</p>
<h3>What Denial Auditor does</h3>
<ul>
<li><b>Triage:</b> sorts each denial by whether it can be won: an administrative fix, a plan exclusion, or a clinical question.</li>
<li><b>The right policy:</b> fetches the payer's coverage policy in effect on the date of service (Medicare LCD versions from the CMS Coverage API; Aetna's bulletin located at runtime with Tavily).</li>
<li><b>Rule by rule:</b> splits the policy into rules cut word for word from the source and checks each against the chart, with verified quotes.</li>
<li><b>A clear answer:</b> a fixed rule, not a model, decides: appeal, ask the physician, don't appeal yet, fix and resubmit, or not winnable. Missing evidence becomes a ready-to-send request to the physician.</li>
<li><b>A letter that can't lie:</b> the drafted appeal can't be exported unless every quote matches the fetched policy or chart exactly. A person always reviews and sends it.</li>
<li><b>Before you submit:</b> the same checks run on a prior-auth request and work out the earliest date the chart can qualify.</li>
</ul>
<h3>How it's built</h3>
<p>Every model call goes to <b>NVIDIA Nemotron on Nebius Token Factory</b>: Nemotron 3.5 Super-VL reads the faxed letter, Nemotron 3 Nano extracts chart facts, Nemotron 3 Super picks the policy sentences and casts two votes per rule, and Nemotron 3 Ultra referees split votes and drafts the appeal. Models only return text; code verifies every quote, computes dates and deadlines (from a fixed table of federal rules), and applies the recommendation rule.</p>
<h3>Proof, honestly stated</h3>
<p>On 30 synthetic cases we wrote ourselves: <b>30/30</b> recommendations and <b>138/138</b> rule statuses right, at about <b>$0.05</b> and 72 seconds per case. That shows the pipeline works as designed; it is not accuracy on real charts.</p>
<div class=brk></div>
<h2>Testing instructions</h2>
"""

CSS = """
@page{size:A4;margin:17mm 17mm} body{font-family:Geist;color:#0e0f0c;font-size:10.5pt;line-height:1.5;width:176mm}
.hd{display:flex;align-items:center;gap:10px;font-weight:600;font-size:15pt;letter-spacing:-.02em;margin-bottom:5mm}
h1{font-size:22pt;font-weight:500;letter-spacing:-.03em;margin:0 0 1mm} .sub{color:#4c4e47;margin:0 0 6mm}
h2{font-size:15pt;font-weight:600;letter-spacing:-.02em;margin:6mm 0 2mm} h3{font-size:11.5pt;font-weight:600;margin:4.5mm 0 1mm}
.lead{font-size:13pt;letter-spacing:-.01em;margin:0 0 2mm}
ol,ul{margin:0;padding-left:5.5mm} li{margin:1mm 0} p{margin:1.2mm 0}
a{color:#1e4bd7;text-decoration:none} code{font-size:9.5pt;background:#efefed;padding:0 3px;border-radius:3px}
.pc{font-family:ui-monospace,Menlo,monospace;font-size:11pt;background:#fff6dd;border:1px solid #e9cf86;border-radius:4px;padding:1px 6px;white-space:nowrap}
.brk{break-after:page}
.note{margin-top:7mm;padding:3mm 4mm;background:#efefed;border-radius:3mm;font-size:9pt;color:#4c4e47}
"""

MARK = ('<svg width=26 height=26 viewBox="0 0 24 24"><rect width=24 height=24 rx=7 fill="#0e0f0c"/>'
        '<path transform="rotate(180 7.9 12) translate(0 -.4)" d="M10.2 9.6a2.35 2.35 0 1 0-2.6 2.34c-.2 1.24-.94 2.2-2.1 2.86l.62.98c2.36-1.12 3.98-3.3 4.08-6.18Z" fill="#f3f3f1"/>'
        '<path d="M11.6 13.2l2.5 2.6 5.1-6.4" fill=none stroke="#1e4bd7" stroke-width=2.3 stroke-linecap=round stroke-linejoin=round /></svg>')


def inline(t: str) -> str:
    t = html.escape(t)
    t = re.sub(r"\*\*(.+?)\*\*", r"<b>\1</b>", t)
    t = re.sub(r"`(.+?)`", r"<code>\1</code>", t)
    return re.sub(r"(https://\S+?)(\.?)(\s|$)", r'<a href="\1">\1</a>\2\3', t)


def testing_html() -> str:
    md = Path("docs/devpost.md").read_text()
    sec = md[md.index("## Testing instructions for judges"):]
    sec = sec[: sec.index("\n---")].strip()
    out, inlist = [], False
    for line in sec.splitlines()[1:]:
        if re.match(r"^\d+\. ", line):
            if not inlist:
                out.append("<ol>")
                inlist = True
            out.append("<li>" + inline(re.sub(r"^\d+\. ", "", line)) + "</li>")
            continue
        if inlist:
            out.append("</ol>")
            inlist = False
        if line.startswith("**") and line.rstrip().endswith("**"):
            out.append("<h3>" + inline(line.strip("*")) + "</h3>")
        elif line.strip():
            out.append("<p>" + inline(line) + "</p>")
    if inlist:
        out.append("</ol>")
    body = "\n".join(out)
    assert "<b>" + html.escape(PLACEHOLDER) + "</b>" in body, "passcode placeholder missing from docs/devpost.md"
    return body


def page(passcode: str) -> str:
    font = Path("ui/public/fonts/geist-var.woff2").resolve().as_uri()
    t = testing_html().replace("<b>" + html.escape(PLACEHOLDER) + "</b>", '<span class="pc">' + html.escape(passcode) + "</span>")
    return (f'<!doctype html><meta charset=utf-8><style>@font-face{{font-family:Geist;src:url({font});font-weight:100 900}}{CSS}</style>'
            f'<div class=hd>{MARK}Denial Auditor</div><h1>For the judges</h1>'
            f'<p class=sub>Nebius x NVIDIA Global AI Hackathon · Best Apps &amp; Agents · Team Road House · <a href="{URL}">{URL[8:]}</a></p>'
            f'{IDEA}{t}<div class=note>For judges only: the live-run passcode above is shared for evaluation and is not published anywhere else. '
            'All patients and claims in the demo are synthetic. Decision support, not legal or medical advice; a person reviews and sends every appeal. '
            'CPT © American Medical Association. All rights reserved.</div>')


def main() -> None:
    passcode = dotenv_values(".env").get("DEMO_PASSCODE") or ""
    if not passcode:
        raise SystemExit("DEMO_PASSCODE is not set in .env")
    OUT.parent.mkdir(exist_ok=True)
    tmp = tempfile.NamedTemporaryFile("w", suffix=".html", delete=False, dir=OUT.parent)
    tmp.write(page(passcode))
    tmp.close()
    try:
        with sync_playwright() as p:
            b = p.chromium.launch()
            pg = b.new_page()
            pg.goto(Path(tmp.name).resolve().as_uri())
            pg.wait_for_timeout(500)
            pg.pdf(path=str(OUT), format="A4", print_background=True)
            b.close()
    finally:
        os.unlink(tmp.name)
    print(f"wrote {OUT} ({OUT.stat().st_size // 1024} KB)")


if __name__ == "__main__":
    main()
