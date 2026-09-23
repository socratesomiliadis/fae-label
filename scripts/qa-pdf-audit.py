"""Inspect and package the live QA preview outputs without changing the app."""
import concurrent.futures
import csv
import hashlib
import json
import subprocess
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw, ImageFont
from pypdf import PdfReader, PdfWriter
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import A4

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'output/pdf/qa-2026-09-23'
manifest = json.loads((OUT / 'manifest.json').read_text(encoding='utf-8'))
reports = manifest['results']
render_dir = OUT / 'pdf-renders'
render_dir.mkdir(exist_ok=True)
font = ImageFont.truetype('C:/Windows/Fonts/arial.ttf', 16)
poppler = Path('C:/Users/Socrates/.cache/codex-runtimes/codex-primary-runtime/dependencies/native/poppler/Library/bin/pdftoppm.exe')

def inspect(report):
    source = OUT / report['pdf']
    reader = PdfReader(source)
    text = '\n'.join(page.extract_text() or '' for page in reader.pages)
    prefix = render_dir / f"{report['number']:03d}"
    subprocess.run([str(poppler), '-r', '100', '-singlefile', '-png', str(source), str(prefix)], check=True, capture_output=True)
    image = Image.open(prefix.with_suffix('.png')).convert('RGB')
    difference = ImageChops.difference(image, Image.new('RGB', image.size, 'white'))
    bbox = difference.getbbox()
    info = dict(number=report['number'], report=report['report'], pages=len(reader.pages),
                widthMm=round(float(reader.pages[0].mediabox.width)*25.4/72, 2),
                heightMm=round(float(reader.pages[0].mediabox.height)*25.4/72, 2),
                textCharacters=len(text), blank=bbox is None, inkBounds=bbox,
                sha256=hashlib.sha256(source.read_bytes()).hexdigest(),
                issueCount=len(report['issues']), mappingIssues=report['mappingIssues'])
    (render_dir / f"{report['number']:03d}.txt").write_text(text, encoding='utf-8')
    return info

with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
    checks = list(pool.map(inspect, reports))
(OUT / 'pdf-checks.json').write_text(json.dumps(checks, indent=2, ensure_ascii=False), encoding='utf-8')

for start in range(0, len(reports), 12):
    contact = Image.new('RGB', (1560, 1720), '#dddddd')
    draw = ImageDraw.Draw(contact)
    for index, report in enumerate(reports[start:start+12]):
        x, y = (index % 3)*520, (index // 3)*430
        image = Image.open(render_dir / f"{report['number']:03d}.png").convert('RGB')
        image.thumbnail((500, 360))
        contact.paste(image, (x+(520-image.width)//2, y+55))
        name = report['report']
        draw.text((x+10,y+5), f"{report['number']:03d} {name[:46]}", fill='black', font=font)
        draw.text((x+10,y+25), name[46:], fill='black', font=font)
    contact.save(OUT / f'contact-{start//12+1:02d}.jpg', quality=92)

cover = OUT / 'qa-cover.pdf'
c = canvas.Canvas(str(cover), pagesize=A4)
c.setTitle('Legacy reports - diagnostic QA samples')
c.setFont('Helvetica-Bold', 20)
c.drawString(42, 780, 'Legacy reports: QA samples')
c.setFont('Helvetica', 11)
lines = [
    '23 September 2026 | 106 live application PDF previews',
    '',
    'QA FAILED: these are diagnostic outputs, not approved legacy reproductions.',
    'All 106 requests returned a PDF. Every preview has validation warnings.',
    '',
    'Imported PROIONTA.xlsx: 779 products; SYNTAGES.xlsx: 172 recipes.',
    'Import committed through the live UI: 0 errors, 1,173 warnings.',
    f"Sample product: source CODE {manifest['sampleProduct']['key']}; ERP {manifest['sampleProduct']['erp']}.",
    'Production: 2026-09-23; weight 5 kg; carton 10 kg; 2 pieces; pallet 500 kg.',
    'Dates, weights, vehicle IDs, and free text are synthetic QA inputs.',
    '',
    'Known failures:',
    '- Missing private-label brands, contact details, origins and translations.',
    '- Shared templates do not reproduce all brand, language and logo variants.',
    '- Unmapped fields, text overflow, blank reference-list output.',
    '- Customer data absent; certificate fidelity and pagination incomplete.',
    '',
    'The following 106 pages preserve the app PDF output and native page sizes.',
    'PDF bookmarks identify the legacy definition associated with each page.',
    'See manifest.json and QA-REPORT.md for mappings and individual issues.',
    'No printer jobs were submitted. No configurations were marked validated.',
]
for n, line in enumerate(lines):
    c.drawString(42, 742-n*22, line)
c.save()
writer = PdfWriter()
writer.append(cover)
for report in reports:
    writer.append(OUT / report['pdf'], outline_item=f"{report['number']:03d} {report['report']}")
writer.add_metadata({'/Title':'106 legacy report diagnostic samples', '/Subject':'QA failures preserved; not production approved'})
with (OUT / 'all-106-legacy-report-samples.pdf').open('wb') as stream:
    writer.write(stream)
with (OUT / 'report-index.csv').open('w', encoding='utf-8-sig', newline='') as stream:
    fields = ['number','report','family','profile','brand','languages','templateKey','httpStatus','pdf','issueCount','mappingIssues','issues','blank']
    csv_writer = csv.DictWriter(stream, fieldnames=fields)
    csv_writer.writeheader()
    for report, check in zip(reports, checks):
        row = {field:report.get(field, '') for field in fields}
        row.update(issueCount=len(report['issues']), blank=check['blank'])
        for field in ['languages','mappingIssues','issues']:
            row[field] = ' | '.join(row[field])
        csv_writer.writerow(row)
print(json.dumps({'pdfs':len(checks), 'combinedPages':len(PdfReader(OUT/'all-106-legacy-report-samples.pdf').pages),
                  'blankReports':[r['report'] for r in checks if r['blank']],
                  'uniquePdfHashes':len(set(r['sha256'] for r in checks))}, indent=2))
