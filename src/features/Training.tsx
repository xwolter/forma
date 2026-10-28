import {discoverExercises,exerciseKind,type ExerciseFocus} from '../core/exerciseDiscovery';
import {resultMetric,resultLimit,resultLabel,resultUnit} from '../core/exerciseMetrics';
import {changeSessionControl} from '../core/sessionControl';
import { useEffect, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
  Calculator,
  Dumbbell,
  Flame,
  Heart,
  ShieldCheck,
  Edit3,
  BookOpen,
  History,
  Headphones,
  Pause,
  Play,
  Plus,
  Search,
  Shuffle,
  SkipForward,
  Trash2,
  Undo2,
  ChevronDown,
  CalendarBlank,
  Timer,
  Info,
  Swap,
  PauseCircle,
  CheckCircle,
  CheckFat,
  RefreshCw,
  ArrowUpRight,
} from '../ui/icons';
import { EXERCISES, exerciseById, loadLabel, stamp } from "../core/catalog";
import {
  fmt,
  dateLabel,
  externalVolume,
  numberInput,
  secondsText,
  sessionSeconds,
  plural,
} from "../core/math";
import { useStore } from "../core/store";
import {
  completeSet,
  replaceSessionExercise,
  appendWorkoutSet,
  makeSets,
  saveSetDraft,
  copySetToRemaining,
  saveExerciseNote,
  changeSetStatus,
} from "../core/workouts";
import { getMedia, removeMedia, saveMedia } from "../core/db";
import { haptic, scheduleRest, openSpotify, openExternal } from "../core/native";
import { SportPhoto } from './SportPhoto';
import { PlanPreview, ImportPlansButton } from './PlanPlans';
import { slotTarget, defaultPlanExercise, changePlanMetric } from '../core/planTools';
import { ExerciseDemo } from "./ExerciseDemo";
import { TrainingGlossary } from "./TrainingGlossary";
import fabrykaIndex from "../data/fabryka-index.json";
const ATLAS_INDEX=[...fabrykaIndex].sort((a,b)=>a.title.localeCompare(b.title,'pl'));
import { Calculators } from './Calculators';
import type {
  Exercise,
  Plan,
  PlanExercise,
  Session,
  WorkoutSet,
} from "../core/types";
import {
  Button,
  Confirm,
  Empty,
  Field,
  IconButton,
  PageTitle,
  Ring,
  Saved,
  Segments,
  Sheet,
  useUI,
} from "../ui/UI";

export function Training({ start, focusSession=0 }: { start: (p: Plan) => void; focusSession?:number }) {
  const { data, reload } = useStore();
  const { show } = useUI();
  const [workoutOpen,setWorkoutOpen]=useState(focusSession>0);
  useEffect(()=>{if(focusSession>0)setWorkoutOpen(true);},[focusSession]);
  const [view, setView] = useState<"plan" | "history" | "library">("plan");
  const active = data.sessions.find(
    (s) => s.status === "active" || s.status === "paused",
  );
  // Draft keystrokes are saved without reloading the full diary on each key.
  // Refresh them when returning from another tab.
  useEffect(() => {
    void reload().catch(() => {});
  }, [reload]);
  if (active && workoutOpen) return <ActiveWorkout session={active} onBack={()=>setWorkoutOpen(false)}/>;
  const sessions = data.sessions
    .filter((s) => s.status === "finished" || s.status === "abandoned")
    .sort((a, b) => b.startedAt - a.startedAt);
  const freePlan=()=>start({...stamp("free"),name:"Trening bez planu",subtitle:"Własna sesja",minutes:0,version:1,weekdays:[],exercises:[]});
  return (
    <>
      <PageTitle title="Trening" subtitle={`Plany, ${EXERCISES.length} ćwiczeń i historia sesji`} />
      <Segments
        value={view}
        onChange={setView}
        options={[
          { value: "plan", label: "Moje plany" },
          { value: "library", label: "Ćwiczenia" },
          { value: "history", label: "Historia" },
        ]}
      />
      <button className="card glossary-shortcut" onClick={() => show(<TrainingGlossary/>)}><span className="glossary-shortcut-icon"><BookOpen size={22}/></span><span><strong>Słowniczek treningowy</strong><small>RIR, RPE, serie i przykłady bez żargonu</small></span><ChevronRight size={19}/></button>
      {view === "plan" ? (
        <div className="plan-stack">
          {active&&<section className="card saved-workout"><span className="dock-icon"><i className="halo"/><Dumbbell size={18}/></span><div className="row-text"><strong>{active.planSnapshot.name}</strong><small>{data.sets.filter(s=>s.sessionId===active.id&&s.done).length} wykonanych serii · {active.status==='paused'?'czas zatrzymany':'trening trwa'}</small></div><button className="pill-btn primary small" onClick={()=>setWorkoutOpen(true)}><Play size={16}/>Otwórz</button></section>}
          {[...data.plans].sort((a,b)=>Number(!a.source)-Number(!b.source)).map((plan,i)=><button className="plan-row plan-open" key={plan.id} style={{animationDelay:`${i*50}ms`}} aria-label={`Zobacz plan: ${plan.name}`} onClick={()=>show(<PlanPreview plan={plan} start={start} photoIndex={i%6}/>)}><span className="plan-cover-wrap"><SportPhoto index={i%6} alt="" className="plan-cover"/><span className="photo-kicker">{plan.program||(plan.source?'Z pliku FORMA':'Własny plan')}</span>{plan.weekdays.includes(new Date().getDay())&&<span className="photo-kicker right"><CalendarBlank size={12}/>Dziś</span>}</span><span className="plan-info"><h3>{plan.name}</h3><small>{plan.exercises.length} ćwiczeń{plan.minutes?` · ok. ${plan.minutes} min`:''}{plan.weekdays.length?` · ${plan.weekdays.map(d=>['Nd','Pn','Wt','Śr','Cz','Pt','So'][d]).join(', ')}`:''}</small></span><span className="round-btn soft"><Play size={18}/></span></button>)}
          <button className="pill-btn dashed wide" onClick={()=>show(<PlanEditor/>)}><span>Utwórz plan</span><Plus size={19}/></button>
          <div className="card list-card">
            <button className="list-row" onClick={freePlan}><span className="icon-bubble hot"><Flame size={22}/></span><span className="row-text"><strong>Trening bez planu</strong><small>Dodasz ćwiczenia w trakcie sesji</small></span><ChevronRight size={18}/></button>
            <div className="row-divider"/>
            <ImportPlansButton/>
          </div>
        </div>
      ) : view === "history" ? (
        sessions.length ? (
          <div className="card list-card history-list">
            {sessions.map((s, i) => {
              const sets=data.sets.filter((v) => v.sessionId === s.id);
              return <button
                className="list-row"
                key={s.id}
                style={{animationDelay:`${Math.min(i,12)*40}ms`}}
                onClick={() => show(<SessionDetail sessionId={s.id} />)}
              >
                <span className={`status-dot ${s.status==='abandoned'?'warn':'ok'}`}>{s.status==='abandoned'?<Pause size={20}/>:<Check size={22}/>}</span>
                <span className="row-text">
                  <strong>{s.planSnapshot.name}</strong>
                  <small>
                    {dateLabel(s.date, { weekday:'short', day: "numeric", month: "short" })} · {sets.filter(v=>v.done).length}/{sets.length} serii
                    {s.status === "abandoned" ? "" : ` · ${Math.round(sessionSeconds(s) / 60)} min`}
                  </small>
                </span>
                <span className={`status-text ${s.status==='abandoned'?'warn':'ok'}`}>{s.status==='abandoned'?'Przerwany':'Ukończony'}</span>
              </button>;
            })}
          </div>
        ) : (
          <Empty
            icon={History}
            title="Tutaj zapisze się Twoja praca"
            text="Ukończ pierwszy trening, aby wrócić do serii i wyników."
          />
        )
      ) : (
        <ExerciseLibrary />
      )}
    </>
  );
}

export function ExerciseLibrary({
  onSelect,
}: {
  onSelect?: (e: Exercise) => void;
}) {
  const [search, setSearch] = useState("");
  const [equipment, setEquipment] = useState("");
  const [muscle,setMuscle]=useState("");
  const [focus,setFocus]=useState<ExerciseFocus>('');
  const [atlasSearch,setAtlasSearch]=useState('');
  const [atlasLimit,setAtlasLimit]=useState(40);
  const { show, toast } = useUI();
  const items = discoverExercises(search,equipment,muscle,focus);
  const atlasItems=onSelect?[]:ATLAS_INDEX.filter(item=>item.title.toLocaleLowerCase('pl').includes(atlasSearch.trim().toLocaleLowerCase('pl')));
  return (
    <>
      <div className="exercise-discovery-intro"><span><Flame size={22}/></span><div><strong>Ruch, który pasuje do Ciebie</strong><p>Na redukcji łącz cardio i siłę. Zacznij od ruchów, do których chcesz wracać.</p></div></div>
      <div className="exercise-focus" role="group" aria-label="Rodzaj treningu">
        {([{value:'',label:'Wszystkie',icon:Dumbbell},{value:'recommended',label:'Na początek',icon:Heart},{value:'cardio',label:'Cardio',icon:Flame},{value:'lowImpact',label:'Bez podskoków',icon:ShieldCheck},{value:'strength',label:'Siła',icon:Dumbbell}] as const).map(({value,label,icon:Icon})=><button key={value} className={focus===value?'active':''} aria-pressed={focus===value} onClick={()=>setFocus(value)}><Icon size={17}/>{label}</button>)}
      </div>
      <p className="muted library-count">{items.length} z {EXERCISES.length} ćwiczeń · instrukcje i pokaz offline</p>
      <div className="search-field">
        <Search size={20} />
        <input
          aria-label="Szukaj ćwiczenia"
          placeholder="Np. rower, przysiad, guma…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>
      <div className="filter-scroll">
        <button
          className={!equipment ? "active" : ""}
          onClick={() => setEquipment("")}
        >
          Wszystkie
        </button>
        {[...new Set(EXERCISES.map((e) => e.equipment))].map((type) => (
          <button
            key={type}
            className={equipment === type ? "active" : ""}
            onClick={() => setEquipment(type)}
          >
            {type}
          </button>
        ))}
      </div>
      <Field label="Partia ciała"><select value={muscle} onChange={e=>setMuscle(e.target.value)}><option value="">Wszystkie partie</option>{[...new Set(EXERCISES.map(e=>e.muscle))].sort().map(m=><option key={m}>{m}</option>)}</select></Field>
      {(search||equipment||muscle||focus)&&<button className="text-action" onClick={()=>{setSearch("");setEquipment("");setMuscle("");setFocus('');}}>Wyczyść wyszukiwanie i filtry</button>}
      {!onSelect&&<details className="card atlas-index">
        <summary><BookOpen size={24}/><span><strong>Atlas Fabryki Siły</strong><small>{ATLAS_INDEX.length} instrukcji na stronie źródłowej</small></span></summary>
        <div className="atlas-index-body">
          <p className="muted small">Przeszukaj spis ćwiczeń. Zdjęcia i filmy otwierają się na stronie Fabryki Siły i wymagają internetu.</p>
          <div className="search-field"><Search size={19}/><input aria-label="Szukaj w atlasie Fabryki Siły" placeholder="Szukaj w atlasie…" value={atlasSearch} onChange={e=>{setAtlasSearch(e.target.value);setAtlasLimit(40);}}/></div>
          <div className="atlas-index-results">
            {atlasItems.slice(0,atlasLimit).map(item=><button key={item.url} className="list-row" onClick={()=>void openExternal(item.url).catch(()=>toast('Nie udało się otworzyć atlasu.'))}><span className="row-text"><strong>{item.title}</strong><small>Fabryka Siły · instrukcja online</small></span><ArrowUpRight size={17}/></button>)}
          </div>
          {!atlasItems.length&&<p className="muted small">Nie znaleziono takiego ćwiczenia w atlasie.</p>}
          {atlasItems.length>atlasLimit&&<Button variant="secondary" className="full" onClick={()=>setAtlasLimit(value=>value+40)}>Pokaż kolejne · {atlasItems.length-atlasLimit}</Button>}
        </div>
      </details>}
      <div className="card list-card exercise-list">
        {items.map((e, i) => (
          <button
            className="list-row"
            key={e.id}
            style={{animationDelay:`${Math.min(i,10)*35}ms`}}
            aria-label={`${e.name} · ${e.muscle} · ${e.equipment}`}
            onClick={() =>
              onSelect ? onSelect(e) : show(<ExerciseDetails exercise={e} />)
            }
          >
            <img className="exercise-thumb" src={`/exercises/${e.demoId??e.id}/0.jpg`} alt="" loading="lazy"/>
            <span className="row-text">
              <strong>{e.name}</strong>
              <small>
                {e.muscle} · {e.equipment}
              </small>
            </span>
            {e.metric==='seconds'&&<span className="tag pro"><Timer size={12}/>na czas</span>}
            {onSelect ? <span className="round-btn soft"><Plus size={18} /></span> : <ChevronRight size={18} />}
          </button>
        ))}
      </div>
      {!items.length && (
        <Empty
          icon={Search}
          title="Nie ma takiego ćwiczenia"
          text="Spróbuj innej nazwy lub zmień filtr sprzętu."
        />
      )}
    </>
  );
}

export function ExerciseDetails({ exercise, slot }: { exercise: Exercise; slot?:PlanExercise }) {
  const { data } = useStore();
  const { run, toast } = useUI();
  const [url, setUrl] = useState("");
  const [mediaName, setMediaName] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(
    () => () => {
      if (url) URL.revokeObjectURL(url);
    },
    [url],
  );
  useEffect(() => {
    let current = "";
    let cancelled = false;
    void getMedia(exercise.id).then((m) => {
      if (m && !cancelled) {
        current = URL.createObjectURL(m.blob);
        setUrl(current);
        setMediaName(m.name);
      }
    });
    return () => {
      cancelled = true;
      if (current) URL.revokeObjectURL(current);
    };
  }, [exercise.id]);
  return (
    <Sheet title={exercise.name}>
      <p className="muted">
        {exercise.muscle} · {exercise.equipment} ·{" "}
        {loadLabel(exercise.loadType, exercise.id)}
      </p>
      {exercise.trainingType&&<div className="exercise-detail-tags"><span>{exerciseKind(exercise)==='cardio'?'Cardio':'Trening siłowy'}</span>{exercise.lowImpact&&<span>Bez podskoków</span>}<span>{exercise.level==='beginner'?'Poziom podstawowy':exercise.level==='expert'?'Poziom zaawansowany':'Poziom średni'}</span></div>}
      {slot&&<section className="plan-instructions" style={{padding:'16px'}}><strong>Ustawienia z Twojego planu</strong><p>{slot.sets} serie · {slotTarget(slot)} · zapas {slot.rir??'-'} · tempo {slot.tempo??'dowolne'}</p><p>{slot.notes}</p></section>}
      <ExerciseNote
        exerciseId={exercise.id}
        equipmentId={data.profiles[0].equipmentId}
      />
      {url ? (
        <>
          <video
            src={url}
            controls
            playsInline
            muted
            preload="metadata"
            className="exercise-video"
          />
          <small className="muted">{mediaName} · zapisany na telefonie</small>
          <Button
            variant="ghost"
            onClick={() =>
              void run(async () => {
                await removeMedia(exercise.id);
                URL.revokeObjectURL(url);
                setUrl("");
              }, "Film usunięty")
            }
          >
            <Trash2 size={16} />
            Usuń film
          </Button>
        </>
      ) : (
        <>
          <ExerciseDemo id={exercise.demoId??exercise.id} />
          <Button variant="ghost" onClick={() => inputRef.current?.click()}>
            <Plus size={17} />
            Dodaj własny film offline
          </Button>
        </>
      )}
      <input
        type="file"
        accept="video/*"
        hidden
        ref={inputRef}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file)
            void run(async () => {
              await saveMedia(exercise.id, file);
              if (url) URL.revokeObjectURL(url);
              setUrl(URL.createObjectURL(file));
              setMediaName(file.name);
              toast("Film zapisany. Dostępny także offline.");
            });
        }}
      />
      <h3 className="subheading">Przypomnij mi technikę</h3>
      <ol className="instruction-list">
        {exercise.instructions.map((t) => (
          <li key={t}>{t}</li>
        ))}
      </ol>
      <h3 className="subheading">Zwróć uwagę</h3>
      <ul className="plain-list">
        {exercise.mistakes.map((t) => (
          <li key={t}>{t}</li>
        ))}
      </ul>
      <p className="muted small">
        Instrukcja ogólna. Ustawienia i zakres ruchu dopasuj do własnego planu.
      </p>
    </Sheet>
  );
}

export function PlanEditor({ plan }: { plan?: Plan }) {
  const { put, remove, busy } = useStore();
  const { run, close, show } = useUI();
  const [name, setName] = useState(plan?.name ?? "Mój trening");
  const [minutes, setMinutes] = useState(String(plan?.minutes ?? 45));
  const [slots, setSlots] = useState<PlanExercise[]>(() =>
    structuredClone(plan?.exercises ?? []),
  );
  const [weekdays, setWeekdays] = useState(plan?.weekdays ?? []);
  const [adding, setAdding] = useState(false);
  const [program,setProgram]=useState(plan?.program??'');
  const [planNotes,setPlanNotes]=useState(plan?.notes??'');
  const [cardio,setCardio]=useState(plan?.cardio??'');
  const patch = (id: string, change: Partial<PlanExercise>) =>
    setSlots((v) => v.map((s) => (s.id === id ? { ...s, ...change } : s)));
  function move(index: number, by: number) {
    const next = [...slots];
    [next[index], next[index + by]] = [next[index + by], next[index]];
    setSlots(next);
  }
  return (
    <Sheet
      title={adding ? "Dodaj ćwiczenie" : plan ? "Edytuj plan" : "Nowy plan"}
      wide
    >
      {adding ? (
        <>
          <Button variant="ghost" onClick={() => setAdding(false)}>
            <ChevronLeft size={18} />
            Wróć do planu
          </Button>
          <ExerciseLibrary
            onSelect={(e) => {
              setSlots((v) => [
                ...v,
                {
                  ...defaultPlanExercise(e),
                },
              ]);
              setAdding(false);
            }}
          />
        </>
      ) : (
        <>
          <Field label="Nazwa treningu">
            <input
              maxLength={60}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </Field>
          <Field label="Szacowany czas · min">
            <input
              inputMode="numeric"
              value={minutes}
              onChange={(e) => setMinutes(e.target.value)}
            />
          </Field>
          <details className="advanced-plan"><summary>Program, zasady i cardio</summary><Field label="Nazwa programu · opcjonalnie"><input value={program} maxLength={100} placeholder="np. Rozruch / Hipertrofia" onChange={e=>setProgram(e.target.value)}/></Field><Field label="Zasady i uwagi"><textarea value={planNotes} maxLength={8000} onChange={e=>setPlanNotes(e.target.value)}/></Field><Field label="Cardio po treningu"><textarea value={cardio} maxLength={2000} placeholder="np. 20 min po treningu; progresja w kolejnych tygodniach" onChange={e=>setCardio(e.target.value)}/></Field></details>
          <label className="field">
            <span>Dni tygodnia · opcjonalnie</span>
          </label>
          <div className="day-select">
            {["Nd", "Pn", "Wt", "Śr", "Cz", "Pt", "So"].map((d, i) => (
              <button
                key={d}
                className={weekdays.includes(i) ? "active" : ""}
                onClick={() =>
                  setWeekdays((v) =>
                    v.includes(i) ? v.filter((x) => x !== i) : [...v, i],
                  )
                }
              >
                {d}
              </button>
            ))}
          </div>
          <div className="plan-editor-list">
            {slots.map((s, i) => (
              <div className="plan-editor-item" key={s.id}>
                <div className="item-head">
                  <h3>
                    {i + 1}. {exerciseById(s.exerciseId)?.name}
                  </h3>
                  <IconButton
                    icon={Trash2}
                    label="Usuń ćwiczenie z planu"
                    onClick={() =>
                      setSlots((v) => v.filter((x) => x.id !== s.id))
                    }
                  />
                </div>
                <div className="form-grid three">
                  <Field label="Serie">
                    <input
                      type="number"
                      min="1"
                      max="20"
                      value={s.sets}
                      onChange={(e) => patch(s.id, { sets: +e.target.value })}
                    />
                  </Field>
                  <Field label={`${resultLabel(resultMetric(s))} od`}>
                    <input
                      type="number"
                      min="1"
                      max={resultLimit(resultMetric(s))}
                      value={s.min}
                      onChange={(e) => patch(s.id, { min: +e.target.value })}
                    />
                  </Field>
                  <Field label={`${resultLabel(resultMetric(s))} do`}>
                    <input
                      type="number"
                      min="1"
                      max={resultLimit(resultMetric(s))}
                      value={s.max}
                      onChange={(e) => patch(s.id, { max: +e.target.value })}
                    />
                  </Field>
                </div>
                <div className="form-grid">
                  <Field label="Przerwa · s">
                    <input
                      type="number"
                      min="0"
                      max="1800"
                      value={s.rest}
                      onChange={(e) => patch(s.id, { rest: +e.target.value })}
                    />
                  </Field>
                  <Field label="Docelowy RIR" hint="Np. RIR 2: kończysz serię, choć mógłbyś zrobić jeszcze 2 poprawne powtórzenia.">
                    <input
                      type="number"
                      min="0"
                      max="10"
                      placeholder="Opcjonalnie"
                      value={s.rir ?? ""}
                      onChange={(e) =>
                        patch(s.id, {
                          rir: e.target.value === "" ? null : +e.target.value,
                        })
                      }
                    />
                  </Field>
                </div>
                <details className="advanced-plan"><summary>Obwód, tempo i progresja tygodniowa</summary>
                  <div className="form-grid"><Field label="Grupa obwodu"><input maxLength={8} placeholder="np. A albo B" value={s.group??''} onChange={e=>patch(s.id,{group:e.target.value.trim().toUpperCase()})}/></Field><Field label="Tempo ruchu"><input maxLength={12} placeholder="np. 3011 lub X" value={s.tempo??''} onChange={e=>patch(s.id,{tempo:e.target.value})}/></Field></div>
                  <p className="muted small">Tempo: opuszczanie / pauza / podnoszenie / pauza. Ćwiczenia w tej samej grupie wykonujesz kolejno w rundach.</p>
                  <Field label="Przerwa między ćwiczeniami obwodu · s"><input type="number" min="0" max="1800" value={s.restBetween??s.rest} onChange={e=>patch(s.id,{restBetween:+e.target.value})}/></Field>
                  <Field label="Jednostka wyniku"><select value={s.metric??exerciseById(s.exerciseId).metric??'reps'} onChange={e=>patch(s.id,changePlanMetric(s,e.target.value as NonNullable<PlanExercise['metric']>))}><option value="reps">Powtórzenia</option><option value="seconds">Sekundy</option><option value="distance">Metry</option></select></Field>
                  <Field label="Własny cel zamiast zakresu · opcjonalnie"><input maxLength={80} placeholder="np. MAX albo 30-45 s" value={s.target??''} onChange={e=>patch(s.id,{target:e.target.value})}/></Field>
                  <Field label="Serie w tygodniach 1-5"><div className="weekly-sets">{[0,1,2,3,4].map(w=><label key={w}><span>T{w+1}</span><input aria-label={`Serie w tygodniu ${w+1}`} type="number" min="1" max="20" value={s.weeklySets?.[w]??s.sets} onChange={e=>{const values=[...(s.weeklySets??Array(5).fill(s.sets))];values[w]=+e.target.value;patch(s.id,{weeklySets:values});}}/></label>)}</div></Field>
                </details>
                <Field
                  label="Przerwa po rozgrzewce · s"
                  hint="Osobny timer dla serii oznaczonych R. 0 wyłącza przerwę."
                >
                  <input
                    type="number"
                    min="0"
                    max="1800"
                    value={s.warmupRest ?? Math.min(60, s.rest)}
                    onChange={(e) =>
                      patch(s.id, { warmupRest: +e.target.value })
                    }
                  />
                </Field>
                <Field label="Ustawienia sprzętu i notatki">
                  <input
                    maxLength={500}
                    placeholder="np. siedzisko 4, maszyna nr 2"
                    value={s.notes}
                    onChange={(e) => patch(s.id, { notes: e.target.value })}
                  />
                </Field>
                <div className="order-buttons">
                  <Button
                    variant="ghost"
                    disabled={i === 0}
                    onClick={() => move(i, -1)}
                  >
                    <ArrowUp size={16} />
                    Wyżej
                  </Button>
                  <Button
                    variant="ghost"
                    disabled={i === slots.length - 1}
                    onClick={() => move(i, 1)}
                  >
                    <ArrowDown size={16} />
                    Niżej
                  </Button>
                </div>
              </div>
            ))}
          </div>
          <Button
            variant="secondary"
            className="full"
            onClick={() => setAdding(true)}
          >
            <Plus size={20} />
            Dodaj ćwiczenie
          </Button>
          <p className="muted small">
            Zmiana dotyczy przyszłych sesji. Zakończone i aktywne treningi
            zachowują swoją wersję planu. RIR to szacowany zapas powtórzeń.
          </p>
          <Button
            className="full"
            disabled={busy}
            onClick={() =>
              void run(async () => {
                if (!name.trim() || !slots.length || slots.length>80)
                  throw new Error(
                    "Podaj nazwę i dodaj co najmniej jedno ćwiczenie.",
                  );
                if (
                  slots.some(
                    (s) =>
                      !Number.isInteger(s.sets) ||
                      s.sets < 1 ||
                      s.sets > 20 ||
                      !Number.isInteger(s.min) ||
                      s.min < 1 ||
                      !Number.isInteger(s.max) ||
                      s.max > resultLimit(resultMetric(s)) ||
                      s.max < s.min ||
                      (s.weeklySets!==undefined&&(s.weeklySets.length!==5||s.weeklySets.some(n=>!Number.isInteger(n)||n<1||n>20))) ||
                      (s.restBetween!==undefined&&(!Number.isInteger(s.restBetween)||s.restBetween<0||s.restBetween>1800)) ||
                      s.rest < 0 ||
                      s.rest > 1800 ||
                      !Number.isFinite(s.rest) ||
                      (s.warmupRest !== undefined &&
                        (!Number.isInteger(s.warmupRest) ||
                          s.warmupRest < 0 ||
                          s.warmupRest > 1800)) ||
                      (s.rir !== null && (s.rir < 0 || s.rir > 10)),
                  )
                )
                  throw new Error("Sprawdź serie, zakres powtórzeń i przerwy.");
                const m = numberInput(minutes);
                if (!Number.isFinite(m) || m < 0 || m > 600)
                  throw new Error("Podaj czas od 0 do 600 minut (0 = bez szacowania).");
                await put("plans", {
                  ...plan,
                  ...stamp(plan?.id),
                  name: name.trim(),
                  subtitle: plan?.subtitle ?? "Twój własny plan",
                  minutes: m,
                  version: (plan?.version ?? 0) + 1,
                  exercises: slots,
                  weekdays,program:program.trim(),notes:planNotes.trim(),cardio:cardio.trim(),
                });
                close();
              }, "Plan zapisany")
            }
          >
            Zapisz plan <Check size={20} />
          </Button>
          {plan && (
            <Button
              variant="ghost"
              className="full danger-text"
              onClick={() =>
                show(
                  <Confirm
                    title="Usunąć plan?"
                    text="Wykonane treningi pozostaną w historii."
                    danger
                    confirm="Usuń plan"
                    onConfirm={() => remove("plans", plan.id)}
                  />,
                )
              }
            >
              Usuń plan
            </Button>
          )}
        </>
      )}
    </Sheet>
  );
}

function ActiveWorkout({ session,onBack }: { session: Session;onBack:()=>void }) {
  const { data, put, mutate, reload, busy } = useStore();
  const { show, run } = useUI();
  const profile = data.profiles[0];
  const [now, setNow] = useState(Date.now());
  const [showSetOptions,setShowSetOptions]=useState(false);
  const slots = session.planSnapshot.exercises;
  const index = Math.min(
    session.currentExercise,
    Math.max(0, slots.length - 1),
  );
  const slot = slots[index];
  const exercise = slot ? exerciseById(slot.exerciseId) : null;
  const allSets = data.sets.filter((s) => s.sessionId === session.id);
  const current = allSets
    .filter((s) => s.slotId === slot?.id)
    .sort((a, b) => a.index - b.index);
  const done = allSets.filter((s) => s.done).length;
  // A new deadline can arrive between timer ticks; a stale tick showed 1:01
  // immediately after starting a 60-second rest. Sample the actual clock here.
  const rest = Math.max(0, Math.ceil(((session.restEndsAt ?? 0) - Date.now()) / 1000));
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    if (session.restEndsAt && session.restEndsAt > Date.now())
      void scheduleRest(session.restEndsAt, profile.notifications).catch(
        () => {},
      );
  }, [session.restEndsAt, profile.notifications]);
  const previous = current.map((s) => {
    const ids = new Set(
      data.sessions
        .filter(
          (v) =>
            v.status === "finished" &&
            v.equipmentId === session.equipmentId &&
            v.id !== session.id,
        )
        .map((v) => v.id),
    );
    return data.sets
      .filter(
        (v) =>
          ids.has(v.sessionId) &&
          v.exerciseId === s.exerciseId &&
          resultMetric(v) === resultMetric(s) &&
          v.done &&
          v.type === s.type &&
          v.index === s.index,
      )
      .sort((a, b) => (b.completedAt ?? 0) - (a.completedAt ?? 0))[0];
  });
  const patchSession = (change: Partial<Session>) =>
    put("sessions", {
      ...session,
      ...change,
      updatedAt: new Date().toISOString(),
    });
  const next = () =>
    void run(() =>
      patchSession({ currentExercise: Math.min(index + 1, slots.length - 1) }),
    );
  const finish = () => show(<FinishWorkout session={session} />);
  async function addExercise(e: Exercise) {
    const newSlot: PlanExercise = defaultPlanExercise(e);
    await mutate([
      {
        table: "sessions",
        value: {
          ...session,
          planSnapshot: {
            ...session.planSnapshot,
            exercises: [...slots, newSlot],
          },
          currentExercise: slots.length,
          updatedAt: new Date().toISOString(),
        },
      },
      ...makeSets(session.id, newSlot, session.equipmentId).map((value) => ({
        table: "sets" as const,
        value,
      })),
    ]);
  }
  const paused=session.status==="paused";
  const restTotal=current.find(v=>v.type==='warmup'&&!v.done)?slot?.warmupRest??slot?.rest??60:slot?.rest??60;
  const toggle=()=>void run(async () => {await scheduleRest(0,false);await changeSessionControl(session.id,paused?'resume':'pause');await reload();});
  const metric=slot?(slot.metric??exercise?.metric):undefined;
  return (
    <div className={`active-workout ${paused?'is-paused':''} ${rest>0&&!paused?'is-resting':''}`}>
      <div className="live-session-header"><button className="live-back" aria-label="Wróć do planów" onClick={onBack}><ChevronDown size={22}/></button><span><strong>{session.planSnapshot.name}</strong><small>{session.planSnapshot.program||session.equipmentName}</small></span><button className="live-finish" onClick={finish}>Zakończ</button></div>
      <div className="live-timer-row"><div className="live-top"><span className="live-state"><span className={`live-dot ${paused ? "paused" : rest>0?'rest':''}`}/>{paused ? "Wstrzymany" : rest>0?'Przerwa':"Trwa"} · {done}/{allSets.length} serii{!paused&&<span className="eq" aria-hidden="true"><i/><i/><i/></span>}</span><strong>{secondsText(sessionSeconds(session, now))}</strong></div>
        <button className={`pause-pill ${paused?'resume':''}`} disabled={busy} onClick={toggle}>{paused ? <Play size={20}/> : <Pause size={20}/>}{paused ? "Wznów" : "Pauza"}</button>
      </div>
      <div className="session-progress"><i style={{width: `${allSets.length ? (done / allSets.length) * 100 : 0}%`}}/></div>
      {paused&&<div className="paused-banner"><PauseCircle size={20}/><span>Trening wstrzymany. Czas stoi, zapis serii zablokowany do wznowienia.</span></div>}
      {exercise && slot ? (
        <>
          <div className="exercise-switch session-exercise-tabs" role="tablist" aria-label="Ćwiczenia w sesji">
            {slots.map((item,i)=>{const itemSets=allSets.filter(s=>s.slotId===item.id);const complete=itemSets.length>0&&itemSets.every(s=>s.done||s.skipped);return <button key={item.id} role="tab" aria-selected={i===index} className={`${i===index?'active':''} ${complete?'complete':''}`} disabled={busy} onClick={()=>void run(()=>patchSession({currentExercise:i}))}><b>{item.group?item.group+String(slots.slice(0,i+1).filter(s=>s.group===item.group).length):i+1}</b> <small>{itemSets.filter(s=>s.done).length}/{itemSets.length}</small>{complete&&<CheckCircle size={15}/>}</button>;})}
          </div>
          <div className="current-exercise" key={slot.id}>
            <div className="current-exercise-heading"><img className="exercise-thumb" src={`/exercises/${exercise.demoId??exercise.id}/0.jpg`} alt=""/><div>{slot.group&&<span className="circuit-tag"><RefreshCw size={12}/> Obwód {slot.group}</span>}<h2>{exercise.name}</h2><p>Cel {slot.sets} × {slotTarget(slot)} · przerwa {secondsText(slot.rest)}{slot.rir!=null?` · RIR ${slot.rir}`:''}</p></div></div>
            <div className="exercise-tools">
              <button onClick={() => show(<ExerciseDetails exercise={exercise} slot={slot} />)}><BookOpen size={16}/>Technika</button>
              <button onClick={() => show(<SwapExercise session={session} slot={slot} />)}><Swap size={16}/>Zamień</button>
              <button onClick={()=>setShowSetOptions(v=>!v)} aria-label="Ustawienia serii i zapas powtórzeń" aria-pressed={showSetOptions}>{showSetOptions?'Ukryj RIR':'Pokaż RIR'}</button>
            </div>
            <p className="exercise-note"><Info size={14}/><span>{loadLabel(exercise.loadType, exercise.id)}{slot.tempo?` · tempo ${slot.tempo.split('').join('-')}`:''}{slot.notes?` · ${slot.notes}`:''}</span></p>
          </div>
          <div className={`set-table ${showSetOptions?'show-rir':''}`}>
            <div className="set-table-head">
              <span>Seria</span>
              <span>Poprzednio</span>
              <span>kg</span>
              <span>{metric==='seconds'?'s':metric==='distance'?'m':'Powt.'}</span>
              <span>RIR</span>
              <span />
            </div>
            {current.map((s, i) => (
              <SetRow
                key={s.id}
                set={s}
                previous={previous[i]}
                rest={slot.rest}
                warmupRest={slot.warmupRest ?? Math.min(60, slot.rest)}
                paused={paused}
                onSaved={async () => {
                  await reload();
                  await haptic(profile.haptics);
                }}
              />
            ))}
          </div>
          {showSetOptions&&<button className="rir-help-link" onClick={()=>show(<TrainingGlossary/>)}><Info size={17}/> Co oznaczają RIR i RPE?</button>}
          <div className="set-actions">
            <button disabled={busy||paused||current.length>=20} onClick={() => void run(async()=>{await appendWorkoutSet(session.id,slot.id);await reload();})}><Plus size={15}/>Seria</button>
            <button disabled={busy || paused || slot.rest === 0} onClick={() => void run(() => patchSession({ restEndsAt: Date.now() + slot.rest * 1000 }))}><Timer size={15}/>Przerwa</button>
            <button onClick={() => show(<ExercisePicker onSelect={addExercise} />)}><Plus size={15}/>Ćwiczenie</button>
          </div>
          {index < slots.length - 1 ? <button className="next-exercise" onClick={next}><span><small>Następne</small><strong>{exerciseById(slots[index+1].exerciseId)?.name}</strong></span><ArrowRight size={20}/></button>
          : <button className="pill-btn primary wide" onClick={finish}>Zakończ trening</button>}
          <details className="session-settings"><summary>Moje ustawienia i wskazówki</summary><ExerciseNote key={`${session.equipmentId}-${exercise.id}`} exerciseId={exercise.id} equipmentId={session.equipmentId}/>{exercise.loadType==='barbell'&&<Button variant="ghost" onClick={()=>show(<Calculators initialTab="plates" initialTarget={current.find(s=>!s.done)?.draft?.weight??String(current.find(s=>!s.done)?.weight||previous[0]?.weight||'')}/>)}><Calculator size={18}/>Rozłóż ciężar na talerze</Button>}<button className="spotify-row" onClick={() => void run(() => openSpotify(profile.spotify))}><span className="spotify-badge"><Headphones size={20}/></span><span className="row-text"><strong>Playlista na trening</strong><small>Otwiera aplikację Spotify</small></span><ArrowUpRight size={18}/></button></details>
          <button
            className="pain-btn"
            onClick={() =>
              show(
                <Confirm
                  title="Przerwać to ćwiczenie?"
                  text="Zapisane serie pozostaną w historii. Zaznaczymy zgłoszony ból i wyłączymy porównania tej sesji."
                  danger
                  confirm="Przerwij ruch"
                  onConfirm={async () => {
                    await patchSession({
                      pain: true,
                      comparable: false,
                      currentExercise: Math.min(index + 1, slots.length - 1),
                      restEndsAt: null,
                    });
                  }}
                />,
              )
            }
          >
            Odczuwam ból - przerwij ruch
          </button>
        </>
      ) : (
        <Empty
          icon={Dumbbell}
          title="Zacznij od pierwszego ruchu"
          text="Dodaj ćwiczenie, a pojawią się pola do zapisu serii."
        >
          <Button
            onClick={() => show(<ExercisePicker onSelect={addExercise} />)}
          >
            <Plus size={20} />
            Dodaj ćwiczenie
          </Button>
        </Empty>
      )}
      <details className="session-order">
        <summary>Wszystkie ćwiczenia · {slots.length}</summary>
        {slots.map((s, i) => (
          <div className="list-row" key={s.id}>
            <button
              className="exercise-order-name"
              onClick={() =>
                void run(() => patchSession({ currentExercise: i }))
              }
            >
              {i + 1}. {exerciseById(s.exerciseId).name}
              <small>
                {allSets.filter((v) => v.slotId === s.id && v.done).length}/
                {allSets.filter((v) => v.slotId === s.id).length} serii
              </small>
            </button>
            {i < slots.length - 1 && (
              <IconButton
                icon={ArrowDown}
                label="Przenieś później"
                onClick={() =>
                  void run(async () => {
                    const updated = [...slots];
                    [updated[i], updated[i + 1]] = [updated[i + 1], updated[i]];
                    await patchSession({
                      planSnapshot: {
                        ...session.planSnapshot,
                        exercises: updated,
                      },
                    });
                  })
                }
              />
            )}
          </div>
        ))}
      </details>
      <Saved />
      {rest > 0 && !paused && (
        <div className="rest-timer" role="status">
          <Ring value={rest/Math.max(rest,restTotal)} size={52} stroke={6} color="var(--on-acc)" track="rgba(255,255,255,.22)"/>
          <span className="rest-text"><small>Przerwa · potem {exercise?.name??'kolejna seria'}</small><strong className={rest<=5?'urgent':''}>{secondsText(rest)}</strong></span>
          <button aria-label="Skróć przerwę o 15 sekund" onClick={() => void run(() => patchSession({ restEndsAt: Math.max(Date.now(), session.restEndsAt! - 15000) }))}>−15 s</button>
          <button onClick={() => void run(() => patchSession({ restEndsAt: session.restEndsAt! + 30000 }))}>+30 s</button>
          <button className="rest-skip" aria-label="Pomiń przerwę" onClick={() => void run(async () => { await scheduleRest(0, false); await patchSession({ restEndsAt: null }); })}>Pomiń</button>
          <i className="rest-bar" style={{width:`${Math.min(100,rest/Math.max(rest,restTotal)*100)}%`}}/>
        </div>
      )}
    </div>
  );
}

function SetRow({
  set,
  previous,
  rest,
  warmupRest,
  paused,
  onSaved,
}: {
  set: WorkoutSet;
  previous?: WorkoutSet;
  rest: number;
  warmupRest: number;
  paused: boolean;
  onSaved: () => Promise<void>;
}) {
  const { reload } = useStore();
  const { run, toast } = useUI();
  const saving = useRef(false);
  const [weight, setWeight] = useState(
    set.draft?.weight ?? (set.weight ? String(set.weight) : ""),
  );
  const [reps, setReps] = useState(
    set.draft?.reps ?? (set.reps ? String(set.reps) : ""),
  );
  const [rir, setRir] = useState(
    set.draft?.rir ?? (set.rir !== null ? String(set.rir) : ""),
  );
  const [kind, setKind] = useState(set.type);
  useEffect(() => {
    setWeight(set.draft?.weight ?? (set.weight ? String(set.weight) : ""));
    setReps(set.draft?.reps ?? (set.reps ? String(set.reps) : ""));
    setRir(set.draft?.rir ?? (set.rir === null ? "" : String(set.rir)));
    setKind(set.type);
  }, [
    set.weight,
    set.reps,
    set.rir,
    set.type,
    set.draft?.weight,
    set.draft?.reps,
    set.draft?.rir,
  ]);
  const changeDraft = (
    change: Partial<NonNullable<WorkoutSet["draft"]>>,
    type = kind,
  ) => {
    const draft = { weight, reps, rir, ...change };
    setWeight(draft.weight);
    setReps(draft.reps);
    setRir(draft.rir);
    setKind(type);
    void saveSetDraft(set.id, draft, type).catch(() =>
      toast("Nie udało się zachować pól serii. Sprawdź pamięć telefonu."),
    );
  };
  const parse = () => {
    const w = weight.trim() ? numberInput(weight) : 0;
    const r = numberInput(reps);
    const ri = rir.trim() ? numberInput(rir) : null;
    if (
      !Number.isFinite(w) ||
      w < 0 ||
      w > 2000 ||
      !Number.isInteger(r) ||
      r < 1 ||
      r > resultLimit(resultMetric(set)) ||
      (ri !== null && (!Number.isFinite(ri) || ri < 0 || ri > 10))
    )
      throw new Error(`Sprawdź ciężar, wynik w ${resultUnit(resultMetric(set))} i zapas powtórzeń (0-10).`);
    return {
      ...set,
      weight: w,
      reps: r,
      rir: ri,
      type: kind,
      updatedAt: new Date().toISOString(),
    };
  };
  const label=kind==='warmup'?'R':kind==='assisted'?'P':String(set.index+1);
  const save=() => {
    if (saving.current) return;
    saving.current = true;
    void run(async () => {
      const next = parse();
      const changed = await completeSet(
        next,
        kind === "warmup" ? warmupRest : rest,
      );
      if (changed) {
        await onSaved();
        toast("Seria zapisana");
      }
    }).finally(() => {
      saving.current = false;
    });
  };
  return (
    <div
      className={`set-row-wrap ${set.done ? "done" : ""} ${set.skipped ? "skipped" : ""} ${kind}`}
    >
      <div className="set-row">
        <label className="set-kind"><span aria-hidden="true">{label}</span>
        <select
          aria-label={`Typ serii ${set.index + 1}`}
          disabled={set.done || set.skipped || paused}
          value={kind}
          onChange={(e) =>
            changeDraft({}, e.target.value as WorkoutSet["type"])
          }
        >
          <option value="work">{set.index + 1} · robocza</option>
          <option value="warmup">R · rozgrzewka</option>
          <option value="assisted">P · z pomocą</option>
        </select></label>
        {previous && previous.type === kind && !set.done && !set.skipped ? (
          <button
            className="set-prev"
            disabled={paused}
            aria-label={`Kopiuj poprzedni wynik: ${fmt(previous.weight, 2)} × ${previous.reps}`}
            onClick={() => {
              changeDraft({
                weight: String(previous.weight),
                reps: String(previous.reps),
                rir: previous.rir === null ? "" : String(previous.rir),
              });
            }}
          >
            {fmt(previous.weight, 2)} × {previous.reps}
          </button>
        ) : (
          <span className="set-prev">{set.skipped ? <b>Pominięta</b> : set.done ? 'Zapisano' : kind === "warmup" ? "Rozgrzewka" : kind === "assisted" ? "Z pomocą" : "-"}</span>
        )}
        <input
          aria-label={`Ciężar serii ${set.index + 1}`}
          disabled={set.done || set.skipped || paused}
          inputMode="decimal"
          maxLength={12}
          placeholder={previous&&previous.type===kind?fmt(previous.weight,2):"0"}
          value={weight}
          onChange={(e) => changeDraft({ weight: e.target.value })}
        />
        <input
          aria-label={`${(set.metric??exerciseById(set.exerciseId).metric)==='seconds'?'Sekundy':(set.metric??exerciseById(set.exerciseId).metric)==='distance'?'Metry':'Powtórzenia'} serii ${set.index + 1}`}
          disabled={set.done || set.skipped || paused}
          inputMode="numeric"
          maxLength={12}
          placeholder={previous&&previous.type===kind?String(previous.reps):"-"}
          value={reps}
          onChange={(e) => changeDraft({ reps: e.target.value })}
        />
        <input
          className="rir-input"
          aria-label={`RIR serii ${set.index + 1}`}
          disabled={set.done || set.skipped || paused}
          inputMode="decimal"
          maxLength={12}
          placeholder="-"
          value={rir}
          onChange={(e) => changeDraft({ rir: e.target.value })}
        />
        {set.done || set.skipped ? (
          <button
            className={set.done ? "set-check is-done" : "set-undo"}
            disabled={paused}
            aria-label={`Cofnij serię ${set.index + 1}`}
            onClick={() =>
              void run(() => changeSetStatus(set.id, "undo").then(reload))
            }
          >
            {set.done ? <CheckFat size={22} className="pop" /> : <Undo2 size={18} />}
          </button>
        ) : (
          <button
            className="set-check"
            disabled={paused}
            aria-label={`Zapisz serię ${set.index + 1}`}
            onClick={save}
          >
            <Check size={20} />
          </button>
        )}
        {set.done && <span className="float-plus" aria-hidden="true"><CheckCircle size={18}/>+1 seria</span>}
      </div>
      {(!set.done && !set.skipped) ? (
        <div className="set-extra">
          <button
            aria-label={`Pomiń serię ${set.index + 1}`}
            disabled={paused}
            onClick={() =>
              void run(() => changeSetStatus(set.id, "skip").then(reload))
            }
          >
            <SkipForward size={13}/>Pomiń
          </button>
        </div>
      ) : set.done ? (
        <div className="set-extra">
          <button
            className="copy-set"
            disabled={paused}
            aria-label={`Powiel serię ${set.index + 1} do pustych serii`}
            onClick={() =>
              void run(async () => {
                const count = await copySetToRemaining(set.id);
                await reload();
                toast(
                  count
                    ? `Uzupełniono ${count} ${plural(count, "pustą serię", "puste serie", "pustych serii")}. Potwierdź je po wykonaniu.`
                    : "Nie ma pustych serii tego samego typu. Wpisane wyniki zachowano.",
                );
              })
            }
          >
            <Copy size={13} />
            Do pustych
          </button>
          <span>Dotknij ✓, aby cofnąć</span>
        </div>
      ) : null}
    </div>
  );
}

function ExerciseNote({
  exerciseId,
  equipmentId,
}: {
  exerciseId: string;
  equipmentId: string;
}) {
  const { data, reload } = useStore();
  const { run } = useUI();
  const equipment = data.equipment.find((e) => e.id === equipmentId);
  const saved = equipment?.exerciseNotes?.[exerciseId] ?? "";
  const [text, setText] = useState(saved);
  const [editing, setEditing] = useState(false);
  return (
    <div className="exercise-note">
      <div className="exercise-note-head">
        <strong>Moje ustawienia</strong>
        <span>{equipment?.name}</span>
      </div>
      {editing ? (
        <>
          <Field
            label="Notatka do ćwiczenia w tym miejscu"
            hint="Zostanie przy tym ćwiczeniu w kolejnych treningach, także w innym planie."
          >
            <textarea
              rows={3}
              maxLength={1500}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="np. siedzisko 4, uchwyt na wysokości 6"
            />
          </Field>
          <div className="button-row">
            <Button
              onClick={() =>
                void run(async () => {
                  await saveExerciseNote(equipmentId, exerciseId, text);
                  await reload();
                  setEditing(false);
                }, "Ustawienia zapisane na kolejne treningi")
              }
            >
              Zapisz ustawienia
            </Button>
            <Button variant="ghost" onClick={() => setEditing(false)}>
              Anuluj
            </Button>
          </div>
        </>
      ) : (
        <>
          {saved && <p className="pinned-note">{saved}</p>}
          <Button
            variant="ghost"
            onClick={() => {
              setText(saved);
              setEditing(true);
            }}
          >
            <Edit3 size={16} />
            {saved ? "Edytuj ustawienia" : "Dodaj ustawienia ćwiczenia"}
          </Button>
        </>
      )}
    </div>
  );
}

function ExercisePicker({
  onSelect,
}: {
  onSelect: (e: Exercise) => Promise<void>;
}) {
  const { run, close } = useUI();
  return (
    <Sheet title="Dodaj ćwiczenie" wide>
      <ExerciseLibrary
        onSelect={(e) =>
          void run(async () => {
            await onSelect(e);
            close();
          })
        }
      />
    </Sheet>
  );
}
function SwapExercise({
  session,
  slot,
}: {
  session: Session;
  slot: PlanExercise;
}) {
  const { data, reload } = useStore();
  const { run, close } = useUI();
  const [all,setAll]=useState(false);
  const select=(e:Exercise)=>void run(async()=>{await replaceSessionExercise(session.id,slot.id,e.id);await reload();close();},'Zamieniono pozostałe serie ćwiczenia');
  const exercise = exerciseById(slot.exerciseId);
  const place = data.equipment.find((e) => e.id === session.equipmentId);
  const alternatives = exercise.alternatives
    .map(exerciseById)
    .filter((e) => e && (!place || place.types.includes(e.equipment)));
  return (
    <Sheet title="Sprzęt zajęty? Zmień ruch.">
      <p className="muted">
        Zamienisz tylko pozostałe serie w tej sesji. Wykonane serie zostaną w historii przy poprzednim ruchu. Ciężary nie zostaną skopiowane.
      </p>
      {all?<ExerciseLibrary onSelect={select}/>:alternatives.length ? (
        alternatives.map((e) => (
          <button
            key={e.id}
            className="list-row"
            onClick={() =>
              void run(async () => {
                await replaceSessionExercise(session.id,slot.id,e.id);
                await reload();
                close();
              }, "Ćwiczenie zamienione")
            }
          >
            <span>
              <strong>{e.name}</strong>
              <small>
                {e.pattern} · {e.equipment} · {loadLabel(e.loadType, e.id)}
              </small>
            </span>
            <Shuffle size={20} />
          </button>
        ))
      ) : (
        <Empty
          icon={Shuffle}
          title="Brak zamiennika w tym profilu sprzętu"
          text="Możesz dodać inne ćwiczenie do sesji lub zmienić profil miejsca w ustawieniach."
        />
      )}
      <Button variant="secondary" className="full" onClick={()=>setAll(v=>!v)}>{all?'Pokaż proponowane zamienniki':'Pełna biblioteka zamienników'}</Button>
    </Sheet>
  );
}
function FinishWorkout({ session }: { session: Session }) {
  const { data, put, busy } = useStore();
  const { run, close } = useUI();
  const sets = data.sets.filter((s) => s.sessionId === session.id);
  const done = sets.filter((s) => s.done).length;
  const [note, setNote] = useState(session.note);
  const [mood, setMood] = useState(session.mood || "");
  return (
    <Sheet title="Zakończyć trening?">
      <div className="finish-stats">
        <div>
          <strong>{done}</strong>
          <span>zapisanych serii</span>
        </div>
        <div>
          <strong>{Math.round(sessionSeconds(session) / 60)}</strong>
          <span>min aktywnego czasu</span>
        </div>
      </div>
      <p className="muted">
        {sets.length - done > 0
          ? `${sets.length - done} serii nie jest ukończonych. Pozostaną oznaczone jako niewykonane.`
          : "Wszystkie serie zapisane. Dobra robota."}
      </p>
      <Field label="Samopoczucie · opcjonalnie">
        <select value={mood} onChange={(e) => setMood(e.target.value)}>
          <option value="">Wybierz, jeśli chcesz</option>
          <option>Dużo energii</option>
          <option>W porządku</option>
          <option>Zmęczenie</option>
        </select>
      </Field>
      <Field label="Notatka do sesji">
        <textarea
          maxLength={1000}
          rows={3}
          placeholder="Co warto zapamiętać na kolejny raz?"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      </Field>
      <Button
        disabled={busy}
        className="full"
        onClick={() =>
          void run(async () => {
            await put("sessions", {
              ...session,
              note,
              mood,
              status: "finished",
              endedAt: Date.now(),
              pausedMs:
                session.pausedMs +
                (session.status === "paused"
                  ? Date.now() - session.pausedAt!
                  : 0),
              pausedAt: null,
              restEndsAt: null,
              updatedAt: new Date().toISOString(),
            });
            await scheduleRest(0, false);
            close();
          }, "Trening zapisany w historii")
        }
      >
        Zakończ i zapisz <Check size={20} />
      </Button>
      <Button variant="ghost" className="full" onClick={close}>
        Wróć do treningu
      </Button>
    </Sheet>
  );
}
export function SessionDetail({ sessionId }: { sessionId: string }) {
  const { data, mutate } = useStore();
  const { show } = useUI();
  const session = data.sessions.find((s) => s.id === sessionId);
  if (!session) return null;
  const sets = data.sets.filter((s) => s.sessionId === sessionId && s.done);
  return (
    <Sheet title={session.planSnapshot.name} wide>
      <p className="muted">
        {dateLabel(session.date)} · {session.equipmentName} · plan v
        {session.planSnapshot.version}
      </p>
      <div className="finish-stats">
        <div>
          <strong>{sets.length}</strong>
          <span>wykonanych serii</span>
        </div>
        <div>
          <strong>{Math.round(sessionSeconds(session) / 60)}</strong>
          <span>minut</span>
        </div>
      </div>
      <p className="muted small">
        Tonaż zewnętrzny: {fmt(externalVolume(sets))} kg · Nie obejmuje masy
        ciała i asysty.
      </p>
      {session.note && <p>{session.note}</p>}
      {session.mood && <p className="muted">Samopoczucie: {session.mood}</p>}
      {session.pain && (
        <p className="inline-warning">
          Zgłoszono ból. Sesja wyłączona z porównań progresji.
        </p>
      )}
      {sets.map((s) => (
        <button
          key={s.id}
          className="list-row"
          onClick={() => show(<SetCorrection set={s} />)}
        >
          <span>
            <strong>{exerciseById(s.exerciseId)?.name ?? s.exerciseId}</strong>
            <small>
              Seria {s.index + 1} · {loadLabel(s.loadType, s.exerciseId)} ·{" "}
              {s.type === "warmup"
                ? "rozgrzewka"
                : s.type === "assisted"
                  ? "z pomocą"
                  : "robocza"}
            </small>
          </span>
          <strong>
            {fmt(s.weight, 2)} kg × {s.reps} {resultUnit(resultMetric(s))}
          </strong>
          <Edit3 size={17} />
        </button>
      ))}
      <Button
        variant="ghost"
        className="full danger-text"
        onClick={() => show(<Confirm
          title="Usunąć ten trening?"
          text="Sesja i wszystkie jej serie znikną z historii oraz statystyk."
          danger
          confirm="Usuń trening"
          onConfirm={() => mutate([
            ...data.sets.filter(set => set.sessionId === session.id).map(set => ({table:"sets" as const,remove:set.id})),
            {table:"sessions",remove:session.id},
          ])}
        />)}
      >
        <Trash2 size={18}/> Usuń trening
      </Button>
    </Sheet>
  );
}
function SetCorrection({ set }: { set: WorkoutSet }) {
  const { put } = useStore();
  const { run, close } = useUI();
  const [weight, setWeight] = useState(String(set.weight));
  const [reps, setReps] = useState(String(set.reps));
  return (
    <Sheet title="Popraw wynik serii">
      <p className="muted">Korekta zmieni ten zapis i zależne statystyki.</p>
      <Field label={`Ciężar · ${loadLabel(set.loadType, set.exerciseId)}`}>
        <input
          inputMode="decimal"
          value={weight}
          onChange={(e) => setWeight(e.target.value)}
        />
      </Field>
      <Field label={resultLabel(resultMetric(set))}>
        <input
          inputMode="numeric"
          value={reps}
          onChange={(e) => setReps(e.target.value)}
        />
      </Field>
      <Button
        className="full"
        onClick={() =>
          void run(async () => {
            const w = numberInput(weight),
              r = numberInput(reps);
            if (
              !Number.isFinite(w) ||
              w < 0 ||
              w > 2000 ||
              !Number.isInteger(r) ||
              r < 1 ||
              r > resultLimit(resultMetric(set))
            )
              throw new Error("Podaj prawidłowe wartości.");
            await put("sets", {
              ...set,
              weight: w,
              reps: r,
              updatedAt: new Date().toISOString(),
            });
            close();
          }, "Wynik poprawiony")
        }
      >
        Zapisz korektę
      </Button>
    </Sheet>
  );
}

