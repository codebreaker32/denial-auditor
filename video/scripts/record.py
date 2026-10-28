"""Capture the app clips the demo video is built around.

Usage (records the deployed app; costs nothing, precomputed showcase runs only; never submits the live-run form):
    /home/aman/projects/nebius-nvidia/.venv/bin/python video/scripts/record.py [--base URL] [clip ...]
    /home/aman/projects/nebius-nvidia/.venv/bin/python video/scripts/record.py --manifest   # rewrite src/cut/recs.json only

Logs in once through the one-click demo at #/login, then records each clip in its own 1920x1080 browser context
(playwright record_video), trims the page-load lead, and re-encodes to public/rec/<clip>.mp4 at 30fps H.264 with
the ffmpeg bundled in @remotion/compositor (it has no fps filter, so -fps_mode cfr -r 30).

Each clip's beats are timed to the narration in video/timing.json; the camera moves and callouts in
src/scenes/*.tsx are keyframed against these beats (see BEATS in src/recordings.ts).
"""
from __future__ import annotations

import shutil
import subprocess
import sys
import tempfile
import time
from pathlib import Path

from playwright.sync_api import Page, sync_playwright

import os
import urllib.request

# The deployed app (Cloud Run). Override with --base URL or RECORD_BASE; never submit the live-run form.
DEFAULT_BASE = "https://denial-auditor-898760356208.us-central1.run.app"
BASE = os.environ.get("RECORD_BASE", DEFAULT_BASE).rstrip("/")
VIDEO = Path(__file__).resolve().parents[1]
OUT = VIDEO / "public" / "rec"
FFMPEG = VIDEO / "node_modules/@remotion/compositor-linux-x64-gnu/ffmpeg"
SIZE = {"width": 1920, "height": 1080}

# A visible pointer: recorded video has no cursor, so draw one that follows the mouse and pulses on click.
CURSOR = """
(() => {
  const mk = () => {
    if (document.getElementById('__cur')) return;
    const c = document.createElement('div'); c.id = '__cur';
    Object.assign(c.style, {position:'fixed', left:'0', top:'0', width:'22px', height:'22px', marginLeft:'-11px',
      marginTop:'-11px', borderRadius:'50%', background:'rgba(14,15,12,.18)', border:'2px solid rgba(14,15,12,.75)',
      zIndex:2147483647, pointerEvents:'none', transition:'transform .12s ease, background .12s ease',
      transform:'translate(-100px,-100px)'});
    document.body.appendChild(c);
    let x=-100, y=-100;
    addEventListener('mousemove', e => { x=e.clientX; y=e.clientY; c.style.transform=`translate(${x}px,${y}px)`; }, true);
    addEventListener('mousedown', () => { c.style.transform=`translate(${x}px,${y}px) scale(.7)`; c.style.background='rgba(30,75,215,.35)'; }, true);
    addEventListener('mouseup', () => { c.style.transform=`translate(${x}px,${y}px)`; c.style.background='rgba(14,15,12,.18)'; }, true);
  };
  if (document.body) mk(); else addEventListener('DOMContentLoaded', mk);
})();
"""


def glide(pg: Page, loc, steps: int = 28, pause: int = 250):
    """Move the pointer smoothly onto an element's centre."""
    loc.scroll_into_view_if_needed()
    bb = loc.bounding_box()
    if not bb:
        return
    pg.mouse.move(bb["x"] + bb["width"] / 2, bb["y"] + bb["height"] / 2, steps=steps)
    pg.wait_for_timeout(pause)


def click(pg: Page, loc, steps: int = 28, after: int = 600):
    glide(pg, loc, steps)
    loc.click()
    pg.wait_for_timeout(after)


def smooth_scroll(pg: Page, dy: int, ms: int = 1800, el: str | None = None):
    target = f"document.querySelector({el!r})" if el else "window"
    pg.evaluate(f"({target}).scrollBy({{top:{dy}, behavior:'smooth'}})")
    pg.wait_for_timeout(ms)


def settle(pg: Page, hash_: str, wait: int = 2200):
    pg.goto(BASE + "/" + hash_)
    pg.wait_for_load_state("networkidle")
    pg.reload()  # second load is warm: no cold-start spinner in the footage
    pg.wait_for_load_state("networkidle")
    pg.wait_for_timeout(wait)
    # skip the "checking this denial" replay if it is showing
    pg.mouse.move(960, 1060)


# ---------------------------------------------------------------- clips
def worklist(pg: Page):  # ~10.3 s narration
    settle(pg, "#/app")
    yield
    pg.mouse.move(700, 900, steps=20)
    pg.wait_for_timeout(500)
    glide(pg, pg.locator("text=Drew Exemplar").first, steps=30, pause=600)
    for _ in range(4):
        pg.keyboard.press("j"); pg.wait_for_timeout(850)
    for _ in range(4):
        pg.keyboard.press("k"); pg.wait_for_timeout(650)
    pg.wait_for_timeout(1800)


def case(pg: Page):  # ~11.3 s
    settle(pg, "#/app")
    yield
    pg.wait_for_timeout(600)
    click(pg, pg.locator("text=Drew Exemplar").first, after=2600)
    pg.keyboard.press("Escape")
    glide(pg, pg.locator("text=Payer's reason").first, steps=40, pause=1500)
    tab = pg.get_by_role("tab", name="Denial letter")
    click(pg, tab, after=2600)
    glide(pg, pg.locator("text=50: medical necessity").first, steps=40, pause=3000)


def rules(pg: Page):  # ~14.8 s
    settle(pg, "#/app/c/case_015", 3200)
    pg.keyboard.press("Escape")
    yield
    click(pg, pg.get_by_role("tab", name="Rules"), after=900)
    smooth_scroll(pg, 520, 1600)
    row = pg.locator("button.rule-h").nth(1)
    if not row.count():
        row = pg.locator("text=Four weeks of conservative care").first
    click(pg, row, after=1800)
    chip = pg.locator("button.chip, .chip").filter(has_text="48").first
    if chip.count():
        click(pg, chip, after=2600)
    else:
        click(pg, pg.get_by_role("tab", name="Policy"), after=2600)
    smooth_scroll(pg, 160, 2200)
    pg.wait_for_timeout(2400)


def appeal(pg: Page):  # ~10.9 s
    settle(pg, "#/app/c/case_015", 3200)
    pg.keyboard.press("Escape")
    yield
    click(pg, pg.get_by_role("tab", name="Appeal letter"), after=1600)
    glide(pg, pg.locator(".ap-bar").first, steps=30, pause=900)
    smooth_scroll(pg, 700, 2200)
    ql = pg.locator(".ql").first
    if ql.count():
        ql.scroll_into_view_if_needed()
        pg.wait_for_timeout(300)
        glide(pg, ql, steps=30, pause=2400)
    pg.wait_for_timeout(2000)


def tamper(pg: Page):  # ~13.3 s
    settle(pg, "#/app/c/case_015", 3200)
    pg.keyboard.press("Escape")
    pg.get_by_role("tab", name="Appeal letter").click()
    pg.wait_for_timeout(1600)
    yield
    click(pg, pg.get_by_role("button", name="Edit", exact=True), after=500)
    ta = pg.locator("#ap-ta")
    text = ta.input_value()
    old = "lasting at least four weeks"
    i = text.find(old)
    new = "lasting at least two weeks"
    if i < 0:
        old, new = "after 1 month of symptoms", "after 2 weeks of symptoms"
        i = text.find(old)
    # select the phrase in the textarea and retype it, so the change is visible
    pos = i + len("lasting at least ") if old.startswith("lasting") else i + len("after ")
    word = "four weeks" if old.startswith("lasting") else "1 month"
    repl = "two weeks" if old.startswith("lasting") else "2 weeks"
    ta.evaluate(f"(t)=>{{t.focus(); t.setSelectionRange({pos},{pos + len(word)}); const lh=parseFloat(getComputedStyle(t).lineHeight)||24;"
                f" const before=t.value.slice(0,{pos}); const lines=before.split('\\n').length; t.scrollIntoView({{block:'start'}});}}")
    pg.wait_for_timeout(200)
    # bring the caret's line into view in the page
    pg.evaluate(f"""() => {{
      const t = document.querySelector('#ap-ta'); const r = t.getBoundingClientRect();
      const frac = {pos} / t.value.length; window.scrollBy({{top: r.top + r.height*frac - 500, behavior:'smooth'}});
    }}""")
    pg.wait_for_timeout(1000)
    pg.keyboard.press("Backspace")
    pg.keyboard.type(repl, delay=90)
    pg.wait_for_timeout(400)
    click(pg, pg.get_by_role("button", name="Letter", exact=True), after=600)
    pg.evaluate("window.scrollTo({top:0, behavior:'smooth'})")
    pg.wait_for_timeout(700)
    exp = pg.get_by_role("button", name="Export locked")
    if exp.count():
        glide(pg, exp, steps=24, pause=1200)
    void = pg.locator("text=Not in source").first
    if void.count():
        void.scroll_into_view_if_needed()
        glide(pg, void, steps=24, pause=1800)
    # revert: back to Edit, retype the original words, export unlocks
    click(pg, pg.get_by_role("button", name="Edit", exact=True), after=350)
    ta = pg.locator("#ap-ta")
    cur = ta.input_value()
    j = cur.find(repl)
    ta.evaluate(f"(t)=>{{t.focus(); t.setSelectionRange({j},{j + len(repl)});}}")
    pg.keyboard.press("Backspace")
    pg.keyboard.type(word, delay=40)
    click(pg, pg.get_by_role("button", name="Letter", exact=True), after=500)
    pg.evaluate("window.scrollTo({top:0, behavior:'smooth'})")
    pg.wait_for_timeout(600)
    ok = pg.get_by_role("button", name="Export letter")
    if ok.count():
        glide(pg, ok, steps=24, pause=1800)


def physician(pg: Page):  # ~9.1 s
    settle(pg, "#/app/c/case_031", 3200)
    pg.keyboard.press("Escape")
    yield
    pg.wait_for_timeout(500)
    click(pg, pg.get_by_role("tab", name="Physician request"), after=900)
    smooth_scroll(pg, 520, 2000)
    cp = pg.get_by_role("button", name="Copy").first
    if cp.count():
        glide(pg, cp, steps=34, pause=900)
        pg.context.grant_permissions(["clipboard-read", "clipboard-write"])
        cp.click()
    pg.wait_for_timeout(3000)


def check(pg: Page):  # ~12.4 s
    settle(pg, "#/app/checks", 2200)
    yield
    row = pg.locator("a.pa-open", has_text="Emerson Specimen")
    click(pg, row.first if row.count() else pg.locator("a.pa-open").first, after=2800)
    smooth_scroll(pg, 330, 1500)
    pg.wait_for_timeout(1500)
    chip = pg.locator("text=Earliest Jul 31").first
    if chip.count():
        glide(pg, chip, steps=40, pause=2600)
    pg.wait_for_timeout(2400)


def how(pg: Page):  # ~14.9 s
    settle(pg, "#/app/how", 2200)
    yield
    pg.mouse.move(1100, 600, steps=30)
    for _ in range(6):
        smooth_scroll(pg, 330, 2100)
    pg.wait_for_timeout(1200)


CLIPS = {f.__name__: f for f in (worklist, case, rules, appeal, tamper, physician, check, how)}


def encode(src: Path, dst: Path, start: float):
    subprocess.run([str(FFMPEG), "-y", "-loglevel", "error", "-ss", f"{start:.2f}", "-i", str(src),
                    "-vf", "scale=1920:1080:flags=lanczos,format=yuv420p", "-fps_mode", "cfr", "-r", "30",
                    "-c:v", "libx264", "-preset", "medium", "-crf", "18", "-an", "-movflags", "+faststart", str(dst)],
                   check=True)


def write_manifest():
    """src/cut/recs.json: which clips exist and how long they run, read by <Recording/> at render time."""
    import json
    probe = FFMPEG.with_name("ffprobe")
    out = {}
    for f in sorted(OUT.glob("*.mp4")):
        r = subprocess.run([str(probe), "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(f)],
                           capture_output=True, text=True, check=True)
        out[f.stem] = round(float(r.stdout.strip()), 3)
    (VIDEO / "src/cut/recs.json").write_text(json.dumps(out, indent=2) + "\n")


def warm(timeout: float = 90.0, fast: float = 1.5):
    """Hit the deployed app (page and API) until each answers 200 quickly (< `fast` s), so a Cloud Run cold start
    (seen at ~12 s) never reaches footage."""
    t0 = time.monotonic()
    for url in (BASE + "/", BASE + "/api/cases"):
        while True:
            t = time.monotonic()
            try:
                with urllib.request.urlopen(url, timeout=30) as r:
                    r.read()
                    if r.status == 200 and time.monotonic() - t < fast:
                        break
            except Exception:
                pass
            if time.monotonic() - t0 > timeout:
                raise RuntimeError(f"{url} did not answer a fast 200 within {timeout:.0f}s")
            time.sleep(0.5)


def main(names: list[str]):
    OUT.mkdir(parents=True, exist_ok=True)
    tmp = Path(tempfile.mkdtemp(prefix="rec-"))
    with sync_playwright() as p:
        browser = p.chromium.launch()
        # one real sign-in through the one-click demo, shared by every clip
        warm()
        ctx = browser.new_context(viewport=SIZE)
        pg = ctx.new_page()
        pg.goto(BASE + "/#/login")
        pg.wait_for_load_state("networkidle")
        pg.get_by_role("button", name="Continue to the demo").click()
        pg.wait_for_url("**/#/app**")
        pg.wait_for_timeout(800)
        state = ctx.storage_state()
        ctx.close()

        for name in names:
            d = tmp / name
            warm()
            ctx = browser.new_context(viewport=SIZE, device_scale_factor=1, storage_state=state,
                                      record_video_dir=str(d), record_video_size=SIZE)
            ctx.add_init_script(CURSOR)
            pg = ctx.new_page()
            t0 = time.monotonic()
            steps = CLIPS[name](pg)
            next(steps)  # set-up done: the clip starts here
            start = time.monotonic() - t0
            for _ in steps:
                pass
            dur = time.monotonic() - t0 - start
            video = pg.video
            ctx.close()
            raw = Path(video.path())
            encode(raw, OUT / f"{name}.mp4", start)
            print(f"{name}: {dur:.1f}s -> {OUT / (name + '.mp4')}")
        browser.close()
    write_manifest()
    shutil.rmtree(tmp, ignore_errors=True)


if __name__ == "__main__":
    if sys.argv[1:] == ["--manifest"]:
        write_manifest(); sys.exit()
    args = sys.argv[1:]
    if args[:1] == ["--base"]:
        BASE = args[1].rstrip("/")
        args = args[2:]
    main(args or list(CLIPS))
