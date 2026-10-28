// Node 24+: reuse the same quality checks as online search in the app.
import fs from "node:fs";
import path from "node:path";
import { foodFromOFF } from "../src/core/offProduct.ts";
const root = path.resolve(import.meta.dirname, "..");
const sources = ["food-pl-1.json", "food-pl-page2.json", "food-pl-page3.json"];
const products = new Map();
const report = [];
for (const file of sources) {
  const input = path.resolve(root, "../.tools/data", file);
  if (!fs.existsSync(input)) throw new Error(`Missing source: ${file}`);
  const raw = JSON.parse(fs.readFileSync(input, "utf8"));
  let accepted = 0;
  for (const record of raw.products) {
    const product = foodFromOFF(record);
    if (!product) continue;
    product.fetchedAt = fs.statSync(input).mtime.toISOString();
    product.updatedAt = product.fetchedAt;
    products.set(product.id, product);
    accepted++;
  }
  report.push({ file, input: raw.products.length, accepted, rejected: raw.products.length - accepted });
}
const list = [...products.values()];
fs.writeFileSync(path.join(root, "src/data/foods-pl.json"), JSON.stringify(list, null, 2) + "\n");
fs.writeFileSync(path.join(root, "public/data/foods-pl-odbl.json"), JSON.stringify({
  source: "Open Food Facts contributors", license: "ODbL-1.0",
  sourceUrl: "https://world.openfoodfacts.org/data", importedAt: new Date().toISOString(),
  scope: "Products tagged Poland; names and units retained from source. Community data, compare with package label.",
  inputs: report, products: list,
}, null, 2) + "\n");
console.log(JSON.stringify({ products: list.length, brands: new Set(list.map(p => p.brand)).size, report }));
