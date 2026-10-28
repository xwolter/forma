import type { AppData } from "./types";

const DAY = 86_400_000;
// UTC is only used to number calendar dates, never to assign the user's day.
export function dayNumber(date: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const ms = Date.parse(`${date}T00:00:00Z`);
  return Number.isFinite(ms) && new Date(ms).toISOString().slice(0, 10) === date
    ? ms / DAY : null;
}
export function streakStats(dates: string[], today: string) {
  const now = dayNumber(today);
  if (now === null) throw new Error("Nieprawidłowy dzień serii.");
  const days = [...new Set(dates.map(dayNumber).filter(
    (n): n is number => n !== null && n <= now,
  ))].sort((a, b) => a - b);
  const achieved = new Set(days);
  let longest = 0, run = 0, previous = -Infinity;
  for (const n of days) {
    run = n === previous + 1 ? run + 1 : 1;
    longest = Math.max(longest, run);
    previous = n;
  }
  let cursor = achieved.has(now) ? now : now - 1, current = 0;
  while (achieved.has(cursor--)) current++;
  return {
    current, longest, total: days.length, todayDone: achieved.has(now),
    last30: days.filter(n => n >= now - 29).length,
    calendar: Array.from({ length: 30 }, (_, i) => {
      const n = now - 29 + i;
      return { date: new Date(n * DAY).toISOString().slice(0, 10), done: achieved.has(n) };
    }),
  };
}
export function habitDates(data: AppData) {
  const performed = new Set(data.sets.filter(s => s.done && !s.skipped && s.reps > 0).map(s => s.sessionId));
  return {
    open: data.daily.filter(d => d.appOpened === true).map(d => d.date),
    movement: [
      ...data.sessions.filter(s => performed.has(s.id)).map(s => s.date),
      ...data.activities.filter(a => a.minutes > 0).map(a => a.date),
    ],
    food: data.food.filter(e => e.status === "consumed" && e.grams > 0).map(e => e.date),
  };
}
