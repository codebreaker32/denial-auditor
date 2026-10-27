"""Record the demo clips from the deployed app as 1920x1080 / 30 fps MP4s.

Chrome's screencast gives crisp device-pixel frames (1440x810 CSS at 4/3 = 1920x1080) only when the
page changes; each frame is held until the next one, then ffmpeg (bundled with Remotion) writes CFR video.
Headless Chrome draws no cursor, so a small one is injected and follows real mouse events.

  ./.venv/bin/python video/rec/record.py [clip ...]     # from the repo root; default: all clips
"""
import base64, os, shutil, subprocess, sys, tempfile, time
from playwright.sync_api import sync_playwright

URL = os.environ.get("DEMO_URL", "https://denial-auditor.ttvcj372k5tgj.us-east-1.cs.amazonlightsail.com/")
OUT = os.path.join(os.path.dirname(__file__), "..", "public", "rec")
VIDEO_DIR = os.path.join(os.path.dirname(__file__), "..")

CURSOR = r"""
(() => {
  const add = () => {
    if (document.getElementById('__cur')) return;
    const c = document.createElement('div'); c.id = '__cur';
    c.innerHTML = '<svg width="22" height="22" viewBox="0 0 22 22"><path d="M3 2l14 8.5-6.2 1.4L7.6 18z" fill="#EDEDEF" stroke="#131217" stroke-width="1.4" stroke-linejoin="round"/></svg>';
    Object.assign(c.style, {position:'fixed', left:'0', top:'0', zIndex:2147483647, pointerEvents:'none', transform:'translate(-100px,-100px)', transition:'none'});
    const r = document.createElement('div'); r.id = '__ring';
    Object.assign(r.style, {position:'fixed', width:'28px', height:'28px', marginLeft:'-14px', marginTop:'-14px', borderRadius:'50%', border:'2px solid rgba(237,237,239,.55)', zIndex:2147483646, pointerEvents:'none', opacity:'0', transition:'opacity .35s, transform .35s', transform:'scale(.6)'});
    document.body.append(c, r);
    addEventListener('mousemove', e => { c.style.transform = `translate(${e.clientX - 3}px, ${e.clientY - 2}px)`; }, true);
    addEventListener('mousedown', e => { r.style.left = e.clientX + 'px'; r.style.top = e.clientY + 'px'; r.style.transition = 'none'; r.style.opacity = '1'; r.style.transform = 'scale(.6)';
      requestAnimationFrame(() => { r.style.transition = 'opacity .45s, transform .45s'; r.style.opacity = '0'; r.style.transform = 'scale(1.4)'; }); }, true);
  };
  if (document.body) add(); else addEventListener('DOMContentLoaded', add);
})();
"""


class Clip:
    def __init__(self, page, name):
        self.page, self.name, self.frames = page, name, []
        self.x, self.y = 720, 600
        self.cdp = page.context.new_cdp_session(page)
        self.cdp.on("Page.screencastFrame", self._frame)

    def _frame(self, ev):
        self.frames.append((time.monotonic(), ev["data"]))
        try:
            self.cdp.send("Page.screencastFrameAck", {"sessionId": ev["sessionId"]})
        except Exception:
            pass

    def start(self):
        self.page.mouse.move(self.x, self.y)
        self.cdp.send("Page.startScreencast", {"format": "jpeg", "quality": 92, "maxWidth": 1920, "maxHeight": 1080, "everyNthFrame": 1})
        self.t0 = time.monotonic()
        self.hold(400)

    def hold(self, ms):
        self.page.wait_for_timeout(ms)

    def move_to(self, target, ms=700, dx=0.5, dy=0.5):
        box = target.bounding_box() if not isinstance(target, tuple) else None
        x, y = target if box is None else (box["x"] + box["width"] * dx, box["y"] + box["height"] * dy)
        steps = max(8, ms // 16)
        for i in range(1, steps + 1):
            t = i / steps
            e = 1 - (1 - t) ** 3  # ease-out
            self.page.mouse.move(self.x + (x - self.x) * e, self.y + (y - self.y) * e)
            self.page.wait_for_timeout(16)
        self.x, self.y = x, y

    def click(self, target, ms=700, after=600, **kw):
        self.move_to(target, ms, **kw)
        self.hold(150)
        self.page.mouse.down(); self.page.mouse.up()
        self.hold(after)

    def scroll(self, dy, ms=900):
        steps = max(8, ms // 16)
        done = 0
        for i in range(1, steps + 1):
            t = i / steps
            want = dy * (1 - (1 - t) ** 2)
            self.page.mouse.wheel(0, want - done); done = want
            self.page.wait_for_timeout(16)

    def finish(self, tail=600):
        self.hold(tail)
        t_end = time.monotonic()
        self.cdp.send("Page.stopScreencast")
        write_mp4(self.name, self.frames, self.t0, t_end)


def write_mp4(name, frames, t0, t_end):
    os.makedirs(OUT, exist_ok=True)
    tmp = tempfile.mkdtemp(prefix=f"rec-{name}-")
    frames = [f for f in frames if f[0] >= t0 - 1] or frames
    lines = []
    for i, (ts, data) in enumerate(frames):
        p = os.path.join(tmp, f"{i:05d}.jpg")
        with open(p, "wb") as fh:
            fh.write(base64.b64decode(data))
        nxt = frames[i + 1][0] if i + 1 < len(frames) else t_end
        start = max(ts, t0)
        lines.append(f"file '{p}'\nduration {max(nxt - start, 0.001):.4f}")
    lines.append(f"file '{os.path.join(tmp, f'{len(frames) - 1:05d}.jpg')}'")
    lst = os.path.join(tmp, "list.txt")
    open(lst, "w").write("\n".join(lines) + "\n")
    out = os.path.abspath(os.path.join(OUT, f"{name}.mp4"))
    comp = os.path.join(VIDEO_DIR, "node_modules", "@remotion", "compositor-linux-x64-gnu")
    subprocess.run([os.path.join(comp, "ffmpeg"), "-y", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", lst,
                    "-vf", "scale=1920:1080", "-fps_mode", "cfr", "-r", "30", "-c:v", "libx264", "-crf", "16",
                    "-preset", "slow", "-pix_fmt", "yuv420p", out], check=True, env={**os.environ, "LD_LIBRARY_PATH": comp})
    shutil.rmtree(tmp)
    print(f"{name}: {t_end - t0:.1f}s, {len(frames)} frames -> {out}")


def rule(page, addr):
    return page.locator("article.rule", has=page.locator("a.rule-addr", has_text=addr)).first


# ---------- clips, one per script beat ----------

def worklist(page):
    page.goto(URL); page.wait_for_selector("table.list tbody tr")
    c = Clip(page, "worklist"); c.start(); c.hold(800)
    c.move_to(page.get_by_text("3 ready to appeal").first, 900, dx=0.2); c.hold(1400)
    c.move_to(page.locator("th", has_text="Due").first, 800); c.hold(1200)
    c.move_to(page.locator("table.list tbody tr").nth(1).locator("td").nth(0), 600); c.hold(900)
    c.move_to(page.locator("table.list tbody tr").nth(1).locator(".mark, .pill").first, 800); c.hold(1400)
    c.move_to(page.get_by_text("Policy watch").first, 1000); c.hold(1800)
    c.click(page.locator("a.l1", has_text="Drew Exemplar"), 1000, after=1500)
    c.finish()


def case_open(page):
    page.goto(URL + "#/case/case_015"); page.wait_for_selector(".rule")
    c = Clip(page, "case"); c.start(); c.hold(1200)
    c.move_to(page.locator(".answer").first, 800); c.hold(1500)
    c.move_to(page.get_by_text("days left").first, 800); c.hold(1800)
    c.click(page.get_by_role("tab", name="Denial letter"), 900, after=600)
    c.scroll(380, 1200); c.hold(2200)
    c.move_to(page.locator("figure img, .letter-img img, [data-pane] img").first, 900, dy=0.45); c.hold(3000)
    c.finish()


def policy(page):
    page.goto(URL + "#/case/case_015"); page.wait_for_selector(".rule")
    c = Clip(page, "policy"); c.start()
    c.scroll(380, 1100); c.hold(600)
    c.click(page.get_by_role("tab", name="Policy"), 800, after=900)
    c.move_to(page.get_by_text("effective 10/23/2025").first, 900, dx=0.3); c.hold(2200)
    c.move_to(page.get_by_text("sentences of background").first, 900, dx=0.3); c.hold(1800)
    c.scroll(260, 1000)
    c.move_to(page.get_by_text("Supports").nth(1), 900); c.hold(2000)
    c.scroll(260, 1000); c.hold(2500)
    c.finish()


def rule_votes(page):
    page.goto(URL + "#/case/case_015"); page.wait_for_selector(".rule")
    page.mouse.wheel(0, 380); page.wait_for_timeout(500)
    c = Clip(page, "rule"); c.start()
    r = rule(page, "S48")
    r.scroll_into_view_if_needed(); c.hold(500)
    c.click(r.locator("button.rule-toggle"), 1000, after=1200)
    c.scroll(200, 900); c.hold(800)
    c.move_to(r.locator(".why"), 900, dx=0.3); c.hold(2600)
    c.move_to(r.locator(".conf"), 800, dx=0.3); c.hold(2600)
    c.click(r.locator("a", has_text="n2").first, 900, after=2600)
    c.finish(1200)


def appeal(page):
    page.goto(URL + "#/case/case_015"); page.wait_for_selector(".rule")
    c = Clip(page, "appeal"); c.start(); c.hold(500)
    c.move_to(page.get_by_text("Decided by a fixed rule").first, 1000); c.hold(2200)
    c.click(page.get_by_role("button", name="Review appeal").first, 1000, after=1800)
    c.move_to(page.locator("figure.lq figcaption").first, 1000, dx=0.15); c.hold(2000)
    c.move_to(page.locator("[data-gate] .gate-head, [data-gate]").first, 1000, dx=0.5, dy=0.2); c.hold(2500)
    c.scroll(350, 1400); c.hold(2000)
    c.finish()


def tamper(page):
    page.goto(URL + "#/case/case_015"); page.wait_for_selector(".rule")
    page.get_by_role("button", name="Review appeal").first.click(); page.wait_for_selector("[data-edit]")
    page.locator("[data-edit]").scroll_into_view_if_needed(); page.wait_for_timeout(2500)
    c = Clip(page, "tamper"); c.start()
    c.click(page.locator("[data-edit]"), 900, after=700)
    ta = page.locator("#letter")
    i = page.evaluate("() => { const t = document.querySelector('#letter'); return t.value.indexOf('at least four weeks') + 9; }")
    page.evaluate(f"() => {{ const t = document.querySelector('#letter'); t.focus(); t.setSelectionRange({i}, {i} + 4); const lh = parseFloat(getComputedStyle(t).lineHeight) || 24; t.scrollTop = Math.max(0, t.value.slice(0, {i}).split('\\n').length * lh - 160); }}")
    c.move_to(ta, 700, dx=0.4, dy=0.4); c.hold(1200)
    page.keyboard.type("two", delay=160); c.hold(1800)
    c.click(page.locator("[data-edit]"), 900, after=900)
    page.locator(".lq.bad").first.scroll_into_view_if_needed(); c.hold(700)
    c.move_to(page.locator(".void").first, 900); c.hold(1800)
    c.move_to(page.locator(".says-l").first, 800); c.hold(1800)
    c.move_to(page.get_by_text("Export locked").first, 1000); c.hold(2500)
    c.finish()


def check(page):
    page.goto(URL + "#/check"); page.wait_for_selector("table.list tbody tr")
    c = Clip(page, "check"); c.start(); c.hold(900)
    c.click(page.locator("a.l1", has_text="Emerson Specimen"), 1000, after=1600)
    c.move_to(page.locator(".answer").first, 800); c.hold(1200)
    c.move_to(page.get_by_text("earliest date").first, 900); c.hold(2000)
    c.click(page.get_by_role("tab", name="Chart notes"), 1000, after=600)
    c.scroll(420, 1200); c.hold(600)
    c.move_to(page.locator(".tl").first, 900, dx=0.75, dy=0.3); c.hold(3000)
    c.finish()


def cost(page):
    page.goto(URL + "#/case/case_015"); page.wait_for_selector(".rule")
    page.evaluate("() => scrollTo(0, document.body.scrollHeight)"); page.wait_for_timeout(800)
    c = Clip(page, "cost"); c.start(); c.hold(600)
    s = page.get_by_text("Model calls and cost").first
    c.click(s, 1000, after=1200)
    c.scroll(500, 1400); c.hold(3500)
    c.finish()


CLIPS = {f.__name__: f for f in (worklist, case_open, policy, rule_votes, appeal, tamper, check, cost)}

if __name__ == "__main__":
    want = sys.argv[1:] or list(CLIPS)
    with sync_playwright() as p:
        b = p.chromium.launch()
        ctx = b.new_context(viewport={"width": 1440, "height": 810}, device_scale_factor=4 / 3)
        ctx.add_init_script(CURSOR)
        for name in want:
            page = ctx.new_page()
            try:
                CLIPS[name](page)
            except Exception as e:
                print(f"{name}: FAILED {type(e).__name__}: {str(e).splitlines()[0]}")
            page.close()
        b.close()
