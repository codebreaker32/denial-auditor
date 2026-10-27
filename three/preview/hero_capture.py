import sys
from playwright.sync_api import sync_playwright
out, qs = sys.argv[1], sys.argv[2]
w = int(sys.argv[3]) if len(sys.argv) > 3 else 1200; h = int(sys.argv[4]) if len(sys.argv) > 4 else 1200
with sync_playwright() as p:
    b = p.chromium.launch(args=["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"])
    pg = b.new_page(viewport={"width": w, "height": h})
    pg.on("console", lambda m: print("console:", m.text) if m.type == "error" else None)
    pg.goto(f"http://localhost:8611/hero.html?{qs}&w={w}&h={h}")
    pg.wait_for_function("window.__ready === true", timeout=120000)
    pg.wait_for_timeout(300)
    pg.locator("canvas").screenshot(path=out, omit_background=True)
    b.close()
