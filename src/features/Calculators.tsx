import { useState } from "react";
import { ArrowRight } from '../ui/icons';
import { fmt, goalForDate, localDate, numberInput } from "../core/math";
import {
  plateInventory,
  remainingCarbs,
  restingEnergy,
} from "../core/calculators";
import { useStore } from "../core/store";
import { Button, Field, Segments, Sheet, useUI } from "../ui/UI";
import { GoalForm } from "./forms";

type CalculatorTab='energy'|'macro'|'plates'|'recipe';
export function Calculators({initialTab='energy',initialTarget=''}:{initialTab?:CalculatorTab;initialTarget?:string}) {
  const { data } = useStore();
  const { show } = useUI();
  const profile = data.profiles[0];
  const goal = goalForDate(data.goals, localDate());
  const latest = [...data.measurements].sort((a, b) =>
    b.date.localeCompare(a.date),
  )[0];
  const [tab, setTab] = useState<CalculatorTab>(
    initialTab,
  );
  const [weight, setWeight] = useState(latest ? String(latest.value) : "");
  const [height, setHeight] = useState(
    profile?.height ? String(profile.height) : "",
  );
  const [age, setAge] = useState(profile?.age ? String(profile.age) : "");
  const [variant, setVariant] = useState<"female" | "male" | "">("");
  const [factor, setFactor] = useState("1.4");
  const [kcal, setKcal] = useState(goal ? String(goal.kcal) : "");
  const [protein, setProtein] = useState(
    goal?.protein != null ? String(goal.protein) : "",
  );
  const [fat, setFat] = useState(goal?.fat != null ? String(goal.fat) : "");
  const [target, setTarget] = useState(initialTarget);
  const [bar, setBar] = useState("20");
  const [stock, setStock] = useState(
    [20, 10, 5, 2.5, 1.25].map((kg) => ({ kg, pairs: 2 })),
  );
  const [total, setTotal] = useState("");
  const [cooked, setCooked] = useState("");
  const [portion, setPortion] = useState("");
  const ree = variant
    ? restingEnergy(
        numberInput(weight),
        numberInput(height),
        numberInput(age),
        variant,
      )
    : null;
  const carbs = remainingCarbs(
    numberInput(kcal),
    numberInput(protein),
    numberInput(fat),
  );
  const plates = target.trim()
    ? plateInventory(numberInput(target), numberInput(bar), stock)
    : null;
  const per100 =
    numberInput(cooked) > 0 && numberInput(total) >= 0
      ? (numberInput(total) / numberInput(cooked)) * 100
      : null;
  const input = (label: string, value: string, set: (x: string) => void) => (
    <Field label={label}>
      <input
        inputMode="decimal"
        value={value}
        onChange={(e) => set(e.target.value)}
      />
    </Field>
  );
  return (
    <Sheet title="Przelicz to" wide>
      <div className="calculator-tabs">
        <Segments
          value={tab}
          onChange={setTab}
          options={[
            { value: "energy", label: "Energia" },
            { value: "macro", label: "Makro" },
            { value: "plates", label: "Talerze" },
            { value: "recipe", label: "Gotowanie" },
          ]}
        />
      </div>
      {tab === "energy" && (
        <>
          <h3>Od danych do punktu startowego</h3>
          <p className="muted">
            Szacunek energii dla zdrowych dorosłych w wieku 19-78 lat.
            Współczynnik aktywności wybierasz sam. Wynik nie ustawia
            automatycznie diety.
          </p>
          <div className="form-grid">
            {input("Masa · kg", weight, setWeight)}
            {input("Wzrost · cm", height, setHeight)}
            {input("Wiek · lata", age, setAge)}
            <Field label="Wariant wzoru">
              <select
                value={variant}
                onChange={(e) => setVariant(e.target.value as typeof variant)}
              >
                <option value="">Wybierz</option>
                <option value="female">Kobieta (−161)</option>
                <option value="male">Mężczyzna (+5)</option>
              </select>
            </Field>
          </div>
          <Field label="Szacowany mnożnik aktywności">
            <select value={factor} onChange={(e) => setFactor(e.target.value)}>
              <option value="1.2">1,2 · głównie siedząco</option>
              <option value="1.4">1,4 · niewielka aktywność</option>
              <option value="1.6">1,6 · umiarkowana aktywność</option>
              <option value="1.8">1,8 · wysoka aktywność</option>
            </select>
          </Field>
          {ree !== null ? (
            <>
              <div className="calculation-result">
                <span>Energia spoczynkowa</span>
                <strong>
                  {fmt(ree)} <small>kcal</small>
                </strong>
                <span>Szacowane utrzymanie · × {factor.replace(".", ",")}</span>
                <strong>
                  {fmt(ree * Number(factor))} <small>kcal / dzień</small>
                </strong>
              </div>
              <Button
                className="full"
                onClick={() =>
                  show(
                    <GoalForm initialKcal={Math.round(ree * Number(factor))} />,
                  )
                }
              >
                Przejrzyj jako cel <ArrowRight size={18} />
              </Button>
            </>
          ) : (
            <p className="inline-note">
              Uzupełnij dane: masa 30-350 kg, wzrost 100-250 cm, wiek 19-78 lat
              i wariant wzoru.
            </p>
          )}
          <p className="muted small">
            Wzór Mifflina-St Jeora (1990). Mnożnik aktywności to dodatkowe
            przybliżenie; porównuj wynik z rzeczywistym trendem.{" "}
            <a
              href="https://pubmed.ncbi.nlm.nih.gov/2305711/"
              target="_blank"
              rel="noreferrer"
            >
              Źródło wzoru
            </a>
          </p>
        </>
      )}
      {tab === "macro" && (
        <>
          <h3>Ile zostaje na węglowodany?</h3>
          <p className="muted">
            Wpisz własną energię, białko i tłuszcz. Przelicznik: białko 4
            kcal/g, tłuszcz 9 kcal/g, węglowodany 4 kcal/g. Etykiety mogą różnić
            się przez błonnik i zaokrąglenia.
          </p>
          {input("Energia · kcal", kcal, setKcal)}
          <div className="form-grid">
            {input("Białko · g", protein, setProtein)}
            {input("Tłuszcz · g", fat, setFat)}
          </div>
          {carbs !== null ? (
            <div className="calculation-result">
              <span>Węglowodany do podanego bilansu</span>
              <strong>
                {fmt(carbs, 1)} <small>g</small>
              </strong>
            </div>
          ) : (
            <p className="inline-warning">
              Uzupełnij wartości. Białko i tłuszcz nie mogą przekraczać całej
              podanej energii.
            </p>
          )}
        </>
      )}
      {tab === "plates" && (
        <>
          <h3>Załóż ciężar bez zgadywania</h3>
          <div className="form-grid">
            {input("Łączny ciężar · kg", target, setTarget)}
            {input("Sztanga · kg", bar, setBar)}
          </div>
          <p className="muted">
            Liczba dostępnych par talerzy. Wynik pokazuje jedną stronę - drugą
            załaduj identycznie.
          </p>
          <div className="plate-stock">
            {stock.map((p, i) => (
              <Field key={p.kg} label={`${fmt(p.kg, 2)} kg · pary`}>
                <input
                  type="number"
                  min="0"
                  max="20"
                  value={p.pairs}
                  onChange={(e) =>
                    setStock((s) =>
                      s.map((x, j) =>
                        i === j ? { ...x, pairs: Number(e.target.value) } : x,
                      ),
                    )
                  }
                />
              </Field>
            ))}
          </div>
          {plates ? (
            <div className="calculation-result">
              <span>Na każdą stronę</span>
              <div className="plate-stack">
                {plates.plates.map((p, i) => (
                  <b key={i}>{fmt(p, 2)}</b>
                ))}
              </div>
              <strong>
                {fmt(plates.actual, 2)} <small>kg łącznie</small>
              </strong>
              <p>
                {plates.exact
                  ? "Dokładnie podany ciężar."
                  : "Najbliższy możliwy ciężar poniżej celu."}
              </p>
            </div>
          ) : (
            <p className="inline-note">
              Podaj prawidłowy ciężar co najmniej równy masie sztangi.
            </p>
          )}
        </>
      )}
      {tab === "recipe" && (
        <>
          <h3>Po ugotowaniu zmienia się masa</h3>
          <p className="muted">
            Kalorie składników zostają, zmienia się ilość wody. Dla całego dania
            zachowującego wszystkie składniki:
          </p>
          {input("Suma energii składników · kcal", total, setTotal)}
          <div className="form-grid">
            {input("Masa po przygotowaniu · g", cooked, setCooked)}
            {input("Twoja porcja · g", portion, setPortion)}
          </div>
          {per100 !== null && Number.isFinite(per100) && (
            <div className="calculation-result">
              <span>Na 100 g gotowego dania</span>
              <strong>
                {fmt(per100, 1)} <small>kcal</small>
              </strong>
              {numberInput(portion) > 0 && (
                <>
                  <span>Twoja porcja</span>
                  <strong>
                    {fmt((per100 * numberInput(portion)) / 100, 1)}{" "}
                    <small>kcal</small>
                  </strong>
                </>
              )}
            </div>
          )}
          <p className="muted small">
            W zakładce Jedzenie → Moje przepisy zapiszesz także składniki i
            pełne makro. Odlany tłuszcz lub niezjedzoną część uwzględnij
            oddzielnie.
          </p>
        </>
      )}
    </Sheet>
  );
}
