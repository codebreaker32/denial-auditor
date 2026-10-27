import sys
from playwright.sync_api import sync_playwright
# usage: capture.py out.png "az=-38&el=12" [w h]
out, qs = sys.argv[1], sys.argv[2]
w = int(sys.argv[3]) if len(sys.argv) > 3 else 1280; h = int(sys.argv[4]) if len(sys.argv) > 4 else 1166
with sync_playwright() as p:
    b = p.chromium.launch(args=["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"])
    pg = b.new_page(viewport={"width": w, "height": h})
    pg.on("console", lambda m: print("console:", m.text) if m.type in ("error", "warning") else None)
    pg.goto(f"http://localhost:8611/index.html?{qs}&w={w}&h={h}")
    pg.wait_for_function("window.__ready === true", timeout=60000)
    pg.wait_for_timeout(300)
    pg.locator("canvas").screenshot(path=out)
    b.close()
