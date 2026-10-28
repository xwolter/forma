import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import {
  dayTotals,
  externalVolume,
  goalForDate,
  numberInput,
  plates,
  progression,
  recipePer100,
  scaleNutrients,
  sessionSeconds,
  sumNutrients,
  weightTrend,
} from "./math";
import { beginSession, completeSet, makeSets } from "./workouts";
import {
  clearAll,
  commit,
  emptyData,
  loadData,
  seedCatalog,
  validateBackup,
} from "./db";
import { initialPlans, stamp } from "./catalog";
import type {
  FoodEntry,
  Goal,
  Measurement,
  Nutrients,
  Session,
  WorkoutSet,
} from "./types";

const nutrient: Nutrients = { kcal: 200, protein: 10, fat: 5, carbs: 25 };
const food = (change: Partial<FoodEntry> = {}): FoodEntry => ({
  ...stamp(),
  date: "2026-10-23",
  meal: "Obiad",
  name: "Test",
  brand: "",
  productId: null,
  recipeVersion: null,
  grams: 150,
  unit: "g",
  nutrients: nutrient,
  status: "consumed",
  quick: false,
  ...change,
});
describe("Żywienie - warunki odbioru briefu", () => {
  it("T01: 200 kcal / 100 g i 150 g daje 300 kcal", () =>
    expect(dayTotals([food()], "2026-10-23").kcal).toBe(300));
  it("T02: edycja tego samego wpisu zmniejsza dzień o 100 kcal", async () => {
    await commit([{ table: "food", value: food({ id: "one" }) }]);
    await commit([{ table: "food", value: food({ id: "one", grams: 100 }) }]);
    const d = await loadData();
    expect(d.food).toHaveLength(1);
    expect(dayTotals(d.food, "2026-10-23").kcal).toBe(200);
  });
  it("T03: 1000 kcal / 800 g, porcja 200 g = 250 kcal", () => {
    const per100 = recipePer100({ ...nutrient, kcal: 1000 }, 800);
    expect(scaleNutrients(per100, 2).kcal).toBe(250);
  });
  it("T04: szybki wpis zachowuje brak makro jako null", () => {
    const n = dayTotals(
      [
        food({
          quick: true,
          grams: 1,
          nutrients: { kcal: 320, protein: null, fat: null, carbs: null },
        }),
      ],
      "2026-10-23",
    );
    expect(n).toEqual({ kcal: 320, protein: null, fat: null, carbs: null });
  });
  it("Zaplanowane jedzenie nie zwiększa spożycia", () =>
    expect(dayTotals([food({ status: "planned" })], "2026-10-23").kcal).toBe(
      0,
    ));
  it("Brak wpisów różni się od niepełnego makro", () => {
    expect(dayTotals([], "2026-10-23").protein).toBe(0);
    expect(
      sumNutrients([{ ...nutrient, protein: null }, nutrient]).protein,
    ).toBeNull();
  });
  it("Nie zaokrągla składników przed sumowaniem", () =>
    expect(
      sumNutrients([
        scaleNutrients(nutrient, 0.333),
        scaleNutrients(nutrient, 0.333),
        scaleNutrients(nutrient, 0.334),
      ]).kcal,
    ).toBeCloseTo(200, 9));
  it("T09: nowy cel od jutra nie zmienia wcześniejszych dni", () => {
    const goals: Goal[] = [
      {
        ...stamp("old"),
        ...nutrient,
        kcal: 2400,
        method: "manual",
        effectiveFrom: "2026-10-01",
      },
      {
        ...stamp("new"),
        ...nutrient,
        kcal: 2500,
        method: "manual",
        effectiveFrom: "2026-10-24",
      },
    ];
    expect(goalForDate(goals, "2026-10-22")?.kcal).toBe(2400);
    expect(goalForDate(goals, "2026-10-23")?.kcal).toBe(2400);
    expect(goalForDate(goals, "2026-10-24")?.kcal).toBe(2500);
  });
  it("Akceptuje przecinek dziesiętny i odrzuca pustą liczbę", () => {
    expect(numberInput("42,5")).toBe(42.5);
    expect(Number.isNaN(numberInput(""))).toBe(true);
  });
  it("Przepis nie może mieć zerowej masy gotowej potrawy", () =>
    expect(() => recipePer100(nutrient, 0)).toThrow());
});
beforeEach(async () => {
  await clearAll();
});
describe("Trening - trwałość i idempotencja", () => {
  it("T05: seria i aktywna sesja wracają z trwałej bazy", async () => {
    const id = await beginSession(
      initialPlans()[0],
      "2026-10-23",
      "gym",
      "Moja siłownia",
    );
    const data = await loadData();
    const set = data.sets.find((s) => s.sessionId === id)!;
    await completeSet({ ...set, weight: 42.5, reps: 12, rir: 2 }, 90);
    const reloaded = await loadData();
    expect(reloaded.sets.filter((s) => s.done)).toHaveLength(1);
    expect(reloaded.sets.find((s) => s.id === set.id)?.weight).toBe(42.5);
    expect(reloaded.sessions[0].restEndsAt).toBeGreaterThan(Date.now());
  });
  it("T06: dwukrotne równoległe zapisanie daje jedną serię", async () => {
    const id = await beginSession(
      initialPlans()[0],
      "2026-10-23",
      "gym",
      "Gym",
    );
    const set = (await loadData()).sets.find((s) => s.sessionId === id)!;
    const result = await Promise.all([
      completeSet({ ...set, reps: 12 }, 90),
      completeSet({ ...set, reps: 12 }, 90),
    ]);
    expect(result.filter(Boolean)).toHaveLength(1);
    expect((await loadData()).sets.filter((s) => s.done)).toHaveLength(1);
  });
  it("Dwa równoległe starty zwracają jedną aktywną sesję", async () => {
    const plan = initialPlans()[0];
    const ids = await Promise.all([
      beginSession(plan, "2026-10-23", "gym", "Gym"),
      beginSession(plan, "2026-10-23", "gym", "Gym"),
    ]);
    expect(ids[0]).toBe(ids[1]);
    expect((await loadData()).sessions).toHaveLength(1);
  });
  it("Sesja zachowuje wersję planu sprzed edycji", async () => {
    const plan = initialPlans()[0];
    await beginSession(plan, "2026-10-23", "gym", "Gym");
    plan.name = "Zmieniony";
    plan.exercises = [];
    const stored = (await loadData()).sessions[0];
    expect(stored.planSnapshot.name).toBe("Góra ciała A");
    expect(stored.planSnapshot.exercises).toHaveLength(6);
  });
  it("T07: nowy wariant nie przenosi ciężaru ze sztangi", () => {
    const plan = initialPlans()[0];
    const original = makeSets("s", plan.exercises[0], "gym")[0];
    const swapped = makeSets(
      "s",
      { ...plan.exercises[0], id: "replacement", exerciseId: "chest-machine" },
      "gym",
    )[0];
    expect(original.loadType).toBe("barbell");
    expect(swapped.loadType).toBe("machine");
    expect(swapped.weight).toBe(0);
    expect(swapped.id).not.toBe(original.id);
  });
  it("T10: sesja przez północ zachowuje datę dziennika i czas", async () => {
    await beginSession(initialPlans()[0], "2026-10-22", "gym", "Gym");
    const s = (await loadData()).sessions[0];
    s.startedAt = Date.parse("2026-10-22T23:55:00+02:00");
    s.endedAt = Date.parse("2026-10-23T00:25:00+02:00");
    expect(s.date).toBe("2026-10-22");
    expect(sessionSeconds(s)).toBe(1800);
  });
  it("Wstrzymana sesja nie dolicza czasu pauzy", () => {
    const s = {
      startedAt: 1000,
      pausedMs: 5000,
      endedAt: null,
      status: "paused",
      pausedAt: 16000,
    } as Session;
    expect(sessionSeconds(s, 99999999)).toBe(10);
  });
  it("Tonaż uwzględnia dwa hantle, jeden goblet i pomija asystę", () => {
    const base = {
      done: true,
      type: "work",
      weight: 20,
      reps: 10,
    } as WorkoutSet;
    expect(
      externalVolume([
        { ...base, loadType: "dumbbell", exerciseId: "db-bench" },
      ]),
    ).toBe(400);
    expect(
      externalVolume([{ ...base, loadType: "dumbbell", exerciseId: "goblet" }]),
    ).toBe(200);
    expect(externalVolume([{ ...base, loadType: "assistance" }])).toBe(0);
  });
});
describe("Pomiary i narzędzia", () => {
  it("Brak pomiaru nie tworzy fikcyjnego zera", () => {
    const m = [
      {
        ...stamp(),
        date: "2026-10-01",
        value: 80,
        note: "",
        source: "manual",
        timestamp: "",
      },
      {
        ...stamp(),
        date: "2026-10-05",
        value: 82,
        note: "",
        source: "manual",
        timestamp: "",
      },
    ] as Measurement[];
    const trend = weightTrend(m);
    expect(trend).toHaveLength(2);
    expect(trend[1].average).toBe(81);
  });
  it("Kalkulator talerzy liczy gryf raz i pokazuje osiągalny wynik", () => {
    expect(plates(62.5).actual).toBe(62.5);
    expect(plates(63).exact).toBe(false);
    expect(plates(63).actual).toBe(62.5);
  });
  it("Progresja wymaga dwóch pełnych sesji i RIR", () =>
    expect(
      progression([], [], "bench", "gym", { max: 12, rir: 2, count: 3 }, 2.5),
    ).toBeNull());
  it("Odrzuca plik innego formatu przed zmianą bazy", () =>
    expect(() => validateBackup({ format: "other" })).toThrow());
  it("Odrzuca zduplikowane identyfikatory i uszkodzone wartości", () => {
    const data = emptyData();
    data.food = [food({ id: "same" }), food({ id: "same" })];
    expect(() =>
      validateBackup({ format: "forma-backup", version: 1, data }),
    ).toThrow();
    data.food = [food({ grams: -100 })];
    expect(() =>
      validateBackup({ format: "forma-backup", version: 1, data }),
    ).toThrow();
  });
  it("Katalog nie dodaje fikcyjnych treningów, posiłków ani masy", async () => {
    await seedCatalog();
    const d = await loadData();
    expect(d.plans).toHaveLength(3);
    expect(d.sessions).toHaveLength(0);
    expect(d.food).toHaveLength(0);
    expect(d.measurements).toHaveLength(0);
    expect(d.goals).toHaveLength(0);
  });
});
