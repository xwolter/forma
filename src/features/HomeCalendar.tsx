import { CalendarBlank, ChevronLeft, ChevronRight } from '../ui/icons';
import { useStore } from '../core/store';
import { dateLabel, localDate, shiftDate, plural } from '../core/math';
import { weekDates, weekCaption } from '../core/calendar';
import { DateNav, IconButton } from '../ui/UI';

export function HomeCalendar({date,setDate}:{date:string;setDate:(d:string)=>void}) {
  const {data}=useStore(),today=localDate(),days=weekDates(date),goal=data.profiles[0].days;
  const finished=new Set(data.sessions.filter(s=>s.status==='finished'&&s.date>=days[0]&&s.date<=days[6]).map(s=>s.date));
  return <section className="home-calendar" aria-label="Kalendarz tygodnia">
    <div className="screen-title rise"><h1>Twój tydzień</h1><p><b>{finished.size} z {goal}</b> dni z treningiem{finished.size>=goal?' · cel osiągnięty':` · jeszcze ${goal-finished.size} ${plural(goal-finished.size,'dzień','dni','dni')}`}</p></div>
    <div className="card week-card rise d1">
      <div className="home-week-navigation">
        <IconButton icon={ChevronLeft} label="Poprzedni tydzień" onClick={()=>setDate(shiftDate(date,-7))}/>
        <div className="week-date-control"><CalendarBlank size={18}/><DateNav date={date} onChange={setDate} label={weekCaption(date)}/></div>
        <button className="return-today" disabled={date===today} onClick={()=>setDate(today)}>Dziś</button>
        <IconButton icon={ChevronRight} label="Następny tydzień" onClick={()=>setDate(shiftDate(date,7))}/>
      </div>
      <div className="week-strip">{days.map((d,i)=>{
        const done=finished.has(d),hasFood=data.food.some(e=>e.date===d),planned=data.plans.some(p=>p.weekdays.includes(new Date(d+'T12:00:00').getDay()));
        return <button key={d} onClick={()=>setDate(d)} className={`${d===date?'selected':''} ${d===today?'is-today':''} ${d>today?'future':''}`} aria-label={dateLabel(d)} aria-current={d===date?'date':undefined} aria-description={`${done?'Zapisany trening':planned?'Dzień z planem treningowym':'Bez treningu'}${hasFood?', zapisane posiłki':''}`}>
          <span>{['Pn','Wt','Śr','Cz','Pt','So','Nd'][i]}</span><strong>{Number(d.slice(-2))}</strong>
          <span className="week-day-status" aria-hidden="true"><i className={done?'done':planned?'planned':'empty'}/><i className={hasFood?'food':'empty'}/></span>
        </button>;
      })}</div>
      <div className="week-legend" aria-hidden="true"><span><i className="done"/>trening</span><span><i className="planned"/>plan</span><span><i className="food"/>jedzenie</span></div>
    </div>
  </section>;
}
