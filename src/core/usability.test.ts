import "fake-indexeddb/auto";
import { beforeEach, describe, it, expect } from "vitest";
import {
  beginSession,
  completeSet,
  saveSetDraft,
  copySetToRemaining,
  saveExerciseNote,
  changeSetStatus,
} from "./workouts";
import {
  clearAll,
  seedCatalog,
  loadData,
  commit,
  dbPromise,
  validateBackup,
} from "./db";
import { initialPlans, stamp } from "./catalog";
import { expandRecipe } from "./meals";
import { bestWorkingSet, dayTotals, recipeTotals } from "./math";
import type { Recipe } from "./types";

beforeEach(async () => {
  await clearAll();
  await seedCatalog();
});
async function fixture() {
  const id = await beginSession(
    initialPlans()[0],
    "2026-10-23",
    "gym",
    "Test gym",
  );
  const data = await loadData();
  return {
    id,
    sets: data.sets.filter(
      (s) =>
        s.sessionId === id &&
        s.slotId === data.sessions[0].planSnapshot.exercises[0].id,
    ),
  };
}
describe("workout fields and shortcuts under real use", () => {
  it("retains unfinished Polish decimal input without claiming a completed set", async () => {
    const { sets } = await fixture();
    await saveSetDraft(
      sets[0].id,
      { weight: "40,", reps: "1", rir: "" },
      "work",
    );
    const row = (await loadData()).sets.find((s) => s.id === sets[0].id)!;
    expect(row.draft).toEqual({ weight: "40,", reps: "1", rir: "" });
    expect(row.done).toBe(false);
    expect(row.reps).toBe(0);
  });
  it("a late draft cannot overwrite a completed result", async () => {
    const { sets } = await fixture();
    await completeSet({ ...sets[0], weight: 40.5, reps: 10 }, 60);
    await saveSetDraft(
      sets[0].id,
      { weight: "999", reps: "999", rir: "9" },
      "warmup",
    );
    const row = (await loadData()).sets.find((s) => s.id === sets[0].id)!;
    expect(row.weight).toBe(40.5);
    expect(row.draft).toBeUndefined();
    expect(row.type).toBe("work");
  });
  it("copy fills untouched rows without confirming them and never overwrites a manual draft", async () => {
    const { sets } = await fixture();
    await completeSet({ ...sets[0], weight: 55, reps: 12, rir: 2 }, 90);
    await saveSetDraft(sets[1].id, { weight: "60", reps: "", rir: "" }, "work");
    expect(await copySetToRemaining(sets[0].id)).toBe(sets.length - 2);
    const rows = (await loadData()).sets;
    expect(rows.find((s) => s.id === sets[1].id)!.draft!.weight).toBe("60");
    const copied = rows.find((s) => s.id === sets[2].id)!;
    expect(copied.weight).toBe(55);
    expect(copied.done).toBe(false);
    expect(copied.completedAt).toBeNull();
    expect(await copySetToRemaining(sets[0].id)).toBe(0);
  });
  it("warmup values never spill into working sets or another exercise", async () => {
    const { sets } = await fixture();
    await saveSetDraft(
      sets[0].id,
      { weight: "20", reps: "10", rir: "" },
      "warmup",
    );
    await completeSet({ ...sets[0], type: "warmup", weight: 20, reps: 10 }, 30);
    expect(await copySetToRemaining(sets[0].id)).toBe(0);
    expect(
      (await loadData()).sets
        .filter((s) => !s.done)
        .every((s) => s.weight === 0),
    ).toBe(true);
  });
  it("pause prevents draft, completion, copying and skipping", async () => {
    const { sets, id } = await fixture();
    await completeSet({ ...sets[0], reps: 10, weight: 40 }, 90);
    const db = await dbPromise;
    const s = await db.get("sessions", id);
    await db.put("sessions", { ...s, status: "paused" });
    await saveSetDraft(
      sets[1].id,
      { weight: "88", reps: "8", rir: "" },
      "work",
    );
    await changeSetStatus(sets[1].id, "skip");
    expect(await completeSet({ ...sets[1], reps: 8 }, 20)).toBe(false);
    expect(await copySetToRemaining(sets[0].id)).toBe(0);
    const row = (await loadData()).sets.find((s) => s.id === sets[1].id)!;
    expect(row.draft).toBeUndefined();
    expect(row.skipped).toBe(false);
  });
  it("skip and undo preserve an unfinished draft", async () => {
    const { sets } = await fixture();
    await saveSetDraft(
      sets[0].id,
      { weight: "42,5", reps: "12", rir: "2" },
      "work",
    );
    await changeSetStatus(sets[0].id, "skip");
    expect(await completeSet({ ...sets[0], reps: 12 }, 30)).toBe(false);
    await changeSetStatus(sets[0].id, "undo");
    expect(
      (await loadData()).sets.find((s) => s.id === sets[0].id)!.draft!.weight,
    ).toBe("42,5");
  });
  it("notes survive another plan and concurrent edits stay isolated by exercise", async () => {
    await Promise.all([
      saveExerciseNote("gym", "bench", "Siedzisko 4"),
      saveExerciseNote("gym", "squat", "Stopy szerzej"),
    ]);
    await beginSession(initialPlans()[1], "2026-10-23", "gym", "Gym");
    const note = (await loadData()).equipment[0].exerciseNotes;
    expect(note).toMatchObject({
      bench: "Siedzisko 4",
      squat: "Stopy szerzej",
    });
    await saveExerciseNote("gym", "bench", "");
    expect((await loadData()).equipment[0].exerciseNotes).toEqual({
      squat: "Stopy szerzej",
    });
  });
  it("notes stay in their own equipment profile and reject unknown exercises", async () => {
    await commit([
      {
        table: "equipment",
        value: {
          ...stamp("other"),
          name: "Other gym",
          types: ["Sztanga"],
          step: 2.5,
          notes: "",
        },
      },
    ]);
    await saveExerciseNote("gym", "bench", "Uchwyt 6");
    expect(
      (await loadData()).equipment.find((e) => e.id === "other")!.exerciseNotes,
    ).toBeUndefined();
    await expect(saveExerciseNote("gym", "__proto__", "bad")).rejects.toThrow();
    await expect(
      saveExerciseNote("gym", "bench", "x".repeat(1501)),
    ).rejects.toThrow();
  });
});
const recipe: Recipe = {
  ...stamp("breakfast"),
  name: "Stałe śniadanie",
  version: 2,
  cookedWeight: 350,
  ingredients: [
    {
      productId: "p1",
      name: "Płatki",
      grams: 50,
      unit: "g",
      nutrients: { kcal: 400, protein: 10, fat: 5, carbs: 70 },
    },
    {
      productId: "p2",
      name: "Mleko",
      grams: 300,
      unit: "ml",
      nutrients: { kcal: 50, protein: 3, fat: 2, carbs: 5 },
    },
  ],
  nutrients: { kcal: 350, protein: 14, fat: 8.5, carbs: 50 },
};
describe("repeat meals with editable ingredients", () => {
  it("uses separate g/ml snapshots without also adding the cooked dish", () => {
    const entries = expandRecipe(
      recipe,
      [60, 200],
      "2026-10-23",
      "Śniadanie",
      "consumed",
    );
    expect(entries).toHaveLength(2);
    expect(entries.map((e) => e.unit)).toEqual(["g", "ml"]);
    expect(dayTotals(entries, "2026-10-23").kcal).toBe(340);
    entries[0].nutrients.kcal = 1;
    expect(recipe.ingredients[0].nutrients.kcal).toBe(400);
  });
  it("zero omits an ingredient and planned meals do not count as eaten", () => {
    const entries = expandRecipe(
      recipe,
      [50, 0],
      "2026-10-23",
      "Obiad",
      "planned",
    );
    expect(entries).toHaveLength(1);
    expect(dayTotals(entries, "2026-10-23").kcal).toBe(0);
    expect(dayTotals(entries, "2026-10-23", "planned").kcal).toBe(200);
  });
  it("rejects invalid portions, an empty meal and invalid calendar dates", () => {
    for (const amounts of [[NaN, 1], [-1, 1], [0, 0], [1], [20001, 1]])
      expect(() =>
        expandRecipe(recipe, amounts, "2026-10-23", "Obiad", "consumed"),
      ).toThrow();
    expect(() =>
      expandRecipe(recipe, [1, 1], "2026-02-31", "Obiad", "consumed"),
    ).toThrow();
  });
  it("does not lose unknown nutrients or round ingredients prematurely", () => {
    const r = structuredClone(recipe);
    r.ingredients[0].nutrients.protein = null;
    const entries = expandRecipe(
      r,
      [33.3, 66.7],
      "2026-10-23",
      "Kolacja",
      "consumed",
    );
    expect(dayTotals(entries, "2026-10-23").protein).toBeNull();
    expect(dayTotals(entries, "2026-10-23").kcal).toBeCloseTo(
      recipeTotals(
        r.ingredients.map((i, n) => ({ ...i, grams: [33.3, 66.7][n] })),
      ).kcal,
      10,
    );
  });
});
describe("honest progress charts", () => {
  it("keeps weight and repetitions from one real set and selects least assistance", async () => {
    const { sets } = await fixture();
    const rows = [
      { ...sets[0], done: true, weight: 80, reps: 3 },
      { ...sets[1], done: true, weight: 60, reps: 12 },
    ];
    expect(bestWorkingSet(rows, "barbell")).toMatchObject({
      weight: 80,
      reps: 3,
    });
    expect(bestWorkingSet(rows, "assistance")).toMatchObject({
      weight: 60,
      reps: 12,
    });
    expect(bestWorkingSet(rows, "bodyweight")!.reps).toBe(12);
  });
  it("excludes warmups, skipped and unconfirmed values from charts", async () => {
    const { sets } = await fixture();
    expect(
      bestWorkingSet(
        [
          { ...sets[0], done: true, type: "warmup" },
          { ...sets[1], done: false },
          { ...sets[2], done: true, skipped: true },
        ],
        "barbell",
      ),
    ).toBeUndefined();
  });
});
describe("backup compatibility with new optional fields", () => {
  it("accepts old backups and rejects malformed notes, drafts and warmup timers", async () => {
    const data = await loadData();
    data.profiles = [
      {
        ...stamp("me"),
        name: "Test",
        height: 180,
        age: 30,
        goal: "maintain",
        days: 3,
        equipmentId: "gym",
        theme: "light",
        waterGoal: 2500,
        haptics: false,
        timerSound: false,
        notifications: false,
        demo: false,
      },
    ];
    const backup = () => ({ format: "forma-backup", version: 1, data });
    expect(() => validateBackup(backup())).not.toThrow();
    data.equipment[0].exerciseNotes = { bench: "Siedzisko 4" };
    expect(() => validateBackup(backup())).not.toThrow();
    data.equipment[0].exerciseNotes = { bench: "x".repeat(1501) };
    expect(() => validateBackup(backup())).toThrow("notatki");
    delete data.equipment[0].exerciseNotes;
    data.plans[0].exercises[0].warmupRest = -1;
    expect(() => validateBackup(backup())).toThrow("ćwiczenia");
  });
});
