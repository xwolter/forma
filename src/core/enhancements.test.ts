import frames from '../data/exercise-frames.json';
import {existsSync} from 'node:fs';
import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { foodFromOFF, validBarcode, searchFood, searchFoodPage } from "./foodDatabase";
import { plateInventory, remainingCarbs, restingEnergy } from "./calculators";
import { dailyInspiration } from "./daily";
import { spotifyUrl } from "./native";
import {
  clearAll,
  incrementWater,
  loadData,
  seedCatalog,
  validateBackup,
} from "./db";
import foods from "../data/foods-pl.json";
import videos from "../data/exercise-videos.json";
import {
  EXERCISES,
  stamp,
  initialPlans,
  scheduleStarterPlans,
} from "./catalog";

describe("food database safety and conversions", () => {
  it("rejects a product with missing energy; does not fabricate a zero", () =>
    expect(
      foodFromOFF({
        code: "5900531000010",
        product_name: "Serek",
        nutriments: {},
      }),
    ).toBeNull());
  it("keeps missing protein unknown and preserves an explicit zero", () => {
    const p = foodFromOFF({
      code: "5900531000010",
      product_name: "Serek",
      nutriments: { "energy-kcal_100g": 97, fat_100g: 0 },
    })!;
    expect(p.protein).toBeNull();
    expect(p.fat).toBe(0);
    expect(p.unit).toBe("g");
  });
  it("preserves 100 ml when explicitly provided", () =>
    expect(
      foodFromOFF({
        code: "5000112651355",
        product_name: "Napój",
        nutrition_data_per: "100ml",
        nutriments: { "energy-kcal_100g": 42 },
      })?.unit,
    ).toBe("ml"));
  it("rejects upstream nutrition errors and inconsistent kcal/kJ", () => {
    expect(
      foodFromOFF({
        code: "5901939103075",
        product_name: "Skyr",
        nutriments: { "energy-kcal_100g": 22, "energy-kj_100g": 328 },
      }),
    ).toBeNull();
    expect(
      foodFromOFF({
        code: "5901939103075",
        product_name: "Skyr",
        nutriments: { "energy-kcal_100g": 80 },
        data_quality_errors_tags: [
          "en:nutrition-packaging-as-sold-100g-energy-value-in-kcal-does-not-match-value-computed-from-other-nutrients",
        ],
      }),
    ).toBeNull();
  });
  it("rejects invalid, negative, infinite and unrealistic energy", () => {
    for (const energy of [-10, Infinity, NaN, 5000, "42"])
      expect(
        foodFromOFF({
          code: "5900531000010",
          product_name: "Serek",
          nutriments: { "energy-kcal_100g": energy },
        }),
      ).toBeNull();
  });
  it("validates barcode length, digits and checksum", () => {
    expect(validBarcode("5900531000010")).toBe(true);
    expect(validBarcode("5900531000011")).toBe(false);
    expect(validBarcode("javascript:alert(1)")).toBe(false);
  });
  it('survives malformed source timestamps without discarding other search results', () => {
    expect(foodFromOFF({code:'5900531000010', product_name:'Serek', last_modified_t:Infinity, nutriments:{'energy-kcal_100g':97}})?.sourceModified).toBeUndefined();
    expect(foodFromOFF({code:'5900531000010', product_name:{html:'bad'}, nutriments:{'energy-kcal_100g':97}})).toBeNull();
  });
  it("has real distinct imported products, URLs and nutritional ranges", () => {
    expect(foods.length).toBeGreaterThan(250);
    expect(new Set(foods.map((p) => p.barcode)).size).toBe(foods.length);
    for (const p of foods) {
      expect(validBarcode(p.barcode)).toBe(true);
      expect(p.kcal).toBeGreaterThanOrEqual(0);
      expect(p.kcal).toBeLessThanOrEqual(1000);
      expect(p.sourceUrl).toBe(
        `https://world.openfoodfacts.org/product/${p.barcode}`,
      );
    }
  });
  it("loads a later online page without claiming the catalogue is stored on the phone", async () => {
    vi.useFakeTimers();vi.setSystemTime(new Date('2031-01-01'));
    const fetchMock=vi.fn().mockResolvedValue({status:200,ok:true,json:async()=>({page_count:3,count:120,hits:[{code:'5900531000010',product_name:'Serek',brands:['Marka'],nutriments:{'energy-kcal_100g':97}}]})});
    vi.stubGlobal('fetch',fetchMock);
    try{
      const first=await searchFoodPage('serek',1);
      expect(first).toMatchObject({page:1,total:120,hasMore:true});
      expect(first.products).toHaveLength(1);
      expect(first.products[0].brand).toBe('Marka');
      vi.advanceTimersByTime(6600);
      const second=await searchFoodPage('serek',2);
      expect(second.page).toBe(2);
      expect(new URL(fetchMock.mock.calls[1][0],'http://localhost').searchParams.get('page')).toBe('2');
      expect(new URL(fetchMock.mock.calls[1][0],'http://localhost').searchParams.get('page_size')).toBe('50');
    }finally{vi.unstubAllGlobals();vi.useRealTimers();}
  });
  it("handles unavailable and absent products without inventing nutritional values", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2030-01-01"));
    try {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({ status: 503, ok: false }),
      );
      await expect(searchFood("5900531000010")).rejects.toThrow(
        "Baza nie odpowiada",
      );
      vi.advanceTimersByTime(31000);
      vi.stubGlobal(
        "fetch",
        vi
          .fn()
          .mockResolvedValue({
            status: 200,
            ok: true,
            json: async () => ({ status: 0 }),
          }),
      );
      expect(await searchFood("5900531000010")).toEqual([]);
      await expect(searchFood("5900531000010")).rejects.toThrow("Odczekaj kilka sekund");
      vi.advanceTimersByTime(4100);
      vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
      await expect(searchFood("5900531000010")).rejects.toThrow(
        "Zapisane produkty nadal działają",
      );
    } finally {
      vi.unstubAllGlobals();
      vi.useRealTimers();
    }
  });
});
describe("calculators and engagement", () => {
  it("computes the original Mifflin formula with explicit variant", () => {
    expect(restingEnergy(80, 180, 30, "male")).toBeCloseTo(1781.6);
    expect(restingEnergy(80, 180, 30, "female")).toBeCloseTo(1615.6);
  });
  it("does not apply an adult formula outside studied ages or invalid input", () => {
    expect(restingEnergy(80, 180, 16, "male")).toBeNull();
    expect(restingEnergy(NaN, 180, 30, "male")).toBeNull();
  });
  it("does not return negative carbohydrate allowance", () => {
    expect(remainingCarbs(2000, 150, 70)).toBe(192.5);
    expect(remainingCarbs(1000, 200, 100)).toBeNull();
  });
  it("respects finite plate inventory and finds a non-greedy exact combination", () => {
    expect(
      plateInventory(32, 20, [
        { kg: 5, pairs: 1 },
        { kg: 3, pairs: 2 },
      ]),
    ).toEqual({ plates: [3, 3], actual: 32, exact: true });
    expect(plateInventory(100, 20, [{ kg: 20, pairs: 1 }])?.actual).toBe(60);
  });
  it("handles invalid target and zero plate sizes without hanging", () => {
    expect(plateInventory(10, 20, [])).toBeNull();
    expect(plateInventory(40, 20, [{ kg: 0, pairs: 20 }])?.actual).toBe(20);
  });
  it("keeps inspiration stable within a date and rotates images on next day", () => {
    expect(dailyInspiration("2026-10-23")).toEqual(
      dailyInspiration("2026-10-23"),
    );
    expect(dailyInspiration("2026-10-23").image).not.toBe(
      dailyInspiration("2026-10-24").image,
    );
  });
  it("has a specific verified video for every exercise", () => {
    for (const exercise of EXERCISES) {
      const v = videos[exercise.id as keyof typeof videos];
      if(v)expect(v.id).toMatch(/^[a-zA-Z0-9_-]{11}$/);
      else {const id=exercise.demoId??exercise.id;expect(frames.includes(id),exercise.name).toBe(true);for(const f of [0,1])expect(existsSync(`public/exercises/${id}/${f}.jpg`)).toBe(true);}
    }
  });
  it("schedules exactly the training frequency selected at onboarding", () => {
    for (let n = 1; n <= 7; n++) {
      const plans = scheduleStarterPlans(initialPlans(), n);
      expect(new Set(plans.flatMap((p) => p.weekdays)).size).toBe(n);
      expect(plans.flatMap((p) => p.weekdays).length).toBe(n);
    }
  });
  it("rejects malicious or misleading Spotify URLs and removes tracking", () => {
    for (const u of [
      "javascript:alert(1)",
      "https://open.spotify.com.evil.test/playlist/a",
      "https://user:pass@open.spotify.com/genre/workout-page",
    ])
      expect(() => spotifyUrl(u)).toThrow();
    expect(
      spotifyUrl(
        "https://open.spotify.com/playlist/37i9dQZF1DX76Wlfdnj7AP?si=tracking",
      ),
    ).toBe("https://open.spotify.com/playlist/37i9dQZF1DX76Wlfdnj7AP");
  });
});
describe("persistence under repeated use", () => {
  beforeEach(async () => {
    await clearAll();
    await seedCatalog();
  });
  it("records all rapid water taps atomically", async () => {
    await Promise.all(
      Array.from({ length: 10 }, () => incrementWater("2026-10-23")),
    );
    expect((await loadData()).daily[0].water).toBe(2500);
  });
  it("does not duplicate the imported catalog on next launch", async () => {
    await seedCatalog();
    const d = await loadData();
    expect(d.products.filter((p) => p.id.startsWith("off-")).length).toBe(
      foods.length,
    );
  });
  it("rejects malformed text fields and invalid real calendar dates in backups", async () => {
    const d = await loadData();
    d.profiles = [
      {
        ...stamp("me"),
        name: "Test",
        height: null,
        age: null,
        goal: "maintain",
        days: 3,
        equipmentId: "gym",
        theme: "light",
        waterGoal: null,
        haptics: true,
        timerSound: false,
        notifications: false,
        demo: false,
      },
    ];
    expect(() =>
      validateBackup({ format: "forma-backup", version: 1, data: d }),
    ).not.toThrow();
    const invalid = structuredClone(d) as unknown as {
      products: Record<string, unknown>[];
    };
    invalid.products[0].source = { bad: "HTML" };
    expect(() =>
      validateBackup({ format: "forma-backup", version: 1, data: invalid }),
    ).toThrow();
    d.daily = [
      {
        ...stamp("2026-02-31"),
        date: "2026-02-31",
        water: 250,
        complete: false,
        energy: null,
        sleep: null,
      },
    ];
    expect(() =>
      validateBackup({ format: "forma-backup", version: 1, data: d }),
    ).toThrow();
  });
  it("rejects invalid plan rep ranges before replacing any saved data", async () => {
    const d = await loadData();
    d.plans[0].exercises[0].min = 50;
    d.plans[0].exercises[0].max = 5;
    expect(() =>
      validateBackup({ format: "forma-backup", version: 1, data: d }),
    ).toThrow("ćwiczenia");
    expect((await loadData()).plans[0].exercises[0].min).not.toBe(50);
  });
});
