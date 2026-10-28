import { Activity, Check, LogIn, Utensils } from '../ui/icons';
import { useStore } from "../core/store";
import { habitDates, streakStats } from "../core/streaks";
import { dateLabel, localDate } from "../core/math";
import { LiveFlame, Sheet, useUI } from "../ui/UI";

const habits = [
  { id: 'open', title: 'Powroty', icon: LogIn, description: 'Otwarcie aplikacji w danym dniu. Odwiedzanie poprzednich dat nie dopisuje otwarć. Historia zaczyna się od tej aktualizacji.' },
  { id: 'movement', title: 'Ruch', icon: Activity, description: 'Co najmniej jedna wykonana seria ćwiczenia lub zapisana aktywność, np. spacer. Samo dodanie ćwiczenia do planu nie oznacza wykonania. Odpoczynek jest częścią treningu.' },
  { id: 'food', title: 'Jedzenie', icon: Utensils, description: 'Co najmniej jeden zjedzony posiłek w dzienniku. Plany posiłków nie są liczone. Liczy się zapis jedzenia, niezależnie od celu kalorii.' },
] as const;
type Habit = typeof habits[number];
export function Streaks() {
  const { data } = useStore();
  const { show } = useUI();
  const dates = habitDates(data), today = localDate();
  return <section className="streak-section rise d5" aria-label="Serie dni">
    <div className="block-title split"><h2>Serie dni</h2><small>Stan na dziś, {dateLabel(today, { day: 'numeric', month: 'short' })}</small></div>
    <div className="card streak-grid">
      {habits.map((h, i) => {
        const s = streakStats(dates[h.id], today);
        return <button key={h.id} className="streak-card" style={{animationDelay:`${i*60}ms`}} onClick={() => show(<StreakDetail habit={h} />)} aria-label={`${h.title}: seria ${s.current} ${s.current === 1 ? 'dzień' : 'dni'}, ${s.todayDone ? 'dzisiaj zaliczone' : 'dzisiaj jeszcze bez wpisu'}`}>
          <LiveFlame lit={s.current > 0 && s.todayDone}/>
          <strong>{s.current}</strong>
          <span>{h.title}</span>
          <small className={s.todayDone ? 'ok' : ''}>{s.todayDone ? 'dziś ✓' : 'dziś bez wpisu'}</small>
        </button>;
      })}
    </div>
  </section>;
}
function StreakDetail({ habit }: { habit: Habit }) {
  const { data } = useStore();
  const s = streakStats(habitDates(data)[habit.id], localDate());
  return <Sheet title={`Seria: ${habit.title}`}>
    <div className="streak-coin-wrap"><div className="streak-coin"><div className="coin-front"><LiveFlame size={56}/></div><div className="coin-back"><strong>{s.current}</strong><span>{s.current === 1 ? 'dzień' : 'dni z rzędu'}</span></div></div></div>
    <div className="stat-grid two"><div className="stat-tile"><strong>{s.current} {s.current === 1 ? 'dzień' : 'dni'}</strong><small>obecna seria{s.todayDone ? ' · dziś zaliczone' : ''}</small></div><div className="stat-tile"><strong>{s.longest} {s.longest === 1 ? 'dzień' : 'dni'}</strong><small>rekord · wszystkie dni: {s.total}</small></div></div>
    <p>{habit.description}</p>
    <p className="muted small">Ostatnie 30 dni · {s.last30}/30 · stan na dziś, {dateLabel(localDate(), { day: 'numeric', month: 'short' })}</p>
    <div className="streak-calendar" role="list" aria-label={`Kalendarz: ${habit.title}`}>
      {s.calendar.map(d => <div key={d.date} role="listitem" className={d.done ? 'done' : ''} aria-label={`${dateLabel(d.date)}: ${d.done ? 'zaliczone' : 'bez wpisu'}`}>
        <strong>{Number(d.date.slice(-2))}</strong>{d.done ? <Check size={12} /> : <span>·</span>}
      </div>)}
    </div>
    <p className="muted small">Kilka wpisów jednego dnia to jeden aktywny dzień. Seria z wczoraj pozostaje aktualna do końca dzisiejszego dnia. Przerwa nie usuwa wcześniejszych dni ani rekordu.</p>
  </Sheet>;
}
