import { registerPlugin, type PluginListenerHandle } from "@capacitor/core";
import { isNative } from "./native";
import { safeProductPhoto } from "./foodPhotos";
import type { Product } from "./types";

type RawProduct = { code: string; name: string; brand: string; kcal: number | null; protein: number | null; fat: number | null; carbs: number | null; photo: string; serving: string; servingGrams: number | null; modified: number };
type Status = { available: boolean; version?: string; bytes: number; products?: number; withCalories?: number };
export type CatalogOffer = { schema: number; version: string; url: string; bytes: number; databaseBytes: number; products: number; withCalories: number; sha256: string; installed: Status };
type NativeCatalog = {
  status(): Promise<Status>;
  check(): Promise<CatalogOffer>;
  download(): Promise<Status>;
  cancel(): Promise<void>;
  search(options: { query: string; page: number; storeMask: number }): Promise<{ products: RawProduct[]; page: number; hasMore: boolean }>;
  barcode(options: { code: string }): Promise<{ found: boolean; product?: RawProduct }>;
  addListener(event: "progress", listener: (value: { received: number; total: number }) => void): Promise<PluginListenerHandle>;
};
const nativeCatalog = registerPlugin<NativeCatalog>("FormaFoodCatalog");
const amount = (value: number | null, max: number) => typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= max ? value : null;

function product(raw: RawProduct): Product | null {
  if (!/^(\d{8}|\d{12}|\d{13}|\d{14})$/.test(raw.code) || !raw.name.trim()) return null;
  const kcal = amount(raw.kcal, 1000);
  if (kcal === null) return null;
  const now = new Date().toISOString();
  return {
    id: `off-${raw.code}`, schemaVersion: 1, updatedAt: now, name: raw.name.slice(0, 160),
    brand: raw.brand.slice(0, 100), barcode: raw.code, imageUrl: safeProductPhoto(raw.photo, raw.code),
    unit: "g", kcal, protein: amount(raw.protein, 100), fat: amount(raw.fat, 100), carbs: amount(raw.carbs, 100),
    favorite: false, source: "Open Food Facts · dane społecznościowe",
    sourceUrl: `https://world.openfoodfacts.org/product/${raw.code}`, fetchedAt: now,
    sourceModified: raw.modified > 0 ? new Date(raw.modified * 1000).toISOString() : undefined,
    servingSize: raw.serving.slice(0, 60), servingGrams: amount(raw.servingGrams, 10000) ?? undefined,
  };
}

export async function catalogStatus(): Promise<Status> {
  return isNative ? nativeCatalog.status() : { available: false, bytes: 0 };
}
export async function catalogOffer(): Promise<CatalogOffer> {
  if (!isNative) throw new Error("Pełny katalog można pobrać w aplikacji Android.");
  return nativeCatalog.check();
}
export async function downloadCatalog(progress: (received: number, total: number) => void): Promise<Status> {
  if (!isNative) throw new Error("Pełny katalog można pobrać w aplikacji Android.");
  const listener = await nativeCatalog.addListener("progress", value => progress(value.received, value.total));
  try { return await nativeCatalog.download(); }
  finally { await listener.remove(); }
}
export async function cancelCatalogDownload(): Promise<void> { if (isNative) await nativeCatalog.cancel(); }
export async function searchNativeCatalog(query: string, page = 1, storeMask = 0) {
  if (!isNative) return null;
  const result = await nativeCatalog.search({ query, page, storeMask });
  return { products: result.products.map(product).filter((item): item is Product => item !== null), page, hasMore: result.hasMore };
}
export async function findNativeBarcode(code: string): Promise<{ product: Product | null; incomplete: boolean } | null> {
  if (!isNative) return null;
  const result = await nativeCatalog.barcode({ code });
  if (!result.found || !result.product) return { product: null, incomplete: false };
  const found = product(result.product);
  return { product: found, incomplete: found === null };
}
