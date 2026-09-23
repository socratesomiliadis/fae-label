"""Audit and combine live certificate/private-label exports; binaries stay ignored."""
import json
import re
import sys
from pathlib import Path
from pypdf import PdfReader, PdfWriter

out = Path(sys.argv[1] if len(sys.argv) > 1 else "output/pdf/qa-certificates-private-label")
manifest = json.loads((out / "manifest.json").read_text(encoding="utf-8"))
writer = PdfWriter()
checks = []
for result in manifest["results"]:
    file = out / (result["name"] + ".pdf")
    reader = PdfReader(file)
    texts = [page.extract_text(extraction_mode="layout") or "" for page in reader.pages]
    assert len(reader.pages) == result["pageCount"], result["name"]
    assert all(text.strip() for text in texts), result["name"]
    assert not any("Υπερχείλιση" in issue or "υπερβαίνει" in issue or "αντιστοίχιση πεδίου" in issue for issue in result["issues"]), result["name"]
    if result["name"] == "certificate-conformance-30-lines":
        for line in result["request"]["lines"]:
            assert sum(len(re.findall(re.escape(line["lot"]) + r"(?!\d)", text)) for text in texts) == 1, line["lot"]
    if result["name"] == "certificate-bg-fresh-and-frozen":
        assert len(texts) == 4
        for index, line in enumerate(result["request"]["lines"]):
            assert all(line["lot"] in texts[index * 2 + part] for part in range(2))
        assert "50 kg" in texts[1] and "50 kg" in texts[3]
    if result["name"].endswith("-custom"):
        assert ("NORTHSTAR QA" if "-1-" in result["name"] else "HELIOS QA") in texts[0]
        assert "ΦΑΕΘΩΝ" not in texts[0]
    writer.append(reader, outline_item=result["name"])
    checks.append({"name": result["name"], "pages": len(texts), "textCharacters": [len(text) for text in texts], "bytes": file.stat().st_size})
assert all(row["archived"] for row in manifest["cleanup"])
writer.compress_identical_objects(remove_identicals=True, remove_orphans=True)
writer.write(out / "certificates-and-private-label-samples.pdf")
(out / "pdf-checks.json").write_text(json.dumps(checks, indent=2), encoding="utf-8")
print(f"Verified {len(checks)} PDFs, {sum(c['pages'] for c in checks)} pages; all QA fixtures archived.")
