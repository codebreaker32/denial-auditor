// Renders src/index.html to the submission PDF via headless Chromium, then rasterises
// every PDF page to out/preview/ so the real output can be inspected.
// Output name: set PDF_NAME (e.g. PDF_NAME=Acme_Round1_Submission.pdf npm run build).
import { chromium } from 'playwright';
import { execFileSync } from 'node:child_process';
import { mkdirSync, rmSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.dirname(fileURLToPath(import.meta.url));
const src = path.join(root, 'src', 'index.html');
const outDir = path.join(root, 'out');
const pdfPath = path.join(outDir, process.env.PDF_NAME || 'Round1_Submission.pdf');
const previewDir = path.join(outDir, 'preview');
const skipPreview = process.argv.includes('--no-preview');

mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const consoleErrors = [];
page.on('console', (m) => m.type() === 'error' && consoleErrors.push(m.text()));
page.on('requestfailed', (r) => consoleErrors.push(`request failed: ${r.url()}`));

await page.goto('file://' + src, { waitUntil: 'networkidle' });
await page.evaluate(() => document.fonts.ready);

// Layout guard: any slide whose content overflows its fixed 1280x720 frame is a build error.
const overflow = await page.$$eval('.slide', (slides) =>
  slides
    .map((s, i) => {
      const bad = [];
      const frame = s.getBoundingClientRect();
      if (s.scrollHeight > s.clientHeight + 1 || s.scrollWidth > s.clientWidth + 1) bad.push('slide scroll overflow');
      s.querySelectorAll('[data-fit], .nd').forEach((el) => {
        const over = el.scrollHeight - el.clientHeight;
        const overW = el.scrollWidth - el.clientWidth;
        const name = el.dataset.fit ? `[data-fit=${el.dataset.fit}]` : `.nd "${(el.querySelector('h5')?.textContent || '').trim().slice(0, 28)}"`;
        if (over > 1) bad.push(`${name} overflows by ${over}px`);
        if (overW > 1) bad.push(`${name} overflows width by ${overW}px`);
      });
      s.querySelectorAll('*').forEach((el) => {
        const r = el.getBoundingClientRect();
        if (r.width && (r.right > frame.right + 1 || r.bottom > frame.bottom + 1)) bad.push(`<${el.tagName.toLowerCase()} class="${el.className}"> exits frame`);
      });
      return bad.length ? { slide: i + 1, id: s.id, issues: [...new Set(bad)].slice(0, 12) } : null;
    })
    .filter(Boolean),
);

// Template placeholders (e.g. "[Team name]", "[One-sentence solution]") must not ship. Citations like [3] are digits, so they don't match.
const placeholders = await page.evaluate(() => [...new Set(document.body.innerText.match(/\[[A-Z][^\[\]\n]{2,200}\]/g) || [])]);

await page.pdf({ path: pdfPath, preferCSSPageSize: true, printBackground: true });
const slideCount = await page.$$eval('.slide', (s) => s.length);
await browser.close();

console.log(`PDF  ${path.relative(root, pdfPath)}  (${slideCount} pages)`);
if (consoleErrors.length) console.log('Console/network errors:\n  ' + consoleErrors.join('\n  '));
if (placeholders.length) console.log(`WARNING: placeholders still in the PDF: ${placeholders.join(', ')}`);
if (overflow.length) {
  console.log('LAYOUT OVERFLOW:');
  for (const o of overflow) console.log(`  page ${o.slide} (#${o.id}): ${o.issues.join('; ')}`);
  process.exitCode = 1;
}

if (!skipPreview) {
  if (existsSync(previewDir)) rmSync(previewDir, { recursive: true });
  mkdirSync(previewDir, { recursive: true });
  execFileSync('python3', [path.join(root, 'preview.py'), pdfPath, previewDir], { stdio: 'inherit' });
}
