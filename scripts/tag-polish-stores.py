"""Add community-reported retail store tags to the OFF Android and Polish indices.

The OFF `stores` field is user-provided and describes where someone reported
buying the product. It does not guarantee current availability at any store.
"""

import csv
import gzip
import json
import re
import sqlite3
import sys
import unicodedata
from pathlib import Path


STORES = [
    ("Biedronka", 1), ("Lidl", 2), ("Żabka", 4), ("Dino", 8),
    ("Aldi", 16), ("Auchan", 32), ("Carrefour", 64), ("Kaufland", 128),
    ("Netto", 256), ("Lewiatan", 512),
]


def fold(value: str) -> str:
    value = value.lower().replace("ł", "l")
    return "".join(c for c in unicodedata.normalize("NFD", value) if not unicodedata.combining(c))


patterns = [(re.compile(r"(?<![a-z])" + re.escape(fold(name)) + r"(?![a-z])"), bit) for name, bit in STORES]
source = Path(sys.argv[1])
database = Path(sys.argv[2])
shards = Path(__file__).resolve().parent.parent / "updates-public" / "catalog" / "pl"
tags = {}
scanned = 0
with gzip.open(source, "rt", encoding="utf-8", errors="replace", newline="") as stream:
    reader = csv.reader(stream, delimiter="\t")
    header = next(reader)
    code_index, stores_index = header.index("code"), header.index("stores")
    for row in reader:
        scanned += 1
        if len(row) <= max(code_index, stores_index) or not row[stores_index]:
            continue
        store_text = fold(row[stores_index])
        mask = sum(bit for pattern, bit in patterns if pattern.search(store_text))
        if mask:
            code = row[code_index]
            tags[code] = tags.get(code, 0) | mask

db = sqlite3.connect(database)
columns = [row[1] for row in db.execute("PRAGMA table_info(products)")]
if "store_mask" not in columns:
    db.execute("ALTER TABLE products ADD COLUMN store_mask INTEGER NOT NULL DEFAULT 0")
db.executemany("UPDATE products SET store_mask=store_mask | ? WHERE code=?", ((mask, code) for code, mask in tags.items()))
db.commit()
counts = {name: db.execute("SELECT COUNT(*) FROM products WHERE kcal IS NOT NULL AND (store_mask & ?) != 0", (bit,)).fetchone()[0] for name, bit in STORES}
db.close()

for path in shards.glob("*.json"):
    if path.name == "manifest.json":
        continue
    rows = json.loads(path.read_text(encoding="utf-8"))
    for row in rows:
        mask = tags.get(row[0], 0)
        if len(row) == 12:
            row.append(mask)
        else:
            row[12] = mask
    path.write_text(json.dumps(rows, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
manifest_path = shards / "manifest.json"
manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
manifest["stores"] = counts
manifest["fields"].append("storeMask") if "storeMask" not in manifest["fields"] else None
manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
print(json.dumps({"scanned": scanned, "taggedCodes": len(tags), "calorieReadyByStore": counts}, ensure_ascii=False, indent=2))
