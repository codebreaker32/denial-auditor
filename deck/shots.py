"""Full-viewport app screenshots for the deck's browser frames, at 2x. Run from the repo root with the app on :8600."""
from playwright.sync_api import sync_playwright
U = "http://localhost:8600/"; O = "deck/src/img/"
with sync_playwright() as p:
    b = p.chromium.launch()
    pg = b.new_page(viewport={"width": 1440, "height": 900}, device_scale_factor=2)
    pg.goto(U + "#/case/case_015"); pg.wait_for_timeout(1800); pg.screenshot(path=O + "app-case.png")
    pg.goto(U); pg.wait_for_timeout(1500); pg.screenshot(path=O + "app-worklist.png")
    pg.goto(U + "#/check/case_009"); pg.wait_for_timeout(1500); pg.screenshot(path=O + "app-check.png")
    pg.goto(U + "#/case/case_015"); pg.wait_for_timeout(1500)
    pg.get_by_role("button", name="Review appeal").first.click(); pg.wait_for_timeout(1500)
    pg.locator("[data-edit]").click(); t = pg.locator("#letter")
    t.fill(t.input_value().replace("at least four weeks", "at least two weeks", 1)); pg.wait_for_timeout(2500)
    pg.locator("[data-edit]").click(); pg.wait_for_timeout(800)
    pg.evaluate("() => { const e = document.querySelector('.lq.bad'); scrollTo(0, e.getBoundingClientRect().top + scrollY - 260); }"); pg.wait_for_timeout(500)
    pg.screenshot(path=O + "app-tampered.png")
    b.close()
