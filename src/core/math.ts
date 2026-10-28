import { exerciseById } from './catalog';
import {resultMetric} from './exerciseMetrics';
import type {
  FoodEntry,
  Goal,
  Measurement,
  Nutrients,
  RecipeIngredient,
  Session,
  WorkoutSet,
} from "./types";

export function numberInput(value: string): number {
  const clean = value.trim().replace(",", ".");
  return clean === "" ? NaN : Number(clean);
}
export function positiveInput(value: string, max = 100000): number {
  const n = numberInput(value);
  if (!Number.isFinite(n) || n <= 0 || n > max)
    throw new Error("Wpisz poprawną wartość większą od zera.");
  return n;
}
export const fmt = (value: number, digits = 0) =>
  new Intl.NumberFormat("pl-PL", { maximumFractionDigits: digits }).format(
    value,
  );
export const plural = (n: number, one: string, few: string, many: string) =>
  n === 1
    ? one
    : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 12 || n % 100 > 14)
      ? few
      : many;
export const emptyNutrients = (): Nutrients => ({
  kcal: 0,
  protein: 0,
  fat: 0,
  carbs: 0,
});
export function bestWorkingSet(sets:WorkoutSet[],type:WorkoutSet['loadType']){
  return sets.filter(s=>s.done&&!s.skipped&&s.type==='work').reduce<WorkoutSet|undefined>((best,set)=>{
    if(!best)return set;
    if(type==='bodyweight'||resultMetric(set)!=='reps')return set.reps>best.reps?set:best;
    if(type==='assistance'&&set.weight!==best.weight)return set.weight<best.weight?set:best;
    if(type!=='assistance'&&set.weight!==best.weight)return set.weight>best.weight?set:best;
    return set.reps>best.reps?set:best;
  },undefined);
}
export function sumNutrients(values: Nutrients[]): Nutrients {
  return values.reduce<Nutrients>(
    (total, item) => ({
      kcal: total.kcal + item.kcal,
      protein:
        total.protein === null || item.protein === null
          ? null
          : total.protein + item.protein,
      fat:
        total.fat === null || item.fat === null ? null : total.fat + item.fat,
      carbs:
        total.carbs === null || item.carbs === null
          ? null
          : total.carbs + item.carbs,
    }),
    emptyNutrients(),
  );
}
export function scaleNutrients(n: Nutrients, factor: number): Nutrients {
  if (!Number.isFinite(factor) || factor < 0)
    throw new Error("Nieprawidłowa porcja.");
  return {
    kcal: n.kcal * factor,
    protein: n.protein === null ? null : n.protein * factor,
    fat: n.fat === null ? null : n.fat * factor,
    carbs: n.carbs === null ? null : n.carbs * factor,
  };
}
export const dayTotals = (
  food: FoodEntry[],
  date: string,
  status: FoodEntry["status"] = "consumed",
) =>
  sumNutrients(
    food
      .filter((e) => e.date === date && e.status === status)
      .map((e) => scaleNutrients(e.nutrients, e.quick ? 1 : e.grams / 100)),
  );
export const recipeTotals = (ingredients: RecipeIngredient[]) =>
  sumNutrients(
    ingredients.map((i) => scaleNutrients(i.nutrients, i.grams / 100)),
  );
export function recipePer100(
  total: Nutrients,
  cookedWeight: number,
): Nutrients {
  if (!Number.isFinite(cookedWeight) || cookedWeight <= 0)
    throw new Error("Podaj masę gotowej potrawy.");
  return scaleNutrients(total, 100 / cookedWeight);
}
export const goalForDate = (goals: Goal[], date: string) =>
  goals
    .filter((g) => g.effectiveFrom <= date)
    .sort(
      (a, b) =>
        b.effectiveFrom.localeCompare(a.effectiveFrom) ||
        b.updatedAt.localeCompare(a.updatedAt),
    )[0];
export const localDate = (date = new Date()) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
export const shiftDate = (date: string, offset: number) => {
  const d = new Date(`${date}T12:00:00`);
  d.setDate(d.getDate() + offset);
  return localDate(d);
};
export const dateLabel = (
  date: string,
  options: Intl.DateTimeFormatOptions = {
    weekday: "long",
    day: "numeric",
    month: "long",
  },
) => new Date(`${date}T12:00:00`).toLocaleDateString("pl-PL", options);
export const secondsText = (seconds: number) =>
  `${Math.floor(Math.max(0, seconds) / 60)}:${String(Math.floor(Math.max(0, seconds) % 60)).padStart(2, "0")}`;
export const sessionSeconds = (s: Session, now = Date.now()) =>
  Math.max(
    0,
    Math.floor(
      ((s.endedAt ?? (s.status === "paused" ? s.pausedAt! : now)) -
        s.startedAt -
        s.pausedMs) /
        1000,
    ),
  );
export const externalVolume = (sets: WorkoutSet[]) =>
  sets
    .filter(
      (s) =>
        s.done &&
        resultMetric(s)==='reps' &&
        s.type === "work" &&
        s.loadType !== "bodyweight" &&
        s.loadType !== "assistance",
    )
    .reduce(
      (sum, s) =>
        sum +
        s.weight *
          s.reps *
          (exerciseById(s.exerciseId)?.loadMultiplier??(s.loadType === "dumbbell" && !['goblet','goblet-box-squat'].includes(s.exerciseId) ? 2 : 1)),
      0,
    );
export function weightTrend(measurements: Measurement[]) {
  const sorted = [...measurements].sort((a, b) => a.date.localeCompare(b.date));
  return sorted.map((m) => {
    const start = shiftDate(m.date, -6);
    const window = sorted.filter((v) => v.date >= start && v.date <= m.date);
    return {
      ...m,
      average: window.reduce((s, v) => s + v.value, 0) / window.length,
      count: window.length,
    };
  });
}
export function progression(
  sessions: Session[],
  sets: WorkoutSet[],
  exerciseId: string,
  equipmentId: string,
  range: { max: number; rir: number | null; count: number },
  step: number,
) {
  const latest = sessions
    .filter(
      (s) =>
        s.status === "finished" &&
        s.equipmentId === equipmentId &&
        sets.some((v) => v.sessionId === s.id && v.exerciseId === exerciseId),
    )
    .sort((a, b) => (b.endedAt ?? 0) - (a.endedAt ?? 0))[0];
  if (latest?.pain || latest?.comparable === false) return null;
  const eligible = sessions
    .filter(
      (s) =>
        s.status === "finished" &&
        s.comparable &&
        !s.pain &&
        s.equipmentId === equipmentId &&
        Date.now() - (s.endedAt ?? 0) < 21 * 86400000,
    )
    .sort((a, b) => (b.endedAt ?? 0) - (a.endedAt ?? 0));
  const lastTwo = eligible
    .filter((s) =>
      sets.some((v) => v.sessionId === s.id && v.exerciseId === exerciseId),
    )
    .slice(0, 2);
  if (lastTwo.length < 2 || range.rir === null) return null;
  const groups = lastTwo.map((s) =>
    sets.filter(
      (v) =>
        v.sessionId === s.id &&
        v.exerciseId === exerciseId &&
        v.type === "work",
    ),
  );
  const all = groups.flat();
  if (
    groups.some((g) => g.length < range.count) ||
    all.some(
      (s) =>
        !s.done ||
        s.skipped ||
        resultMetric(s)!=='reps' ||
        s.rir === null ||
        s.rir < range.rir! ||
        s.reps < range.max ||
        s.weight !== all[0].weight ||
        s.loadType === "bodyweight" ||
        s.loadType === "assistance",
    )
  )
    return null;
  return {
    weight: all[0].weight + step,
    reason: `Dwie porównywalne sesje, wszystkie serie po co najmniej ${range.max} powtórzeń i RIR ≥ ${range.rir}. Skok sprzętu: ${fmt(step, 2)} kg.`,
  };
}
export function plates(
  target: number,
  bar = 20,
  available = [20, 10, 5, 2.5, 1.25],
) {
  if (target < bar) return { plates: [], actual: bar, exact: false };
  let remainder = (target - bar) / 2;
  const result: number[] = [];
  for (const p of [...available].filter(p=>Number.isFinite(p)&&p>0).sort((a, b) => b - a))
    while (remainder + 0.00001 >= p) {
      result.push(p);
      remainder -= p;
    }
  return {
    plates: result,
    actual: bar + result.reduce((s, n) => s + n, 0) * 2,
    exact: Math.abs(remainder) < 0.001,
  };
}
