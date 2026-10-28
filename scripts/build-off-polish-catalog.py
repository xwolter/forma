"""Build the compact Polish-market catalogue from Open Food Facts' CSV export.

Usage: python scripts/build-off-polish-catalog.py path/to/products.csv.gz
Source: https://static.openfoodfacts.org/data/en.openfoodfacts.org.products.csv.gz
The generated database is attributed under ODbL; product photos remain remote.
"""

import csv
import gzip
import json
import re
import sys
import unicodedata
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path


def normalized(value: str) -> str:
    value = value.lower().replace("ł", "l")
    return "".join(c for c in unicodedata.normalize("NFD", value) if not unicodedata.combining(c))


def barcode_ok(code: str) -> bool:
    if len(code) not in (8, 12, 13, 14) or not code.isdigit():
        return False
    digits = [int(x) for x in code]
    check = digits.pop()
    total = sum(n * (3 if i % 2 == 0 else 1) for i, n in enumerate(reversed(digits)))
    return (10 - total % 10) % 10 == check


def number(raw: str, limit: float):
    try:
        value = float(raw)
        if 0 <= value <= limit and value != float("inf"):
            return round(value, 2)
    except (TypeError, ValueError):
        pass
    return None


def main() -> None:
    source = Path(sys.argv[1])
    destination = Path(__file__).resolve().parent.parent / "updates-public" / "catalog" / "pl"
    destination.mkdir(parents=True, exist_ok=True)
    shards = defaultdict(list)
    seen = set()
    scanned = eligible = photos = 0
    with gzip.open(source, "rt", encoding="utf-8", errors="replace", newline="") as stream:
        reader = csv.reader(stream, delimiter="\t")
        header = next(reader)
        indexes = {name: header.index(name) for name in (
            "code", "product_name", "brands", "countries_tags", "energy-kcal_100g",
            "energy_100g", "energy-kj_100g", "proteins_100g", "fat_100g",
            "carbohydrates_100g", "image_small_url", "serving_size",
            "serving_quantity", "last_modified_t",
        )}

        def field(row, name):
            index = indexes[name]
            return row[index] if index < len(row) else ""

        for row in reader:
            scanned += 1
            code = field(row, "code")
            if code in seen or not barcode_ok(code):
                continue
            if "en:poland" not in field(row, "countries_tags").split(",") and not code.startswith("590"):
                continue
            name = field(row, "product_name").strip()[:160]
            if not name:
                continue
            kcal = number(field(row, "energy-kcal_100g"), 1000)
            if kcal is None:
                kj = number(field(row, "energy_100g"), 4184)
                kcal = round(kj / 4.184, 2) if kj is not None else None
            if kcal is None:
                continue
            kj = number(field(row, "energy-kj_100g"), 4184)
            if kj is not None and abs(kcal - kj / 4.184) > max(10, kcal * 0.12):
                continue
            protein = number(field(row, "proteins_100g"), 100)
            fat = number(field(row, "fat_100g"), 100)
            carbs = number(field(row, "carbohydrates_100g"), 100)
            brand = field(row, "brands").strip()[:100]
            photo = field(row, "image_small_url").strip()[:350]
            if photo and not photo.startswith("https://images.openfoodfacts.org/images/products/"):
                photo = ""
            photo = photo.replace(".100.jpg", ".200.jpg") if photo else ""
            serving = field(row, "serving_size").strip()[:60]
            grams = number(field(row, "serving_quantity"), 10000)
            modified = field(row, "last_modified_t")
            try:
                modified = int(modified)
            except ValueError:
                modified = 0
            unit = "g"
            record = [code, name, brand, kcal, protein, fat, carbs, photo, unit, serving, grams, modified]
            keys = list(dict.fromkeys(token[:2] for token in re.findall(r"[a-z0-9]{2,}", normalized(name + " " + brand))))
            for key in keys[:8]:
                shards[key].append(record)
            seen.add(code)
            eligible += 1
            photos += bool(photo)
            if scanned % 500000 == 0:
                print(f"scanned={scanned:,} eligible={eligible:,}", flush=True)

    manifest = {
        "source": "Open Food Facts contributors",
        "sourceUrl": "https://world.openfoodfacts.org",
        "sourceDump": "https://static.openfoodfacts.org/data/en.openfoodfacts.org.products.csv.gz",
        "license": "ODbL-1.0",
        "photoLicense": "CC BY-SA 3.0",
        "builtAt": datetime.now(timezone.utc).isoformat(),
        "products": eligible,
        "withPhotos": photos,
        "scanned": scanned,
        "fields": ["barcode", "name", "brand", "kcal100", "protein100", "fat100", "carbs100", "photo", "unit", "serving", "servingGrams", "modified"],
        "shards": {},
    }
    for key, records in shards.items():
        path = destination / f"{key}.json"
        path.write_text(json.dumps(records, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
        manifest["shards"][key] = len(records)
    (destination / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"DONE scanned={scanned:,} products={eligible:,} with_photos={photos:,} shards={len(shards)}", flush=True)


if __name__ == "__main__":
    main()
