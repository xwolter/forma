"""Prepare a versioned, signed-by-hash OFF data pack for Firebase Hosting."""

import gzip
import hashlib
import json
import sqlite3
import sys
from pathlib import Path


VERSION = "2026-10"
ORIGIN = "https://forma-mobi-2026-4e7c1a.web.app"
source = Path(sys.argv[1])
output = Path(__file__).resolve().parent.parent / "updates-public" / "catalog"
output.mkdir(parents=True, exist_ok=True)
archive = output / f"off-products-{VERSION}.sqlite.gz"

db = sqlite3.connect(f"file:{source.as_posix()}?mode=ro", uri=True)
quick_check = db.execute("PRAGMA quick_check").fetchone()[0]
if quick_check != "ok":
    raise ValueError(f"SQLite failed quick_check: {quick_check}")
products, with_calories, with_photos = db.execute(
    "SELECT COUNT(*), SUM(kcal IS NOT NULL), SUM(image_url != '') FROM products"
).fetchone()
source_rows = int(db.execute("SELECT value FROM metadata WHERE key='source_rows'").fetchone()[0])
db.close()

with source.open("rb") as incoming, archive.open("wb") as destination:
    with gzip.GzipFile(filename="", mode="wb", fileobj=destination, compresslevel=6, mtime=0) as compressed:
        while chunk := incoming.read(1024 * 1024):
            compressed.write(chunk)

digest = hashlib.sha256()
with archive.open("rb") as stream:
    while chunk := stream.read(1024 * 1024):
        digest.update(chunk)

manifest = {
    "schema": 1,
    "version": VERSION,
    "url": f"{ORIGIN}/catalog/{archive.name}",
    "bytes": archive.stat().st_size,
    "databaseBytes": source.stat().st_size,
    "sha256": digest.hexdigest(),
    "sourceRows": source_rows,
    "products": products,
    "withCalories": with_calories,
    "withPhotos": with_photos,
    "source": "Open Food Facts contributors",
    "sourceUrl": "https://world.openfoodfacts.org",
    "sourceDump": "https://static.openfoodfacts.org/data/en.openfoodfacts.org.products.csv.gz",
    "license": "ODbL-1.0",
    "photoLicense": "CC BY-SA 3.0",
}
(output / "latest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
(output / "CREDITS.txt").write_text(
    "Product data: © Open Food Facts contributors, Open Database License 1.0 (ODbL).\n"
    "https://world.openfoodfacts.org\n"
    "https://opendatacommons.org/licenses/odbl/1-0/\n"
    "Product image URLs point to Open Food Facts contributor photos under CC BY-SA 3.0.\n"
    "https://creativecommons.org/licenses/by-sa/3.0/\n"
    "Compare nutrition values with the product label.\n",
    encoding="utf-8",
)
print(json.dumps({key: manifest[key] for key in ("products", "withCalories", "withPhotos", "bytes", "databaseBytes", "sha256")}, indent=2))
