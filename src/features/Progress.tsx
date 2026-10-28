import {resultMetric,resultUnit,type ResultMetric} from '../core/exerciseMetrics';
import { useState } from "react";
import {
  Check,
  Dumbbell,
  Edit3,
  Lightbulb,
  Plus,
  Scale,
  Stack,
  TrendDown,
  TrendingUp,
  Trash2,
} from '../ui/icons';
import { EXERCISES } from "../core/catalog";
import {
  dateLabel,
  fmt,
  localDate,
  plural,
  progression,
  shiftDate,
  weightTrend,
  bestWorkingSet,
} from "../core/math";
import { useStore } from "../core/store";
import { stamp } from "../core/catalog";
import {
  Button,
  Confirm,
  Field,
  IconButton,
  PageTitle,
  Segments,
  useUI,
} from "../ui/UI";
import { WeightForm } from "./forms";
import { SessionDetail } from "./Training";

export function Progress() {
  const { data, put, remove } = useStore();
  const { show, run, toast } = useUI();
  const [period, setPeriod] = useState<"28" | "90" | "365" | "all">("90");
  const [exerciseId, setExerciseId] = useState("bench");
  const [metricChoice,setMetricChoice]=useState<ResultMetric|"auto">("auto");
  const metric=metricChoice==="auto"?EXERCISES.find(e=>e.id===exerciseId)?.metric??"reps":metricChoice;
  const [equipmentId, setEquipmentId] = useState(data.profiles[0].equipmentId);
  const start =
    period === "all"
      ? "0000-00-00"
      : shiftDate(localDate(), -Number(period) + 1);
  const measurements = data.measurements
    .filter((m) => m.date >= start)
    .sort((a, b) => a.date.localeCompare(b.date));
  const trend = weightTrend(measurements);
  const change =
    measurements.length >= 2
      ? measurements.at(-1)!.value - measurements[0].value
      : null;
  const sessions = data.sessions.filter(
    (s) => s.status === "finished" && s.date >= start,
  );
  const sessionIds = new Set(
    sessions.filter((s) => s.equipmentId === equipmentId).map((s) => s.id),
  );
  const sets = data.sets.filter(
    (s) =>
      s.done &&
      s.type === "work" &&
      s.exerciseId === exerciseId && resultMetric(s)===metric &&
      sessionIds.has(s.sessionId),
  );
  const strength = sessions
    .filter(
      (s) =>
        s.equipmentId === equipmentId && sets.some((v) => v.sessionId === s.id),
    )
    .sort((a, b) => a.startedAt - b.startedAt)
    .map((s) => {
      const best = bestWorkingSet(
        sets.filter((v) => v.sessionId === s.id),
        EXERCISES.find((e) => e.id === exerciseId)!.loadType,
      )!;
      return { id: s.id, date: s.date, value: best.weight, reps: best.reps };
    });
  const plan = data.plans.find((p) =>
    p.exercises.some((e) => e.exerciseId === exerciseId),
  );
  const slot = plan?.exercises.find((e) => e.exerciseId === exerciseId);
  const step = data.equipment.find((e) => e.id === equipmentId)?.step ?? 2.5;
  const suggestion = slot && metric==="reps"
    ? progression(
        data.sessions,
        data.sets,
        exerciseId,
        equipmentId,
        { max: slot.max, rir: slot.rir, count: slot.sets },
        step,
      )
    : null;
  const workSets=data.sets.filter((s)=>s.done&&s.type==="work"&&sessions.some((v)=>v.id===s.sessionId)).length;
  return (
    <>
      <PageTitle title="Postępy" subtitle="Masa ciała, wyniki ćwiczeń i regularność" />
      <Segments
        value={period}
        onChange={setPeriod}
        options={[
          { value: "28", label: "4 tyg." },
          { value: "90", label: "3 mies." },
          { value: "365", label: "Rok" },
          { value: "all", label: "Całość" },
        ]}
      />
      <div className="card progress-summary">
        <div><span className="icon-bubble acc small"><Dumbbell size={18} /></span><strong>{sessions.length}</strong><span>{plural(sessions.length,'trening','treningi','treningów')}</span></div>
        <i/>
        <div><span className="icon-bubble hot small"><Stack size={18} /></span><strong>{workSets}</strong><span>serii roboczych</span></div>
        <i/>
        <div><span className="icon-bubble fat small"><Scale size={18} /></span><strong>{measurements.length}</strong><span>{plural(measurements.length,'pomiar','pomiary','pomiarów')}</span></div>
      </div>
      <section className="card chart-card">
        <div className="card-head"><h2>Masa ciała</h2><button className="pill-btn primary small" onClick={() => show(<WeightForm />)}><Plus size={16}/>Pomiar</button></div>
      {measurements.length ? (
        <>
          <div className="weight-overview">
            <span className="big-value"><strong>{fmt(measurements.at(-1)!.value, 1)}</strong><span>kg · {dateLabel(measurements.at(-1)!.date, {day: "numeric", month: "short"})}</span></span>
            {change !== null && (
              <span className={`trend-chip ${change <= 0 ? 'ok' : 'warn'}`}>
                {change <= 0 ? <TrendDown size={15} /> : <TrendingUp size={15} />}
                {change < 0 ? '−' : '+'}{fmt(Math.abs(change), 1)} kg od {dateLabel(measurements[0].date, {day: "numeric", month: "short"})}
              </span>
            )}
          </div>
          <LineChart
            points={measurements.map((m) => ({
              id: m.id,
              date: m.date,
              value: m.value,
            }))}
            average={
              measurements.length >= 3 ? trend.map((m) => m.average) : undefined
            }
            unit="kg"
            label="Masa ciała"
            color="var(--acc)"
            onPoint={(id) =>
              show(
                <WeightForm existing={measurements.find((m) => m.id === id)} />,
              )
            }
          />
          <p className="chart-summary">
            {measurements.length < 2 ? 'Jeden pomiar - trend pojawi się po kolejnym.' : measurements.length < 3 ? 'Dotknij punktu, aby zobaczyć pomiar · za mało pomiarów do trendu.' : 'Dotknij punktu, aby zobaczyć pomiar · linia przerywana to średnia 7 dni.'}
          </p>
          <div className="measurement-list">
            {[...measurements].reverse().slice(0, 6).map((m) => (
              <div key={m.id} className="measure-row">
                <button
                  className="entry-main"
                  onClick={() => show(<WeightForm existing={m} />)}
                >
                  <span className="measure-date">{dateLabel(m.date, { day: "numeric", month: "short" })}</span>
                  <span className="measure-note">{m.note}</span>
                  <strong>{fmt(m.value, 1)} kg</strong>
                  <Edit3 size={15}/>
                </button>
                <IconButton
                  icon={Trash2}
                  label="Usuń pomiar"
                  onClick={() =>
                    show(
                      <Confirm
                        title="Usunąć pomiar?"
                        text={`${fmt(m.value, 1)} kg · ${dateLabel(m.date)}`}
                        danger
                        onConfirm={async () => {
                          await remove("measurements", m.id);
                          toast("Pomiar usunięty", () =>
                            put("measurements", m),
                          );
                        }}
                        confirm="Usuń pomiar"
                      />,
                    )
                  }
                />
              </div>
            ))}
          </div>
          {measurements.length > 6 && <details className="measurement-more"><summary>Wszystkie pomiary · {measurements.length}</summary>{[...measurements].reverse().slice(6).map(m=><button key={m.id} className="measure-row entry-main" onClick={() => show(<WeightForm existing={m} />)}><span className="measure-date">{dateLabel(m.date, { day: "numeric", month: "short" })}</span><span className="measure-note">{m.note}</span><strong>{fmt(m.value, 1)} kg</strong><Edit3 size={15}/></button>)}</details>}
        </>
      ) : (
        <div className="empty-inline">
          <span className="empty-bubble fat"><Scale size={32}/></span>
          <strong>Brak pomiarów w tym zakresie</strong>
          <p>Wykres pojawi się po pierwszym pomiarze. Trend liczymy od 2 pomiarów.</p>
          <Button onClick={() => show(<WeightForm />)}>Dodaj pierwszy pomiar</Button>
        </div>
      )}
      </section>
      <section className="card chart-card">
      <h2>Wyniki ćwiczeń</h2>
      <div className="form-grid">
        <Field label="Ćwiczenie">
          <select
            value={exerciseId}
            onChange={(e) => {setExerciseId(e.target.value);setMetricChoice("auto");}}
          >
            {EXERCISES.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Miejsce / sprzęt">
          <select
            value={equipmentId}
            onChange={(e) => setEquipmentId(e.target.value)}
          >
            {data.equipment.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <Field label="Jednostka porównania"><select value={metricChoice} onChange={e=>setMetricChoice(e.target.value as ResultMetric|"auto")}><option value="auto">Domyślna dla ćwiczenia ({resultUnit(EXERCISES.find(e=>e.id===exerciseId)?.metric??"reps")})</option><option value="reps">Powtórzenia i ciężar</option><option value="seconds">Sekundy</option><option value="distance">Metry</option></select></Field>
      {strength.length ? (
        <>
          <LineChart
            points={strength.map((s) => ({
              ...s,
              value:
                metric!=="reps" || EXERCISES.find((e) => e.id === exerciseId)?.loadType ===
                "bodyweight"
                  ? s.reps
                  : s.value,
            }))}
            unit={
              metric!=="reps" || EXERCISES.find((e) => e.id === exerciseId)?.loadType ===
              "bodyweight"
                ? resultUnit(metric)
                : "kg"
            }
            label="Wynik ćwiczenia"
            color="var(--info)"
            onPoint={(id) => show(<SessionDetail sessionId={id} />)}
          />
          <p className="chart-summary">
            {metric!=="reps"?`Największy zapisany wynik w ${resultUnit(metric)} w każdej sesji. Dotknij punktu, aby zobaczyć serie.`:<>Najcięższa rzeczywista seria w sesji; dla masy ciała najwięcej
            powtórzeń, dla asysty najmniej pomocy. Dotknij punktu, aby otworzyć serie.</>}
          </p>
        </>
      ) : (
        <div className="empty-inline">
          <span className="empty-bubble info"><Dumbbell size={30}/></span>
          <strong>Historia buduje się z treningów</strong>
          <p>Ukończ sesję z tym ćwiczeniem w wybranym miejscu, aby zobaczyć wyniki.</p>
        </div>
      )}
      {suggestion && plan && slot && (
        <div className="suggestion">
          <span className="icon-bubble card small"><Lightbulb size={16}/></span>
          <div>
            <strong>Propozycja na następny raz: {fmt(suggestion.weight, 2)} kg</strong>
            <small>{suggestion.reason} To sugestia - zapisujesz to, co wykonasz.</small>
            <button
              className="text-action"
              onClick={() =>
                void run(async () => {
                  await put("plans", {
                    ...plan,
                    version: plan.version + 1,
                    exercises: plan.exercises.map((s) =>
                      s.id === slot.id
                        ? {
                            ...s,
                            notes: `Propozycja ${fmt(suggestion.weight, 2)} kg. ${suggestion.reason}`,
                          }
                        : s,
                    ),
                    updatedAt: stamp().updatedAt,
                  });
                }, "Propozycja dopisana do planu")
              }
            >
              Zatwierdź w planie
            </button>
          </div>
        </div>
      )}
      </section>
      <section className="card chart-card">
      <div className="card-head"><h2>Regularność</h2><small>ostatnie 4 tygodnie</small></div>
      <div className="activity-calendar">
        {Array.from({ length: 28 }, (_, i) => {
          const d = shiftDate(localDate(), i - 27);
          const count = data.sessions.filter(
            (s) => s.date === d && s.status === "finished",
          ).length;
          return (
            <div
              key={d}
              className={`${count ? "trained" : ""} ${d===localDate()?'today':''}`}
              style={{animationDelay:`${i*18}ms`}}
              title={`${dateLabel(d)}: ukończone treningi: ${count}`}
              aria-label={`${dateLabel(d)}: ukończone treningi: ${count}`}
            >
              <span>{Number(d.slice(-2))}</span>
              {count ? <Check size={11}/> : null}
            </div>
          );
        })}
      </div>
      <p className="chart-summary">
        Zaznaczenie oznacza ukończoną sesję; dni odpoczynku pozostają puste.
      </p>
      </section>
    </>
  );
}

function LineChart({
  points,
  average,
  unit,
  label,
  onPoint,
  color = "var(--acc)",
}: {
  points: { id: string; date: string; value: number }[];
  average?: number[];
  unit: string;
  label: string;
  onPoint: (id: string) => void;
  color?: string;
}) {
  const width = 600,
    height = 240,
    left = 52,
    right = 20,
    top = 24,
    bottom = 38;
  const all = [...points.map((p) => p.value), ...(average ?? [])];
  const rawMin = Math.min(...all),
    rawMax = Math.max(...all);
  const span = Math.max(unit === "kg" ? 5 : 3, rawMax - rawMin);
  const min = Math.max(0, rawMin - span * 0.35),
    max = rawMax + span * 0.35;
  const t0 = new Date(points[0].date).getTime(),
    t1 = new Date(points.at(-1)!.date).getTime();
  const x = (date: string) =>
    t1 === t0
      ? (width + left - right) / 2
      : left +
        ((new Date(date).getTime() - t0) / (t1 - t0)) * (width - left - right);
  const y = (v: number) =>
    height - bottom - ((v - min) / (max - min)) * (height - top - bottom);
  const path = (values: number[]) =>
    values
      .map((v, i) => `${i ? "L" : "M"}${x(points[i].date)},${y(v)}`)
      .join(" ");
  return (
    <div className="chart">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        role="group"
        aria-label={`${label}: liczba zapisów: ${points.length}. Od ${fmt(points[0].value, 1)} do ${fmt(points.at(-1)!.value, 1)} ${unit}.`}
      >
        <title>
          {label} · {unit}
        </title>
        {[0, 1, 2, 3].map((i) => {
          const v = min + ((max - min) * i) / 3;
          return (
            <g key={i}>
              <line
                x1={left}
                x2={width - right}
                y1={y(v)}
                y2={y(v)}
                stroke="var(--line)"
              />
              <text x={left - 9} y={y(v) + 4} textAnchor="end">
                {fmt(v, 1)}
              </text>
            </g>
          );
        })}
        <text x={left} y={height - 10}>
          {dateLabel(points[0].date, { day: "numeric", month: "short" })}
        </text>
        {points.length > 1 && (
          <text x={width - right} y={height - 10} textAnchor="end">
            {dateLabel(points.at(-1)!.date, { day: "numeric", month: "short" })}
          </text>
        )}
        <path
          className="chart-line"
          d={path(points.map((p) => p.value))}
          fill="none"
          stroke={color}
          strokeWidth="3"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {average && (
          <path
            d={path(average)}
            fill="none"
            stroke="var(--muted)"
            strokeDasharray="5 5"
            strokeWidth="2"
          />
        )}
        {points.map((p, i) => (
          <g
            key={p.id}
            role="button"
            tabIndex={0}
            aria-label={`${dateLabel(p.date)}: ${fmt(p.value, 1)} ${unit}`}
            onClick={() => onPoint(p.id)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onPoint(p.id);
              }
            }}
          >
            <circle cx={x(p.date)} cy={y(p.value)} r="16" fill="transparent" />
            <rect
              className="chart-point"
              style={{animationDelay:`${0.25+Math.min(i,20)*0.06}s`}}
              x={x(p.date)-6}
              y={y(p.value)-6}
              width="12"
              height="12"
              rx="6"
              fill={i===points.length-1?color:"var(--card)"}
              stroke={color}
              strokeWidth="2.5"
            />
          </g>
        ))}
      </svg>
    </div>
  );
}
