import sys
from playwright.sync_api import sync_playwright
URL='https://denial-auditor.ttvcj372k5tgj.us-east-1.cs.amazonlightsail.com/'
out='/tmp/claude-1000/-home-aman-projects-nebius-nvidia/46ddaf12-659f-4dd7-a340-d69351601bc5/scratchpad/'
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_page(viewport={'width':1440,'height':810},device_scale_factor=1)
    for name,h in [('wl',''),('case','#/case/case_015')]:
        pg.goto(URL+h); pg.wait_for_timeout(2500); pg.screenshot(path=out+f'peek-{name}.png')
    b.close()
