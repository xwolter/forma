import { useState } from "react";
import { Check, Plus } from '../ui/icons';
import { useStore } from "../core/store";
import { stamp } from "../core/catalog";
import {
  goalForDate,
  localDate,
  numberInput,
  positiveInput,
  fmt,
} from "../core/math";
import { Button, Field, Sheet, useUI } from "../ui/UI";
import type { Activity, Measurement } from "../core/types";

export function WeightForm({
  date = localDate(),
  existing,
}: {
  date?: string;
  existing?: Measurement;
}) {
  const { put, busy } = useStore();
  const { run, close } = useUI();
  const [value, setValue] = useState(existing ? String(existing.value) : "");
  const [day, setDay] = useState(existing?.date ?? date);
  const [note, setNote] = useState(existing?.note ?? "");
  return (
    <Sheet title={existing ? "Edytuj pomiar" : "Nowy pomiar"}>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          const ok = await run(
            () =>
              put("measurements", {
                ...stamp(existing?.id),
                date: day,
                value: positiveInput(value, 500),
                note,
                source: "manual",
                timestamp: existing?.timestamp ?? new Date().toISOString(),
              }),
            "Pomiar zapisany",
          );
          if (ok) close();
        }}
      >
        <Field label="Masa ciała · kg">
          <input
            autoFocus
            required
            inputMode="decimal"
            placeholder="np. 82,5"
            value={value}
            onChange={(e) => setValue(e.target.value)}
          />
        </Field>
        <Field label="Dzień pomiaru">
          <input
            required
            type="date"
            value={day}
            max={localDate()}
            onChange={(e) => setDay(e.target.value)}
          />
        </Field>
        <Field label="Notatka · opcjonalnie">
          <textarea
            rows={2}
            maxLength={500}
            placeholder="Warunki pomiaru, samopoczucie…"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </Field>
        <Button type="submit" className="full" disabled={busy}>
          <Check size={20} /> Zapisz pomiar
        </Button>
      </form>
    </Sheet>
  );
}
export function ActivityForm({
  date = localDate(),
  existing,
}: {
  date?: string;
  existing?: Activity;
}) {
  const { put, busy } = useStore();
  const { run, close } = useUI();
  const [name, setName] = useState(existing?.name ?? "Spacer");
  const [minutes, setMinutes] = useState(
    existing ? String(existing.minutes) : "",
  );
  const [distance, setDistance] = useState(
    existing?.distance ? String(existing.distance) : "",
  );
  const [day, setDay] = useState(existing?.date ?? date);
  return (
    <Sheet title="Zapisz aktywność">
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          const ok = await run(
            () =>
              put("activities", {
                ...stamp(existing?.id),
                name: name.trim(),
                date: day,
                minutes: positiveInput(minutes, 1440),
                distance: distance.trim()
                  ? positiveInput(distance, 1000)
                  : null,
                kcal: null,
                sourceId: null,
              }),
            "Aktywność zapisana",
          );
          if (ok) close();
        }}
      >
        <Field label="Rodzaj aktywności">
          <input
            required
            maxLength={60}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </Field>
        <div className="form-grid">
          <Field label="Czas · min">
            <input
              required
              inputMode="decimal"
              value={minutes}
              onChange={(e) => setMinutes(e.target.value)}
            />
          </Field>
          <Field label="Dystans · km">
            <input
              inputMode="decimal"
              placeholder="Opcjonalnie"
              value={distance}
              onChange={(e) => setDistance(e.target.value)}
            />
          </Field>
        </div>
        <Field label="Data">
          <input
            type="date"
            required
            value={day}
            onChange={(e) => setDay(e.target.value)}
          />
        </Field>
        <p className="muted small">
          Aktywność jest osobnym wpisem. Nie zwiększa automatycznie celu
          kalorii.
        </p>
        <Button type="submit" className="full" disabled={busy}>
          <Plus size={20} /> Zapisz aktywność
        </Button>
      </form>
    </Sheet>
  );
}
export function GoalForm({ date = localDate(), initialKcal }: { date?: string; initialKcal?: number }) {
  const { data, put, busy } = useStore();
  const { run, close } = useUI();
  const current = goalForDate(data.goals, date);
  const [kcal, setKcal] = useState(initialKcal!==undefined ? String(initialKcal) : current ? String(current.kcal) : "");
  const [protein, setProtein] = useState(
    current?.protein != null ? String(current.protein) : "",
  );
  const [fat, setFat] = useState(
    current?.fat != null ? String(current.fat) : "",
  );
  const [carbs, setCarbs] = useState(
    current?.carbs != null ? String(current.carbs) : "",
  );
  const [from, setFrom] = useState(date);
  const macroKcal =
    numberInput(protein) * 4 + numberInput(fat) * 9 + numberInput(carbs) * 4;
  const difference = Number.isFinite(macroKcal)
    ? macroKcal - numberInput(kcal)
    : 0;
  return (
    <Sheet title="Twoje cele żywieniowe">
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          const ok = await run(async () => {
            const optional = (s: string) => {
              if (!s.trim()) return null;
              const n = numberInput(s);
              if (!Number.isFinite(n) || n < 0 || n > 3000)
                throw new Error("Sprawdź wartości makro.");
              return n;
            };
            await put("goals", {
              ...stamp(),
              effectiveFrom: from,
              method: "manual",
              kcal: positiveInput(kcal, 15000),
              protein: optional(protein),
              fat: optional(fat),
              carbs: optional(carbs),
            });
          }, "Cel zapisany od wybranej daty");
          if (ok) close();
        }}
      >
        <p className="muted">
          Ustaw własny cel. Wcześniejsze dni zachowają cel obowiązujący w ich
          dacie.
        </p>
        <Field label="Energia · kcal">
          <input
            required
            inputMode="decimal"
            value={kcal}
            onChange={(e) => setKcal(e.target.value)}
          />
        </Field>
        <div className="form-grid three">
          <Field label="Białko · g">
            <input
              inputMode="decimal"
              value={protein}
              onChange={(e) => setProtein(e.target.value)}
            />
          </Field>
          <Field label="Tłuszcze · g">
            <input
              inputMode="decimal"
              value={fat}
              onChange={(e) => setFat(e.target.value)}
            />
          </Field>
          <Field label="Węglow. · g">
            <input
              inputMode="decimal"
              value={carbs}
              onChange={(e) => setCarbs(e.target.value)}
            />
          </Field>
        </div>
        {Math.abs(difference) > 5 && (
          <p className="inline-warning">
            Podane makro daje {fmt(macroKcal)} kcal, różnica względem celu:{" "}
            {fmt(difference)} kcal. Sprawdź, czy to zamierzone. Wartości nie
            zostaną nadpisane.
          </p>
        )}
        <Field label="Obowiązuje od">
          <input
            required
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
        </Field>
        <Button type="submit" className="full" disabled={busy}>
          Zapisz cel <Check size={20} />
        </Button>
      </form>
    </Sheet>
  );
}
