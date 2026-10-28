import { CapacitorHttp } from "@capacitor/core";
import { version as appVersion } from "../../package.json";
import { isNative } from "./native";
import type { Product } from "./types";

import { FOOD_API, FOOD_FIELDS, foodFromOFF, validBarcode } from "./offProduct";
export { foodFromOFF, validBarcode } from "./offProduct";
type Raw = Record<string, unknown>;
let lastSearch = 0;
let lastBarcode = 0;
let unavailableUntil = 0;
async function request(path: string) {
  if (Date.now() < unavailableUntil)
    throw new Error(
      "Baza jest chwilowo niedostępna. Spróbuj za pół minuty lub dodaj dane z etykiety.",
    );
  let status: number, data: unknown;
  try {
    const url = FOOD_API + path;
    if (isNative) {
      const r = await CapacitorHttp.get({
        url,
        headers: {
          "User-Agent": `FORMA/${appVersion} (Android nutrition diary)`,
          Accept: "application/json",
        },
        connectTimeout: 12000,
        readTimeout: 12000,
        responseType: "json",
      });
      status = r.status;
      data = r.data;
    } else {
      const r = await fetch(url, {
        headers: { "X-User-Agent": `FORMA/${appVersion} (Android nutrition diary)` },
        signal: AbortSignal.timeout(12000),
      });
      status = r.status;
      data = r.ok ? await r.json() : null;
    }
  } catch {
    throw new Error(
      "Nie udało się połączyć z bazą. Zapisane produkty nadal działają. Możesz wpisać etykietę ręcznie.",
    );
  }
  if (status === 404) return null;
  if (status !== 200) {
    unavailableUntil = Date.now() + 30000;
    throw new Error(
      "Baza nie odpowiada. Użyj zapisanych produktów lub danych z etykiety.",
    );
  }
  return data as Raw | null;
}
export type FoodSearchPage={products:Product[];total:number;page:number;hasMore:boolean};
const SEARCH_API = "https://search.openfoodfacts.org";
async function indexedSearch(query: string, page: number): Promise<FoodSearchPage> {
  const params = new URLSearchParams({q:query,page:String(page),page_size:"50",fields:FOOD_FIELDS});
  const path = `/search?${params}`;
  let status: number;
  let raw: Raw;
  if (isNative) {
    const response = await CapacitorHttp.get({
      url: SEARCH_API + path,
      headers: {"User-Agent":`FORMA/${appVersion} (Android nutrition diary)`,Accept:"application/json"},
      connectTimeout: 12000,
      readTimeout: 12000,
      responseType: "json",
    });
    status = response.status;
    raw = response.data as Raw;
  } else {
    const response = await fetch(import.meta.env.DEV ? `/off-search${path}` : SEARCH_API + path, {
      headers: {"X-User-Agent":`FORMA/${appVersion} (Android nutrition diary)`},
      signal: AbortSignal.timeout(12000),
    });
    status = response.status;
    raw = response.ok ? await response.json() as Raw : {};
  }
  if (status !== 200 || !Array.isArray(raw?.hits)) throw new Error("Wyszukiwarka chwilowo nie odpowiada.");
  const products = raw.hits
    .map(hit => {
      if (!hit || typeof hit !== "object") return null;
      const item = hit as Raw;
      return foodFromOFF({...item, brands:Array.isArray(item.brands) ? item.brands.filter(v=>typeof v==="string").join(", ") : item.brands});
    })
    .filter((product): product is Product => product !== null);
  const pages = typeof raw.page_count === "number" && Number.isFinite(raw.page_count) ? raw.page_count : page;
  const total = typeof raw.count === "number" && Number.isFinite(raw.count) && raw.count >= 0 ? raw.count : pages*50;
  return {products,total,page,hasMore:page<pages};
}
export async function searchFoodPage(query: string,page=1): Promise<FoodSearchPage> {
  const q = query.trim();
  if (q.length < 2 || q.length > 100)
    throw new Error("Wpisz od 2 do 100 znaków.");
  if (!Number.isInteger(page) || page < 1 || page > 10000)
    throw new Error("Nieprawidłowa strona wyników.");
  if (/^[\d\s]+$/.test(q)) {
    if(page!==1)return {products:[],total:0,page,hasMore:false};
    const code = q.replaceAll(" ", "");
    if (!validBarcode(code))
      throw new Error(
        "Sprawdź kod kreskowy - liczba cyfr lub cyfra kontrolna jest nieprawidłowa.",
      );
    if (Date.now() - lastBarcode < 4100)
      throw new Error("Odczekaj kilka sekund przed kolejnym skanowaniem.");
    lastBarcode = Date.now();
    const r = await request(`/api/v2/product/${code}?fields=${FOOD_FIELDS}`);
    const p = foodFromOFF(r?.product);
    return {products:p?[p]:[],total:p?1:0,page,hasMore:false};
  }
  if (Date.now() - lastSearch < 6500)
    throw new Error("Odczekaj kilka sekund przed kolejnym wyszukiwaniem.");
  lastSearch = Date.now();
  if (isNative || import.meta.env.DEV) {
    try { return await indexedSearch(q,page); } catch { /* Legacy catalogue stays available when the search index is down. */ }
  }
  const params = new URLSearchParams({
    search_terms: q,
    search_simple: "1",
    action: "process",
    json: "1",
    page_size: "50",
    page: String(page),
    fields: FOOD_FIELDS,
  });
  const r = await request(`/cgi/search.pl?${params}`);
  const products=Array.isArray(r?.products)
    ? r.products.map(foodFromOFF).filter((p): p is Product => p !== null)
    : [];
  const total=typeof r?.count==='number'&&Number.isFinite(r.count)&&r.count>=0?r.count:page*50;
  return {products,total,page,hasMore:page*50<total&&Array.isArray(r?.products)&&r.products.length>0};
}
export async function searchFood(query:string):Promise<Product[]>{return (await searchFoodPage(query)).products;}

