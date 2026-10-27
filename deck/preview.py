"""Rasterise each page of the built PDF to PNG and report page size / fonts embedded."""
import sys
import pymupdf as fitz

pdf_path, out_dir = sys.argv[1], sys.argv[2]
doc = fitz.open(pdf_path)
fonts = set()
for i, page in enumerate(doc, start=1):
    page.get_pixmap(dpi=110).save(f"{out_dir}/page-{i:02d}.png")
    fonts.update(f[3] for f in page.get_fonts())
w, h = doc[0].rect.width / 72, doc[0].rect.height / 72
print(f"PNG  {len(doc)} pages -> {out_dir}  ({w:.2f}in x {h:.2f}in)")
print("Fonts embedded: " + ", ".join(sorted(fonts)))
