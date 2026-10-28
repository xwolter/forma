import type { Product } from "./types";
import { safeProductPhoto } from "./foodPhotos";

type Row = [string, string, string, number, number | null, number | null, number | null, string, "g" | "ml", string, number | null, number, number];
type Manifest = { products: number; withPhotos: number; builtAt: string; shards: Record<string, number> };
const cached = new Map<string, Promise<Row[]>>();
let manifestPromise: Promise<Manifest> | undefined;
const catalogOrigin = "https://forma-mobi-2026-4e7c1a.web.app/catalog/pl";
const fold = (value: string) => value.toLocaleLowerCase("pl").replaceAll("ł", "l").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
const words = (value: string) => fold(value).match(/[a-z0-9]{2,}/g) ?? [];

async function manifest(): Promise<Manifest> {
  manifestPromise ??= fetch(`${catalogOrigin}/manifest.json`).then(response => {
    if (!response.ok) throw new Error("Katalog produktów nie jest dostępny.");
    return response.json() as Promise<Manifest>;
  }).catch(error => { manifestPromise = undefined; throw error; });
  return manifestPromise;
}

async function shard(key: string): Promise<Row[]> {
  if (!cached.has(key)) {
    cached.set(key, fetch(`${catalogOrigin}/${key}.json`).then(response => {
      if (!response.ok) throw new Error("Nie udało się otworzyć katalogu produktów.");
      return response.json() as Promise<Row[]>;
    }).catch(error => { cached.delete(key); throw error; }));
  }
  return cached.get(key)!;
}

function toProduct(row: Row): Product {
  const [code, name, brand, kcal, protein, fat, carbs, photo, unit, servingSize, servingGrams, modified] = row;
  return {
    id: `off-${code}`, schemaVersion: 1, updatedAt: new Date().toISOString(),
    name, brand, barcode: code, imageUrl: safeProductPhoto(photo, code), unit,
    kcal, protein, fat, carbs, favorite: false,
    source: "Open Food Facts · dane społecznościowe",
    sourceUrl: `https://world.openfoodfacts.org/product/${code}`,
    fetchedAt: new Date().toISOString(),
    sourceModified: modified ? new Date(modified * 1000).toISOString() : undefined,
    servingSize, servingGrams: servingGrams ?? undefined,
  };
}

export type CatalogPage = { products: Product[]; total: number; page: number; hasMore: boolean; catalogSize: number };
export async function searchPolishCatalog(query: string, page = 1, storeMask = 0): Promise<CatalogPage> {
  const terms = words(query);
  if (!terms.length || !Number.isInteger(page) || page < 1) return { products: [], total: 0, page, hasMore: false, catalogSize: 0 };
  const info = await manifest();
  const key = terms[0]!.slice(0, 2);
  if (!info.shards[key]) return { products: [], total: 0, page, hasMore: false, catalogSize: info.products };
  const rows = await shard(key);
  const phrase = fold(query.trim());
  const matches: Array<{ row: Row; score: number }> = [];
  for (const row of rows) {
    if (storeMask && !(row[12] & storeMask)) continue;
    const name = fold(row[1]);
    const text = `${name} ${fold(row[2])}`;
    if (!terms.every(term => text.includes(term))) continue;
    const score = (name === phrase ? 100 : name.startsWith(phrase) ? 70 : name.includes(phrase) ? 45 : 20)
      + (row[7] ? 5 : 0) + (row[4] !== null && row[5] !== null && row[6] !== null ? 4 : 0)
      + (row[0].startsWith("590") ? 3 : 0) + Math.min(row[11] / 1e10, 2);
    matches.push({ row, score });
  }
  matches.sort((a, b) => b.score - a.score || a.row[1].localeCompare(b.row[1], "pl"));
  const pageSize = 50;
  const start = (page - 1) * pageSize;
  return { products: matches.slice(start, start + pageSize).map(item => toProduct(item.row)), total: matches.length, page, hasMore: start + pageSize < matches.length, catalogSize: info.products };
}

