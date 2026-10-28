import type { Product } from "./types";
import { safeProductPhoto } from './foodPhotos.ts';
export const FOOD_API = "https://world.openfoodfacts.org";
export const FOOD_FIELDS =
  "code,product_name,product_name_pl,brands,nutriments,nutrition_data_per,quantity,serving_quantity,serving_size,last_modified_t,data_quality_errors_tags,image_front_small_url";
type Raw = Record<string, unknown>;
const numeric = (v: unknown, max: number) =>
  typeof v === "number" && Number.isFinite(v) && v >= 0 && v <= max ? v : null;
export function foodFromOFF(raw: unknown): Product | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Raw;
  const n = r.nutriments as Raw | undefined;
  const code = String(r.code ?? "");
  const name = (typeof r.product_name_pl === 'string' && r.product_name_pl.trim() ? r.product_name_pl : typeof r.product_name === 'string' ? r.product_name : '')
    .trim()
    .slice(0, 160);
  if (!validBarcode(code) || !name || !n) return null;
  const modified = typeof r.last_modified_t === 'number' ? new Date(r.last_modified_t * 1000) : null;
  if (
    Array.isArray(r.data_quality_errors_tags) &&
    r.data_quality_errors_tags.some(
      (t) =>
        typeof t === "string" &&
        /nutrition.*(?:100g|100ml).*energy.*does-not-match/.test(t),
    )
  )
    return null;
  const kcal =
    numeric(n["energy-kcal_100g"], 1000) ??
    (numeric(n.energy_100g, 4184) !== null && n.energy_unit === "kJ"
      ? Number(n.energy_100g) / 4.184
      : null);
  if (kcal === null) return null;
  const kj = numeric(n["energy-kj_100g"], 4184);
  if (kj !== null && Math.abs(kcal - kj / 4.184) > Math.max(10, kcal * 0.12))
    return null;
  return {
    id: `off-${code}`, schemaVersion: 1, updatedAt: new Date().toISOString(),
    name,
    brand: typeof r.brands === 'string' ? r.brands.slice(0, 100) : '',
    barcode: code,
    imageUrl: safeProductPhoto(r.image_front_small_url, code),
    unit: r.nutrition_data_per === "100ml" ? "ml" : "g",
    kcal,
    protein: numeric(n.proteins_100g, 100),
    fat: numeric(n.fat_100g, 100),
    carbs: numeric(n.carbohydrates_100g, 100),
    favorite: false,
    source: "Open Food Facts · dane społecznościowe",
    sourceUrl: `${FOOD_API}/product/${code}`,
    fetchedAt: new Date().toISOString(),
    sourceModified:
      modified && Number.isFinite(modified.getTime())
        ? modified.toISOString()
        : undefined,
    servingSize: String(r.serving_size ?? "").slice(0, 60),
    servingGrams: numeric(r.serving_quantity, 10000) ?? undefined,
  };
}
export function validBarcode(code: string) {
  if (!/^(\d{8}|\d{12}|\d{13}|\d{14})$/.test(code)) return false;
  const digits = [...code].map(Number);
  const check = digits.pop()!;
  const sum = digits.reverse().reduce((s, n, i) => s + n * (i % 2 ? 1 : 3), 0);
  return (10 - (sum % 10)) % 10 === check;
}

