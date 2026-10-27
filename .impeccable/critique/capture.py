"""Capture every app view at desktop (1440) and phone (390) widths.
Usage (repo root, app on :8600): ./.venv/bin/python .impeccable/critique/capture.py <out_dir>"""
import sys, os
from playwright.sync_api import sync_playwright
U = 'http://localhost:8600/'; O = sys.argv[1] if len(sys.argv) > 1 else '.impeccable/critique/shots/'
os.makedirs(O, exist_ok=True)
views = [('worklist', ''), ('case', '#/case/case_015'), ('check-list', '#/check'), ('check', '#/check/case_009'), ('live', '#/live'), ('how', '#/how'), ('case-docreq', '#/case/case_027')]
with sync_playwright() as p:
    b = p.chromium.launch()
    for vw, vh, tag in [(1440, 900, 'd'), (390, 844, 'm')]:
        pg = b.new_page(viewport={'width': vw, 'height': vh}, device_scale_factor=1 if tag == 'd' else 2)
        for n, h in views:
            pg.goto(U + h); pg.wait_for_timeout(1500); pg.screenshot(path=f'{O}/{tag}-{n}.png', full_page=True)
        pg.goto(U + '#/case/case_015'); pg.wait_for_timeout(1500)
        pg.get_by_role('button', name='Review appeal').first.click(); pg.wait_for_timeout(2000)
        pg.screenshot(path=f'{O}/{tag}-appeal.png', full_page=True)
        pg.close()
    b.close()
print('captured to', O)
