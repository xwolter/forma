"""Merge Polish store sightings from the ODbL Open Prices public export."""

import gzip
import json
import sqlite3
import sys
import unicodedata
from pathlib import Path


BITS = {"biedronka": 1, "lidl": 2, "zabka": 4, "dino": 8, "aldi": 16,
        "auchan": 32, "carrefour": 64, "kaufland": 128, "netto": 256, "lewiatan": 512}
NAMES = {"Biedronka": 1, "Lidl": 2, "Żabka": 4, "Dino": 8, "Aldi": 16,
         "Auchan": 32, "Carrefour": 64, "Kaufland": 128, "Netto": 256, "Lewiatan": 512}


def fold(value):
    value = value.lower().replace("ł", "l")
    return "".join(c for c in unicodedata.normalize("NFD", value) if not unicodedata.combining(c))


locations_file, prices_file, database_file = map(Path, sys.argv[1:4])
locations = {}
for line in gzip.open(locations_file, "rt", encoding="utf-8"):
    item = json.loads(line)
    if item.get("osm_address_country_code") != "PL":
        continue
    name = fold(item.get("osm_brand") or item.get("osm_name") or "")
    if name in BITS:
        locations[item["id"]] = BITS[name]

tags = {}
for line in gzip.open(prices_file, "rt", encoding="utf-8"):
    item = json.loads(line)
    bit = locations.get(item.get("location_id"))
    code = item.get("product_code")
    if bit and isinstance(code, str) and code.isdigit() and item.get("date", "") >= "2024-01-01":
        tags[code] = tags.get(code, 0) | bit

db = sqlite3.connect(database_file)
db.executemany("UPDATE products SET store_mask=store_mask | ? WHERE code=?", ((mask, code) for code, mask in tags.items()))
db.commit()
counts = {name: db.execute("SELECT COUNT(*) FROM products WHERE kcal IS NOT NULL AND (store_mask & ?) != 0", (bit,)).fetchone()[0] for name, bit in NAMES.items()}
db.close()

shards = Path(__file__).resolve().parent.parent / "updates-public" / "catalog" / "pl"
for path in shards.glob("*.json"):
    if path.name == "manifest.json":
        continue
    rows = json.loads(path.read_text(encoding="utf-8"))
    for row in rows:
        row[12] |= tags.get(row[0], 0)
    path.write_text(json.dumps(rows, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
manifest_path = shards / "manifest.json"
manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
manifest["stores"] = counts
manifest["storeSources"] = ["Open Food Facts", "Open Prices"]
manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
print(json.dumps({"matchedLocations": len(locations), "sightedBarcodes": len(tags), "calorieReadyByStore": counts}, ensure_ascii=False, indent=2))
