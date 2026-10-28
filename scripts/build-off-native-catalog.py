"""Build the Android full-text food catalogue from the official OFF CSV export.

Usage: python scripts/build-off-native-catalog.py path/to/products.csv.gz
The output is packaged separately for Firebase Hosting, outside the APK.
"""

import csv
import gzip
import re
import sqlite3
import sys
import unicodedata
from datetime import datetime, timezone
from pathlib import Path


def fold(value: str) -> str:
    value = value.lower().replace("ł", "l")
    return "".join(c for c in unicodedata.normalize("NFD", value) if not unicodedata.combining(c))


def barcode_ok(code: str) -> bool:
    if len(code) not in (8, 12, 13, 14) or not code.isdigit():
        return False
    digits = [int(x) for x in code]
    check = digits.pop()
    total = sum(n * (3 if i % 2 == 0 else 1) for i, n in enumerate(reversed(digits)))
    return (10 - total % 10) % 10 == check


def number(value: str, limit: float):
    try:
        result = float(value)
        return round(result, 2) if 0 <= result <= limit else None
    except (TypeError, ValueError):
        return None


def main():
    source = Path(sys.argv[1])
    target = Path(__file__).resolve().parent.parent.parent / ".cache" / "off-products.sqlite"
    target.parent.mkdir(parents=True, exist_ok=True)
    if target.exists():
        target.unlink()
    db = sqlite3.connect(target)
    db.execute("PRAGMA page_size=8192")
    db.execute("PRAGMA journal_mode=OFF")
    db.execute("PRAGMA synchronous=OFF")
    db.execute("PRAGMA temp_store=MEMORY")
    db.execute("PRAGMA cache_size=-100000")
    db.execute("CREATE TABLE products (code TEXT PRIMARY KEY, name TEXT NOT NULL, brand TEXT NOT NULL, kcal REAL, protein REAL, fat REAL, carbs REAL, image_url TEXT NOT NULL, serving_size TEXT NOT NULL, serving_grams REAL, modified INTEGER, terms TEXT NOT NULL)")
    db.execute("CREATE TABLE metadata (key TEXT PRIMARY KEY, value TEXT NOT NULL)")

    scanned = 0
    prepared = 0
    batch = []
    with gzip.open(source, "rt", encoding="utf-8", errors="replace", newline="") as stream:
        reader = csv.reader(stream, delimiter="\t")
        header = next(reader)
        columns = {name: header.index(name) for name in (
            "code", "product_name", "brands", "energy-kcal_100g", "energy_100g", "energy-kj_100g",
            "proteins_100g", "fat_100g", "carbohydrates_100g", "image_small_url", "serving_size",
            "serving_quantity", "last_modified_t",
        )}

        def field(row, name):
            index = columns[name]
            return row[index] if index < len(row) else ""

        for row in reader:
            scanned += 1
            code = field(row, "code")
            name = field(row, "product_name").strip()[:160]
            if not barcode_ok(code) or not name:
                continue
            brand = field(row, "brands").strip()[:100]
            kcal = number(field(row, "energy-kcal_100g"), 1000)
            if kcal is None:
                kj = number(field(row, "energy_100g"), 4184)
                kcal = round(kj / 4.184, 2) if kj is not None else None
            kj = number(field(row, "energy-kj_100g"), 4184)
            if kcal is not None and kj is not None and abs(kcal - kj / 4.184) > max(10, kcal * 0.12):
                kcal = None
            image = field(row, "image_small_url").strip()[:350]
            if image and not image.startswith("https://images.openfoodfacts.org/images/products/"):
                image = ""
            if image:
                image = image.replace(".100.jpg", ".200.jpg")
            try:
                modified = int(field(row, "last_modified_t"))
            except ValueError:
                modified = 0
            terms = " ".join(re.findall(r"[a-z0-9]{2,}", fold(name + " " + brand)))
            if not terms:
                continue
            batch.append((
                code, name, brand, kcal, number(field(row, "proteins_100g"), 100),
                number(field(row, "fat_100g"), 100), number(field(row, "carbohydrates_100g"), 100),
                image, field(row, "serving_size").strip()[:60], number(field(row, "serving_quantity"), 10000), modified, terms,
            ))
            prepared += 1
            if len(batch) >= 10000:
                db.executemany("INSERT OR IGNORE INTO products VALUES (?,?,?,?,?,?,?,?,?,?,?,?)", batch)
                db.commit()
                batch.clear()
            if scanned % 500000 == 0:
                print(f"scanned={scanned:,} prepared={prepared:,}", flush=True)
    if batch:
        db.executemany("INSERT OR IGNORE INTO products VALUES (?,?,?,?,?,?,?,?,?,?,?,?)", batch)
        db.commit()
    print("Building full-text index...", flush=True)
    db.execute("CREATE VIRTUAL TABLE search USING fts4(terms, content='products', tokenize=unicode61)")
    db.execute("INSERT INTO search(search) VALUES ('rebuild')")
    db.execute("INSERT INTO metadata VALUES ('source', 'Open Food Facts contributors')")
    db.execute("INSERT INTO metadata VALUES ('license', 'ODbL-1.0')")
    db.execute("INSERT INTO metadata VALUES ('photo_license', 'CC BY-SA 3.0')")
    db.execute("INSERT INTO metadata VALUES ('built_at', ?)", (datetime.now(timezone.utc).isoformat(),))
    db.execute("INSERT INTO metadata VALUES ('source_rows', ?)", (str(scanned),))
    db.commit()
    count = db.execute("SELECT COUNT(*) FROM products").fetchone()[0]
    calories = db.execute("SELECT COUNT(*) FROM products WHERE kcal IS NOT NULL").fetchone()[0]
    photos = db.execute("SELECT COUNT(*) FROM products WHERE image_url != ''").fetchone()[0]
    sample = db.execute("SELECT p.name, p.kcal FROM search s JOIN products p ON p.rowid=s.docid WHERE search MATCH 'jajecznica*' LIMIT 3").fetchall()
    print(f"DONE source={scanned:,} indexed={count:,} with_calories={calories:,} with_photos={photos:,} size={target.stat().st_size:,} sample={sample}", flush=True)
    db.close()


if __name__ == "__main__":
    main()
