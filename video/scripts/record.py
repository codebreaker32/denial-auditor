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
    c.innerHTML = '<svg width="30" height="30" viewBox="0 0 24 24"><path d="M4 2.5l15.5 9.2-6.6 1.5 3.9 7.1-2.9 1.5-3.8-7.1-4.9 4.6z" fill="#0e0f0c" stroke="#ffffff" stroke-width="1.6" stroke-linejoin="round"/></svg>';
    Object.assign(c.style, {position:'fixed', left:'0', top:'0', width:'30px', height:'30px', marginLeft:'-5px', marginTop:'-3px',
      zIndex:2147483647, pointerEvents:'none', transformOrigin:'5px 3px', transition:'scale .12s ease',
      transform:'translate(-100px,-100px)', filter:'drop-shadow(0 2px 3px rgba(0,0,0,.25))'});
    document.body.appendChild(c);
    addEventListener('mousemove', e => { c.style.transform = `translate(${e.clientX}px,${e.clientY}px)`; }, true);
    addEventListener('mousedown', () => { c.style.scale = '0.82'; }, true);
    addEventListener('mouseup', () => { c.style.scale = '1'; }, true);
  };
  if (document.body) mk(); else addEventListener('DOMContentLoaded', mk);
})();
"""


_pos = {"x": 1300.0, "y": 760.0}


def human_move(pg: Page, x: float, y: float, ms: float | None = None):
    """Move like a hand: a curved path, eased speed, a small overshoot, then a settle onto the target."""
    import math
    import random
    x0, y0 = _pos["x"], _pos["y"]
    dx, dy = x - x0, y - y0
    d = math.hypot(dx, dy)
    if d < 2:
        return
    ms = ms or min(1100.0, max(380.0, 320 + d * 0.42))
    ux, uy = dx / d, dy / d
    ov = min(14.0, d * 0.035)
    tx, ty = x + ux * ov, y + uy * ov  # overshoot point
    bend = d * random.uniform(0.08, 0.16) * random.choice((-1, 1))
    cx, cy = x0 + dx * 0.5 - uy * bend, y0 + dy * 0.5 + ux * bend
    n = max(12, int(ms / 33))  # each move + wait costs ~an extra 10-15 ms in playwright; keep real time ≈ ms
    t_start = time.monotonic()
    for i in range(1, n + 1):
        t = i / n
        e = 4 * t ** 3 if t < 0.5 else 1 - (-2 * t + 2) ** 3 / 2  # ease in-out cubic
        px = (1 - e) ** 2 * x0 + 2 * (1 - e) * e * cx + e ** 2 * tx
        py = (1 - e) ** 2 * y0 + 2 * (1 - e) * e * cy + e ** 2 * ty
        pg.mouse.move(px, py)
        lag = t_start + ms / 1000 * i / n - time.monotonic()
        if lag > 0:
            pg.wait_for_timeout(lag * 1000)
    for i in range(1, 7):  # settle back from the overshoot
        t = i / 6
        pg.mouse.move(tx + (x - tx) * t, ty + (y - ty) * t)
        pg.wait_for_timeout(12)
    _pos["x"], _pos["y"] = x, y


def glide(pg: Page, loc, steps: int = 28, pause: int = 250, ms: float | None = None):
    """Move the pointer naturally onto an element's centre (steps is kept for callers; speed follows distance)."""
    loc.scroll_into_view_if_needed()
    bb = loc.bounding_box()
    if not bb:
        return
    human_move(pg, bb["x"] + bb["width"] / 2, bb["y"] + bb["height"] / 2, ms)
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
def tour(pg: Page):  # pitch + worklist narration (~19 s): landing → Open the demo → login → worklist
    pg.goto(BASE + "/#/")
    pg.wait_for_load_state("networkidle")
    pg.reload()
    pg.wait_for_load_state("networkidle")
    pg.wait_for_timeout(1800)  # globe up
    _pos.update(x=1300.0, y=760.0)
    pg.mouse.move(1300, 760)
    yield
    pg.wait_for_timeout(400)
    human_move(pg, 640, 470, 700)
    hero = pg.locator("a.pill", has_text="Open the demo").nth(1)
    if hero.count():
        glide(pg, hero, pause=500, ms=600)  # hover state, no click yet
    for k in range(3):  # a quick read down the landing sections
        smooth_scroll(pg, 1000, 700)
        human_move(pg, 980 + (k % 2) * 220, 560 + k * 50, 450)
    cta = pg.locator("a.pill-lg", has_text="Open the demo").first
    cta.evaluate("(e) => e.scrollIntoView({block: 'center', behavior: 'smooth'})")
    pg.wait_for_timeout(1100)
    glide(pg, cta, pause=350, ms=650)
    cta.click()
    pg.wait_for_timeout(900)
    go = pg.get_by_role("button", name="Continue to the demo")
    go.wait_for()
    glide(pg, go, pause=250, ms=650)
    go.click()
    pg.wait_for_url("**/#/app**")
    pg.wait_for_timeout(1500)
    glide(pg, pg.locator("text=Drew Exemplar").first, pause=400)
    for _ in range(3):
        pg.keyboard.press("j"); pg.wait_for_timeout(700)
    for _ in range(3):
        pg.keyboard.press("k"); pg.wait_for_timeout(550)
    human_move(pg, 600, 560)
    pg.wait_for_timeout(1800)


def _passcode() -> str:
    """DEMO_PASSCODE from the repo's .env, read in code and never printed or logged."""
    env = Path(__file__).resolve().parents[2] / ".env"
    for line in env.read_text().splitlines():
        if line.strip().startswith("DEMO_PASSCODE="):
            return line.split("=", 1)[1].strip().strip('"').strip("'")
    raise RuntimeError("DEMO_PASSCODE is not set in .env")


LIVE_MARKS: dict = {}


def live(pg: Page):  # one real live run on case_015 (~2.5 min, a few cents of Token Factory). Only when named.
    settle(pg, "#/app/live", 2500)
    yield
    t0 = time.monotonic()
    mark = lambda k: LIVE_MARKS.setdefault(k, round(time.monotonic() - t0, 2))
    sel = pg.locator("#lv-case")
    glide(pg, sel, pause=300)
    sel.select_option("case_015")
    pg.wait_for_timeout(700)
    pw = pg.locator("#lv-pass")
    glide(pg, pw, pause=200)
    pw.click()
    pg.keyboard.type(_passcode(), delay=60)  # a password field: only dots are drawn
    assert pw.get_attribute("type") == "password"
    pg.wait_for_timeout(400)
    go = pg.locator("button.lv-go")
    glide(pg, go, pause=300)
    go.click()
    mark("run")
    human_move(pg, 1500, 900, 900)
    last = -1
    deadline = time.monotonic() + 420
    while time.monotonic() < deadline:
        pg.wait_for_timeout(500)
        bar = pg.locator(".lv-bar")
        if bar.count():
            n = int(bar.get_attribute("aria-valuenow") or 0)
            if n > 0:
                mark("first_rule")
            if n != last:
                LIVE_MARKS[f"rules_{n}"] = round(time.monotonic() - t0, 2)
                last = n
        if pg.locator("text=Finished in").count():
            mark("done")
            break
        if pg.locator("text=Run stopped").count() or pg.locator(".lv-form .lv-err").count():
            mark("error")
            break
    pg.wait_for_timeout(1200)
    summary = pg.locator(".lv-sum").first
    if summary.count():
        summary.evaluate("(e) => e.scrollIntoView({block: 'center', behavior: 'smooth'})")
        pg.wait_for_timeout(1000)
        glide(pg, summary, pause=3500)
    mark("end")


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


def rules(pg: Page):  # ~14.8 s: rules tab, stage summary, expand a rule (policy words + chart quotes), back to the list
    settle(pg, "#/app/c/case_015", 3200)
    pg.keyboard.press("Escape")
    glide(pg, pg.locator("text=in effect on the").first, pause=200, ms=500)
    yield
    pg.wait_for_timeout(1400)
    click(pg, pg.get_by_role("tab", name="Rules"), after=700)
    smooth_scroll(pg, 420, 1300)
    row = pg.locator(".rule .rr").nth(1)
    if not row.count():
        row = pg.locator("text=Four weeks of conservative care").first
    click(pg, row, after=1600)
    words = pg.locator(".rule mark, .rule .hl").first
    if words.count():
        glide(pg, words, pause=1600)
    smooth_scroll(pg, 260, 1200)
    found = pg.locator("text=Found in").first
    if found.count():
        glide(pg, found, pause=1800)
    click(pg, row, after=900)  # collapse: all five rules in view
    smooth_scroll(pg, -300, 1200)
    human_move(pg, 1500, 620)
    pg.wait_for_timeout(2600)


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
    void = pg.locator("text=This quote isn't in the policy").first
    if void.count():
        void.evaluate("(e) => e.scrollIntoView({block: 'center', behavior: 'smooth'})")
        pg.wait_for_timeout(900)
        glide(pg, void, steps=24, pause=2200)
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


ONLY_WHEN_NAMED = {"live": live}
CLIPS = {f.__name__: f for f in (tour, worklist, case, rules, appeal, tamper, physician, check, how)}


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
            ctx = browser.new_context(viewport=SIZE, device_scale_factor=1, storage_state=None if name == "tour" else state,
                                      record_video_dir=str(d), record_video_size=SIZE)
            ctx.add_init_script(CURSOR)
            _pos.update(x=1300.0, y=760.0)
            pg = ctx.new_page()
            t0 = time.monotonic()
            steps = (CLIPS.get(name) or ONLY_WHEN_NAMED[name])(pg)
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
            if name == "live":
                import json
                (OUT / "live.json").write_text(json.dumps(LIVE_MARKS, indent=1) + "\n")
                print("live marks:", {k: v for k, v in LIVE_MARKS.items() if not k.startswith("rules_")})
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
