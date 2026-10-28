import {resultMetric,resultLimit} from './exerciseMetrics';
import { openDB } from "idb";
import { EXERCISES, initialPlans, initialProducts, stamp } from "./catalog";
import type { AppData, Media, TableName, Tables, WorkoutSet } from "./types";
import importedFoods from "../data/foods-pl.json";
import usdaFoods from "../data/foods-usda.json";
import legacyFoods from '../data/foods-usda-legacy.json';
import type { Product } from "./types";
import { dayNumber } from "./streaks";
import { validPhotoKey, safeProductPhoto } from './foodPhotos';
import { validFoodImage } from './foodImage';
import previousCatalog from '../data/food-catalog-previous.json';

export const TABLES: TableName[] = [
  "profiles",
  "goals",
  "equipment",
  "plans",
  "sessions",
  "sets",
  "products",
  "food",
  "recipes",
  "measurements",
  "daily",
  "activities",
];
export const emptyData = (): AppData => ({
  profiles: [],
  goals: [],
  equipment: [],
  plans: [],
  sessions: [],
  sets: [],
  products: [],
  food: [],
  recipes: [],
  measurements: [],
  daily: [],
  activities: [],
});
export const dbPromise = openDB("forma-v1", 1, {
  upgrade(db) {
    for (const table of TABLES) db.createObjectStore(table, { keyPath: "id" });
    db.createObjectStore("media", { keyPath: "id" });
    db.createObjectStore("meta");
  },
});
export async function loadData(): Promise<AppData> {
  const db = await dbPromise;
  const tx = db.transaction(TABLES, "readonly");
  const rows = await Promise.all(TABLES.map((t) => tx.objectStore(t).getAll()));
  await tx.done;
  return Object.fromEntries(TABLES.map((t, i) => [t, rows[i]])) as AppData;
}
export type Mutation =
  | { table: TableName; value: Tables[TableName] }
  | { table: TableName; remove: string };
export async function commit(operations: Mutation[]) {
  const db = await dbPromise;
  const tx = db.transaction(
    [...new Set(operations.map((o) => o.table))],
    "readwrite",
  );
  for (const op of operations) {
    if ("remove" in op) await tx.objectStore(op.table).delete(op.remove);
    else await tx.objectStore(op.table).put(op.value);
  }
  await tx.done;
}
export async function incrementWater(date: string, amount = 250) {
  if (dayNumber(date) === null || !Number.isFinite(amount) || !Number.isInteger(amount) || Math.abs(amount) > 100000) throw new Error('Wpisz poprawną ilość wody.');
  const db = await dbPromise;
  const tx = db.transaction("daily", "readwrite");
  const previous = await tx.store.get(date);
  const next = {
    ...stamp(date),
    date,
    complete: false,
    energy: null,
    sleep: null,
    water: 0,
    ...previous,
  };
  const before = next.water;
  next.water = Math.min(100000, Math.max(0, next.water + amount));
  next.updatedAt = new Date().toISOString();
  await tx.store.put(next);
  await tx.done;
  return next.water - before;
}
export async function setWater(date: string, amount: number) {
  if (dayNumber(date) === null || !Number.isInteger(amount) || amount < 0 || amount > 100000) throw new Error('Wpisz ilość od 0 do 100 000 ml.');
  const db = await dbPromise;
  const tx = db.transaction('daily', 'readwrite');
  const previous = await tx.store.get(date);
  const before = previous?.water ?? 0;
  await tx.store.put({...stamp(date), date, complete:false, energy:null, sleep:null, ...previous, water:amount, updatedAt:new Date().toISOString()});
  await tx.done;
  return before;
}
export async function updateDaily(date: string, patch: Partial<Pick<Tables['daily'], 'appOpened' | 'complete'>>) {
  if (dayNumber(date) === null) throw new Error("Nieprawidłowy dzień.");
  const db = await dbPromise;
  const tx = db.transaction("daily", "readwrite");
  const previous = await tx.store.get(date);
  const changed = Object.entries(patch).some(([key, value]) => previous?.[key] !== value);
  if (changed) await tx.store.put({
    ...stamp(date), date, water: 0, energy: null, sleep: null, complete: false,
    ...previous, ...patch, updatedAt: new Date().toISOString(),
  });
  await tx.done;
  return changed;
}
export async function seedCatalog() {
  const db = await dbPromise;
  // Queue catalog writes together. Awaiting each of 10,000 reads/writes makes
  // first launch unnecessarily slow on an Android WebView.
  const seedProducts = async (key: string, products: Product[]) => {
    if (await db.get('meta', key)) return;
    const tx = db.transaction(['products', 'meta'], 'readwrite');
    const existing = new Set(await tx.objectStore('products').getAllKeys());
    for (const product of products) if (!existing.has(product.id)) void tx.objectStore('products').put(product);
    void tx.objectStore('meta').put(true, key);
    await tx.done;
  };
  await seedProducts('usda-sr-legacy-2018-v1', legacyFoods as Product[]);
  await seedProducts('usda-fndds-2021-2023-pl-v1', usdaFoods as Product[]);
  await seedProducts('foods-pl-2026-10-v3', importedFoods as Product[]);
  if (!(await db.get('meta','food-labels-photos-pl-v4'))) {
    const tx=db.transaction(['products','meta'],'readwrite');
    const previous=new Map<string,Set<string>>();for(const p of previousCatalog){if(!previous.has(p.id))previous.set(p.id,new Set());previous.get(p.id)!.add(p.name);}
    const current=new Map([...legacyFoods,...importedFoods].map(p=>[p.id,p as Product]));
    const saved=await tx.objectStore('products').getAll() as Product[];
    for(const old of saved){
      const next=current.get(old.id);if(!next||old.source!==next.source)continue;
      const intermediateEgg=/^Jajko · całe · po obróbce cieplnej · (?:jajecznica|omlet|smażone)$/.test(old.name);
      if(old.id.startsWith('usda-')&&(previous.get(old.id)?.has(old.name)||intermediateEgg))void tx.objectStore('products').put({...old,name:next.name,tags:next.tags,kind:next.kind});
      else if(old.id.startsWith('off-')&&!old.imageUrl&&next.imageUrl)void tx.objectStore('products').put({...old,imageUrl:next.imageUrl});
    }
    void tx.objectStore('meta').put(true,'food-labels-photos-pl-v4');await tx.done;
  }
  if (!(await db.get("meta", "food-quality-2026-10-v2"))) {
    const tx = db.transaction(["products", "meta"], "readwrite");
    for (const code of [
      "5901939103075",
      "5900512350080",
      "5901044021875",
      "5900102028382",
    ]) {
      const p = await tx.objectStore("products").get(`off-${code}`);
      // Only remove unchanged upstream entries; historical diary snapshots stay intact.
      if (p?.source === "Open Food Facts · dane społecznościowe")
        await tx.objectStore("products").delete(`off-${code}`);
    }
    await tx.objectStore("meta").put(true, "food-quality-2026-10-v2");
    await tx.done;
  }
  if (await db.get("meta", "catalog-v1")) return;
  await commit([
    ...initialProducts().map((value) => ({
      table: "products" as const,
      value,
    })),
    ...initialPlans().map((value) => ({ table: "plans" as const, value })),
    {
      table: "equipment",
      value: {
        ...stamp("gym"),
        name: "Moja siłownia",
        types: [
          "Sztanga",
          "Hantle",
          "Maszyna",
          "Wyciąg",
          "Masa ciała",
          "Drążek",
          "Kettlebell",
          "Kółko",
        ],
        step: 2.5,
        notes: "",
      },
    },
  ]);
  await db.put("meta", true, "catalog-v1");
}
export const getMedia = async (
  exerciseId: string,
): Promise<Media | undefined> => (await dbPromise).get("media", exerciseId);
export const saveMedia = async (exerciseId: string, file: File) => {
  if (file.size > 50 * 1024 * 1024)
    throw new Error("Wybierz film mniejszy niż 50 MB.");
  if (!file.type.startsWith("video/")) throw new Error("Wybierz plik wideo.");
  await (
    await dbPromise
  ).put("media", {
    ...stamp(exerciseId),
    exerciseId,
    blob: file,
    name: file.name,
    mime: file.type,
  });
};
export const removeMedia = async (exerciseId: string) =>
  (await dbPromise).delete("media", exerciseId);
export async function clearAll() {
  const db = await dbPromise;
  const tx = db.transaction([...TABLES, "media", "meta"], "readwrite");
  for (const t of [...TABLES, "media", "meta"]) await tx.objectStore(t).clear();
  await tx.done;
}

export function validateBackup(input: unknown): AppData {
  if (
    !input ||
    typeof input !== "object" ||
    !("format" in input) ||
    input.format !== "forma-backup" ||
    !("version" in input) ||
    input.version !== 1 ||
    !("data" in input)
  )
    throw new Error("To nie jest obsługiwana kopia FORMA.");
  const data = input.data as AppData;
  const isDate = (s: unknown) =>
    typeof s === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(s) &&
    !Number.isNaN(Date.parse(s)) &&
    new Date(s).toISOString().slice(0, 10) === s;
  const nonnegative = (v: unknown) =>
    typeof v === "number" && Number.isFinite(v) && v >= 0;
  const checkNutrients = (r: Record<string, unknown>) =>
    nonnegative(r.kcal) &&
    ["protein", "fat", "carbs"].every(
      (k) => r[k] === null || nonnegative(r[k]),
    );
  const knownExercise = (id: unknown) =>
    typeof id === "string" && EXERCISES.some((e) => e.id === id);
  const validSlots = (items: unknown) =>
    Array.isArray(items) &&
    items.length <= 80 &&
    items.every(
      (s) =>
        s &&
        typeof s.id === "string" &&
        knownExercise(s.exerciseId) &&
        Number.isInteger(s.sets) &&
        s.sets >= 1 &&
        s.sets <= 20 &&
        typeof s.notes === "string" &&
        s.notes.length <= 10000 &&
        ['group','tempo','target'].every(k=>s[k]===undefined||(typeof s[k]==='string'&&s[k].length<=100)) &&
        (s.metric===undefined||['reps','seconds','distance'].includes(s.metric)) &&
        (s.restBetween===undefined||(Number.isInteger(s.restBetween)&&s.restBetween>=0&&s.restBetween<=1800)) &&
        (s.weeklySets===undefined||(Array.isArray(s.weeklySets)&&s.weeklySets.length===5&&s.weeklySets.every((n:unknown)=>typeof n==='number'&&Number.isInteger(n)&&n>=1&&n<=20))) &&
        (s.warmupRest === undefined ||
          (Number.isInteger(s.warmupRest) &&
            s.warmupRest >= 0 &&
            s.warmupRest <= 1800)) &&
        Number.isFinite(s.rest) &&
        s.rest >= 0 &&
        s.rest <= 3600 &&
        Number.isInteger(s.min) &&
        s.min >= 1 &&
        Number.isInteger(s.max) &&
        s.max >= s.min &&
        s.max <= resultLimit(resultMetric(s)) &&
        (s.rir === null ||
          (typeof s.rir === "number" && s.rir >= 0 && s.rir <= 10)),
    );
  for (const t of TABLES) {
    if (!Array.isArray(data?.[t]) || data[t].length > 100000)
      throw new Error(`Nieprawidłowa sekcja kopii: ${t}.`);
    const seen = new Set<string>();
    for (const item of data[t]) {
      const r = item as unknown as Record<string, unknown>;
      if (
        !r ||
        typeof r.id !== "string" ||
        r.id.length > 150 ||
        typeof r.updatedAt !== "string" ||
        r.schemaVersion !== 1 ||
        seen.has(r.id)
      )
        throw new Error("Kopia zawiera nieprawidłowe lub powtórzone rekordy.");
      seen.add(r.id);
      for (const key of [
        "name",
        "note",
        "notes",
        "brand",
        "source",
        "sourceUrl",
        "originalName",
        "searchTerms",
        "barcode",
        "meal",
        "subtitle",
        "equipmentName",
        "mood",
        "timezone",
      ]) {
        if (
          key in r &&
          (typeof r[key] !== "string" || (r[key] as string).length > 10000)
        )
          throw new Error("Nieprawidłowy tekst w kopii.");
      }
      if(t==='products' && ((r.kind!==undefined&&!['basic','dish','packaged'].includes(String(r.kind)))||(r.tags!==undefined&&(!Array.isArray(r.tags)||r.tags.length>20||r.tags.some(x=>typeof x!=='string'||x.length>60)))))throw new Error('Nieprawidłowa kategoria produktu.');
      if ((t==='products'||t==='recipes') && r.photoKey!==undefined && !validPhotoKey(r.photoKey)) throw new Error('Nieprawidłowy obraz jedzenia.');
      if ((t==='products'||t==='recipes') && r.photoData!==undefined && !validFoodImage(r.photoData)) throw new Error('Nieprawidłowe własne zdjęcie jedzenia.');
      if(t==='products' && r.imageUrl!==undefined && !safeProductPhoto(r.imageUrl,String(r.barcode??''))) throw new Error('Nieprawidłowe zdjęcie produktu.');
      if(t==='plans'&&((r.program!==undefined&&(typeof r.program!=='string'||r.program.length>100))||(r.cardio!==undefined&&(typeof r.cardio!=='string'||r.cardio.length>2000))||(r.programWeek!==undefined&&(!Number.isInteger(r.programWeek)||Number(r.programWeek)<1||Number(r.programWeek)>5))))throw new Error('Nieprawidłowy program treningowy.');
      if(t==='sets'&&r.metric!==undefined&&!['reps','seconds','distance'].includes(String(r.metric)))throw new Error('Nieprawidłowa jednostka serii.');
      if(t==='sessions'&&r.lastActiveAt!==undefined&&(typeof r.lastActiveAt!=='number'||!Number.isFinite(r.lastActiveAt)||r.lastActiveAt<0))throw new Error('Nieprawidłowy czas sesji.');
      if (
        t === "profiles" &&
        (typeof r.demo !== "boolean" ||
          typeof r.haptics !== "boolean" ||
          typeof r.notifications !== "boolean" ||
          typeof r.timerSound !== "boolean" ||
          typeof r.equipmentId !== "string" ||
          !Number.isInteger(r.days) ||
          Number(r.days) < 1 ||
          Number(r.days) > 7)
      )
        throw new Error("Nieprawidłowe ustawienia profilu.");
      if (
        t === "daily" &&
        (typeof r.complete !== "boolean" || Number(r.water) > 100000)
      )
        throw new Error("Nieprawidłowy dziennik dnia.");
      if (
        t === "plans" &&
        (!Array.isArray(r.weekdays) ||
          r.weekdays.some((x) => !Number.isInteger(x) || x < 0 || x > 6))
      )
        throw new Error("Nieprawidłowe dni planu.");
      if (
        t === "sets" &&
        (!Number.isInteger(r.reps) ||
          Number(r.reps) > resultLimit(resultMetric(r as unknown as WorkoutSet)) ||
          Number(r.weight) > 2000 ||
          !Number.isInteger(r.index) ||
          Number(r.index) < 0 ||
          Number(r.index) > 100 ||
          !["work", "warmup", "assisted"].includes(String(r.type)) ||
          ![
            "barbell",
            "dumbbell",
            "machine",
            "bodyweight",
            "assistance",
          ].includes(String(r.loadType)) ||
          (r.rir !== null && (!nonnegative(r.rir) || Number(r.rir) > 10)))
      )
        throw new Error("Nieprawidłowe wartości serii.");
      if (
        ("name" in r && typeof r.name !== "string") ||
        ("note" in r && typeof r.note !== "string")
      )
        throw new Error("Nieprawidłowy opis w kopii.");
      if (
        t === "equipment" &&
        (!Array.isArray(r.types) ||
          r.types.some((v) => typeof v !== "string") ||
          !nonnegative(r.step) ||
          Number(r.step) <= 0)
      )
        throw new Error("Nieprawidłowy profil sprzętu.");
      if (t === "equipment" && r.exerciseNotes !== undefined) {
        const notes = r.exerciseNotes;
        if (
          !notes ||
          typeof notes !== "object" ||
          Array.isArray(notes) ||
          Object.keys(notes).length > 80 ||
          Object.entries(notes).some(
            ([id, v]) =>
              !knownExercise(id) || typeof v !== "string" || v.length > 1500,
          )
        )
          throw new Error("Nieprawidłowe notatki ćwiczeń.");
      }
      if (t === "sets" && r.draft !== undefined) {
        const draft = r.draft;
        if (
          !draft ||
          typeof draft !== "object" ||
          Array.isArray(draft) ||
          Object.keys(draft).sort().join(",") !== "reps,rir,weight" ||
          Object.values(draft).some(
            (v) => typeof v !== "string" || v.length > 12,
          )
        )
          throw new Error("Nieprawidłowy szkic serii.");
      }
      if (t === "plans" && !validSlots(r.exercises))
        throw new Error("Nieprawidłowe ćwiczenia w planie.");
      if (
        t === "sessions" &&
        (!validSlots(
          (r.planSnapshot as { exercises: unknown } | undefined)?.exercises,
        ) ||
          typeof (r.planSnapshot as { name: unknown } | undefined)?.name !==
            "string" ||
          !nonnegative(r.startedAt) ||
          !nonnegative(r.pausedMs))
      )
        throw new Error("Nieprawidłowa migawka treningu.");
      if (
        t === "sets" &&
        (!knownExercise(r.exerciseId) ||
          typeof r.done !== "boolean" ||
          typeof r.skipped !== "boolean")
      )
        throw new Error("Nieprawidłowy stan serii.");
      if (
        t === "recipes" &&
        (!Array.isArray(r.ingredients) ||
          r.ingredients.some(
            (i) =>
              !i ||
              typeof i.name !== "string" ||
              !nonnegative(i.grams) ||
              !i.nutrients ||
              !checkNutrients(i.nutrients),
          ))
      )
        throw new Error("Nieprawidłowy składnik przepisu.");
      if (
        t === "profiles" &&
        (typeof r.name !== "string" ||
          !["dark", "light"].includes(String(r.theme)) ||
          !nonnegative(r.days))
      )
        throw new Error("Nieprawidłowy profil.");
      if (
        t === "products" &&
        (typeof r.name !== "string" ||
          !checkNutrients(r) ||
          !["g", "ml"].includes(String(r.unit)))
      )
        throw new Error("Nieprawidłowy produkt.");
      if (
        t === "goals" &&
        (!isDate(r.effectiveFrom) ||
          !checkNutrients(r) ||
          Number(r.kcal) <= 0 ||
          Number(r.kcal) > 15000)
      )
        throw new Error("Nieprawidłowy cel.");
      if (
        t === "food" &&
        (!isDate(r.date) ||
          !nonnegative(r.grams) ||
          !r.nutrients ||
          !checkNutrients(r.nutrients as Record<string, unknown>) ||
          !["consumed", "planned"].includes(String(r.status)))
      )
        throw new Error("Nieprawidłowy wpis jedzenia.");
      if (
        t === "measurements" &&
        (!isDate(r.date) || !nonnegative(r.value) || Number(r.value) <= 0)
      )
        throw new Error("Nieprawidłowy pomiar.");
      if (
        t === "plans" &&
        (!Array.isArray(r.exercises) ||
          r.exercises.length > 80 ||
          typeof r.name !== "string" ||
          !Array.isArray(r.weekdays))
      )
        throw new Error("Nieprawidłowy plan.");
      if (
        t === "sessions" &&
        (!isDate(r.date) ||
          !r.planSnapshot ||
          !Array.isArray(
            (r.planSnapshot as { exercises: unknown }).exercises,
          ) ||
          !["active", "paused", "finished", "abandoned"].includes(
            String(r.status),
          ))
      )
        throw new Error("Nieprawidłowy trening.");
      if (
        t === "sets" &&
        (!nonnegative(r.weight) ||
          !nonnegative(r.reps) ||
          typeof r.sessionId !== "string" ||
          typeof r.exerciseId !== "string")
      )
        throw new Error("Nieprawidłowa seria.");
      if (t === "daily" && (!isDate(r.date) || !nonnegative(r.water) || (r.appOpened !== undefined && typeof r.appOpened !== 'boolean')))
        throw new Error("Nieprawidłowy dziennik dnia.");
      if (t === "activities" && (!isDate(r.date) || !nonnegative(r.minutes)))
        throw new Error("Nieprawidłowa aktywność.");
      if (
        t === "recipes" &&
        (!Array.isArray(r.ingredients) ||
          !nonnegative(r.cookedWeight) ||
          Number(r.cookedWeight) <= 0 ||
          !r.nutrients ||
          !checkNutrients(r.nutrients as Record<string, unknown>))
      )
        throw new Error("Nieprawidłowy przepis.");
    }
  }
  if (
    data.profiles.length !== 1 ||
    data.equipment.length === 0 ||
    data.sessions.filter((s) => s.status === "active" || s.status === "paused")
      .length > 1
  )
    throw new Error(
      "Kopia zawiera więcej niż jeden profil lub aktywny trening.",
    );
  if (
    !data.equipment.some((e) => e.id === data.profiles[0].equipmentId) ||
    data.sets.some((s) => !data.sessions.some((v) => v.id === s.sessionId))
  )
    throw new Error("Kopia nie zawiera wymaganych powiązanych danych.");
  return data;
}
export async function restoreBackup(data: AppData, media: Media[] = []) {
  const db = await dbPromise;
  const tx = db.transaction([...TABLES, "media"], "readwrite");
  for (const t of TABLES) {
    await tx.objectStore(t).clear();
    if(t==='products')for(const p of builtinProducts.values())await tx.objectStore(t).put(p);
    for (const r of data[t]) await tx.objectStore(t).put(r);
  }
  await tx.objectStore("media").clear();
  for (const item of media) await tx.objectStore("media").put(item);
  await tx.done;
}

const builtinProducts=new Map<string,Product>([...initialProducts(),...importedFoods,...usdaFoods,...legacyFoods].map(p=>[p.id,p as Product]));
/** A backup carries personal additions, favourites and corrections, not 10k immutable reference rows. */
export function backupData(data:AppData):AppData {
 return {...data,products:data.products.filter(p=>{
  const ref=builtinProducts.get(p.id);if(!ref)return true;
  const keys=new Set([...Object.keys(ref),...Object.keys(p)]);keys.delete('updatedAt');keys.delete('fetchedAt');
  return [...keys].some(k=>JSON.stringify(p[k as keyof Product])!==JSON.stringify(ref[k as keyof Product]));
 })};
}
