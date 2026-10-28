import { useState } from "react";
import { ArrowRight, Check, Smartphone } from '../ui/icons';
import { SportPhoto } from "./SportPhoto";
import { stamp, scheduleStarterPlans } from "../core/catalog";
import { localDate, numberInput } from "../core/math";
import { useStore } from "../core/store";
import { Button, Field, StepHeader, useUI } from "../ui/UI";
import type { Profile } from "../core/types";

export function Onboarding() {
  const { data, mutate, busy } = useStore();
  const { run } = useUI();
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [weight, setWeight] = useState("");
  const [height, setHeight] = useState("");
  const [age, setAge] = useState("");
  const [goal, setGoal] = useState<Profile["goal"]>("maintain");
  const [days, setDays] = useState(3);
  const [kcal, setKcal] = useState("");
  const [protein, setProtein] = useState("");
  const [water, setWater] = useState("");
  async function finish(demo = false) {
    await run(async () => {
      const optional = (value: string, max: number) => {
        if (!value.trim()) return null;
        const n = numberInput(value);
        if (!Number.isFinite(n) || n <= 0 || n > max)
          throw new Error("Sprawdź podane liczby. Puste pola są dozwolone.");
        return n;
      };
      const w = optional(weight, 500),
        h = optional(height, 260),
        a = optional(age, 120),
        k = optional(kcal, 15000),
        p = optional(protein, 1000),
        wa = optional(water, 15000);
      await mutate([
        ...scheduleStarterPlans(data.plans,days).map(value=>({table:'plans' as const,value})),
        {
          table: "profiles",
          value: {
            ...stamp("me"),
            name: demo ? "Demo" : name.trim() || "Ty",
            height: h,
            age: a,
            goal,
            days,
            equipmentId: "gym",
            theme: "light",
            waterGoal: demo ? 2500 : wa,
            haptics: true,
            timerSound: false,
            notifications: false,
            demo,
          },
        },
        ...(demo || k
          ? [
              {
                table: "goals" as const,
                value: {
                  ...stamp(),
                  effectiveFrom: localDate(),
                  method: "manual" as const,
                  kcal: demo ? 2400 : k!,
                  protein: demo ? 150 : p,
                  fat: demo ? 70 : null,
                  carbs: demo ? 293 : null,
                },
              },
            ]
          : []),
        ...(!demo && w
          ? [
              {
                table: "measurements" as const,
                value: {
                  ...stamp(),
                  date: localDate(),
                  timestamp: new Date().toISOString(),
                  value: w,
                  note: "Pierwszy pomiar",
                  source: "manual" as const,
                },
              },
            ]
          : []),
      ]);
      void navigator.storage?.persist?.();
    });
  }
  if (step === 0)
    return (
      <main className="onboarding welcome">
        <div className="welcome-hero"><SportPhoto index={2} alt="Osoba podczas treningu"/></div>
        <div className="welcome-content">
          <div className="brand welcome-brand rise">
            <BrandMark />
            <span>FORMA</span>
          </div>
          <p className="rise d1">Dziennik treningu i jedzenia. Zapisuje dane na telefonie - działa bez internetu.</p>
          <div className="welcome-benefits rise d2">
            <span className="welcome-benefit"><Check size={16} />Serie i wyniki</span>
            <span className="welcome-benefit"><Check size={16} />Posiłki i woda</span>
            <span className="welcome-benefit"><Smartphone size={16} />Offline</span>
          </div>
        </div>
        <div className="welcome-actions rise d3">
          <button className="pill-btn primary wide" onClick={() => setStep(1)}>
            <span>Zaczynamy</span><ArrowRight size={20} />
          </button>
          <Button
            variant="ghost"
            disabled={busy}
            onClick={() => void finish(true)}
          >
            Zobacz na danych demo
          </Button>
          <small>
            Dane pozostają na tym urządzeniu. Kopię możesz wyeksportować w
            ustawieniach.
          </small>
        </div>
      </main>
    );
  return (
    <main className="onboarding">
      <div className="brand">
        <BrandMark />
        <span>FORMA</span>
      </div>
      <StepHeader step={step} total={3} onBack={() => setStep((s) => s - 1)} />
      {step === 1 ? (
        <>
          <h1>Poznajmy się.</h1>
          <p className="muted">
            Uzupełnij tylko to, co chcesz. Wszystko możesz zmienić później.
          </p>
          <Field label="Jak się do Ciebie zwracać?">
            <input
              autoComplete="given-name"
              maxLength={40}
              placeholder="Twoje imię"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </Field>
          <div className="form-grid">
            <Field label="Masa ciała · kg">
              <input
                inputMode="decimal"
                placeholder="Opcjonalnie"
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
              />
            </Field>
            <Field label="Wzrost · cm">
              <input
                inputMode="decimal"
                placeholder="Opcjonalnie"
                value={height}
                onChange={(e) => setHeight(e.target.value)}
              />
            </Field>
          </div>
          <Field label="Wiek · lata">
            <input
              inputMode="numeric"
              placeholder="Opcjonalnie"
              value={age}
              onChange={(e) => setAge(e.target.value)}
            />
          </Field>
        </>
      ) : step === 2 ? (
        <>
          <h1>Twój kierunek.</h1>
          <p className="muted">
            Cel porządkuje dziennik. Sam wybierasz jego wartości.
          </p>
          <div className="choice-list">
            {(
              [
                ["reduce", "Redukcja", "Obserwuj masę i utrzymanie wyników"],
                ["maintain", "Utrzymanie", "Dbaj o regularność i sprawność"],
                ["build", "Budowanie masy", "Śledź masę i rozwój siły"],
              ] as const
            ).map(([value, label, text]) => (
              <button
                key={value}
                className={`choice ${goal === value ? "selected" : ""}`}
                onClick={() => setGoal(value)}
              >
                <span>
                  <strong>{label}</strong>
                  <small>{text}</small>
                </span>
                <span className="radio">
                  {goal === value && <Check size={16} />}
                </span>
              </button>
            ))}
          </div>
          <Field label="Ile treningów w tygodniu?">
            <select value={days} onChange={(e) => setDays(+e.target.value)}>
              {[1, 2, 3, 4, 5, 6, 7].map((n) => (
                <option key={n} value={n}>
                  {n} {n === 1 ? "trening" : n < 5 ? "treningi" : "treningów"}
                </option>
              ))}
            </select>
          </Field>
        </>
      ) : (
        <>
          <h1>Ustaw swój bilans.</h1>
          <p className="muted">
            Jeśli znasz swoje cele, wpisz je tutaj. Możesz też rozpocząć sam
            dziennik i wrócić do tego później.
          </p>
          <Field
            label="Dzienny cel · kcal"
            hint="Twój własny cel. Aplikacja nie wyznacza go automatycznie."
          >
            <input
              inputMode="decimal"
              placeholder="Na razie pomijam"
              value={kcal}
              onChange={(e) => setKcal(e.target.value)}
            />
          </Field>
          <Field label="Białko · g">
            <input
              inputMode="decimal"
              placeholder="Opcjonalnie"
              value={protein}
              onChange={(e) => setProtein(e.target.value)}
            />
          </Field>
          <Field label="Woda · ml">
            <input
              inputMode="numeric"
              placeholder="Opcjonalnie"
              value={water}
              onChange={(e) => setWater(e.target.value)}
            />
          </Field>
          <div className="inline-note">
            <Smartphone size={20} />
            <p>Zapis działa lokalnie. Bez konta i bez połączenia z chmurą.</p>
          </div>
        </>
      )}
      <div className="onboarding-bottom">
        <Button
          disabled={busy}
          onClick={() => (step < 3 ? setStep(step + 1) : void finish())}
        >
          {step < 3 ? "Dalej" : "Przejdź do aplikacji"}
          <ArrowRight size={20} />
        </Button>
      </div>
    </main>
  );
}
export function BrandMark() {
  return (
    <svg className="brand-mark" viewBox="0 0 64 64" aria-hidden="true">
      <path
        d="M14 5H61L47 19H0ZM0 28H43L29 42H15V52L0 64Z"
        fill="currentColor"
      />
    </svg>
  );
}
