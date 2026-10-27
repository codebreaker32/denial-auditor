"""Crops of the running app for the deck, at 2x. Run from the repo root with the app on :8600:
  ./.venv/bin/python deck/crop.py"""
from playwright.sync_api import sync_playwright
U = "http://localhost:8600/"
O = "deck/src/img/"


def union(page, sels, pad=0):
    boxes = [page.locator(s).first.bounding_box() for s in sels]
    x0 = min(b["x"] for b in boxes) - pad; y0 = min(b["y"] for b in boxes) - pad
    x1 = max(b["x"] + b["width"] for b in boxes) + pad; y1 = max(b["y"] + b["height"] for b in boxes) + pad
    sx, sy = page.evaluate("[scrollX, scrollY]")
    return {"x": x0 + sx, "y": y0 + sy, "width": x1 - x0, "height": y1 - y0}


def shot(page, name, sels, pad=12):
    page.screenshot(path=O + name, clip=union(page, sels, pad), full_page=True)


with sync_playwright() as p:
    b = p.chromium.launch()
    pg = b.new_page(viewport={"width": 1440, "height": 900}, device_scale_factor=2)
    pg.goto(U); pg.wait_for_timeout(1800)
    shot(pg, "worklist.png", [".page-title", "table.list"], 16)
    pg.goto(U + "#/case/case_015"); pg.wait_for_timeout(1800)
    shot(pg, "case-header.png", [".crumb", ".vline", ".meta"], 14)
    shot(pg, "case-full.png", [".crumb", ".vline", ".coverage"], 14)
    shot(pg, "coverage.png", [".coverage"], 10)
    # select S48 and show it in the policy
    r = pg.locator("article.rule", has=pg.locator("a.rule-addr", has_text="S48")).first
    r.locator("button.rule-toggle").click(); pg.wait_for_timeout(900)
    shot(pg, "rule-selected.png", ["article.rule.on"], 10)
    s48 = pg.locator("p.sent", has_text="reasonable trial of conservative management").first
    s48.scroll_into_view_if_needed(); pg.wait_for_timeout(500)
    shot(pg, "policy.png", ["p.sent:has-text('non-red flag\" condition')", "p.sent:has-text('reasonable trial of conservative')", "p.sent:has-text('limitations due to low back')"], 14)
    pg.locator("[data-tab=chart]").click(); pg.wait_for_timeout(900)
    shot(pg, "timeline.png", [".tl"], 2)
    # appeal: clean gate, then a tampered quote
    pg.goto(U + "#/case/case_015"); pg.wait_for_timeout(1500)
    pg.get_by_role("button", name="Review appeal").first.click(); pg.wait_for_timeout(2500)
    shot(pg, "gate-ok.png", [".gate-head", ".gate .say"], 14)
    pg.locator("[data-edit]").click(); t = pg.locator("#letter")
    t.fill(t.input_value().replace("at least four weeks", "at least two weeks", 1)); pg.wait_for_timeout(2500)
    pg.locator("[data-edit]").click(); pg.wait_for_timeout(900)
    pg.locator(".lq.bad").first.scroll_into_view_if_needed(); pg.wait_for_timeout(400)
    shot(pg, "void.png", [".lq.bad", ".lq.says"], 12)
    shot(pg, "gate-lock.png", [".gate .export"], 12)
    shot(pg, "gate-top.png", [".gate-head", ".gate li.bad"], 14)
    # prior-auth check
    pg.goto(U + "#/check/case_009"); pg.wait_for_timeout(1800)
    shot(pg, "check-header.png", [".crumb", ".vline"], 14)
    pg.locator("[data-tab=chart]").click(); pg.wait_for_timeout(900)
    shot(pg, "check-timeline.png", [".tl"], 2)
    b.close()
