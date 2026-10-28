import { useState } from 'react';
import { SpotifyLogo } from '@phosphor-icons/react/dist/csr/SpotifyLogo';
import { Plus, Scale, Calculator, Droplet, Clock, Play, ArrowRight, ArrowUpRight, CalendarBlank, Timer, Info, Walk, Fish, Grains, Fire, Notebook, Warning } from '../ui/icons';
import { useStore } from '../core/store';
import { dateLabel, dayTotals, fmt, goalForDate, localDate } from '../core/math';
import type { Goal, Nutrients, Plan, Tab } from '../core/types';
import { Ring, Segments, useUI } from '../ui/UI';
import { WeightForm, ActivityForm, GoalForm } from './forms';
import { dailyInspiration } from '../core/daily';
import { updateDaily } from '../core/db';
import { openSpotify } from '../core/native';
import { Calculators } from './Calculators';
import { Streaks } from './Streaks';
import { AddFood } from './Food';
import { SportPhoto } from './SportPhoto';
import { HomeCalendar } from './HomeCalendar';
import { HomeMeals } from './HomeMeals';
import { stamp } from '../core/catalog';

export function Today({date,setDate,navigate,start}:{date:string;setDate:(d:string)=>void;navigate:(t:Tab)=>void;start:(p:Plan)=>void}) {
  const {data,reload}=useStore(),{show,run}=useUI();
  const [view,setView]=useState<'training'|'food'>('training');
  const today=localDate(),profile=data.profiles[0],daily=data.daily.find(d=>d.date===date);
  const active=data.sessions.find(s=>s.date===date&&(s.status==='active'||s.status==='paused'));
  const anyActive=data.sessions.some(s=>s.status==='active'||s.status==='paused');
  const scheduled=data.plans.filter(p=>p.weekdays.includes(new Date(date+'T12:00:00').getDay()));
  const completed=data.sessions.filter(s=>s.date===date&&s.status==='finished');
  const plan=scheduled.length===1?scheduled[0]:undefined;
  const canStart=Boolean(plan&&date===today&&!active&&!completed.length&&!data.sessions.some(s=>s.status==='active'||s.status==='paused'));
  const latest=data.measurements.filter(m=>m.date<=date).sort((a,b)=>b.date.localeCompare(a.date))[0];
  const inspiration=dailyInspiration(date),eaten=data.food.filter(e=>e.date===date&&e.status==='consumed');
  const title=active?.planSnapshot.name??completed[0]?.planSnapshot.name??(date<today?'Brak zapisanego treningu':plan?.name??(scheduled.length>1?'Wybierz plan na ten dzień':date===today?'Dzisiaj bez planu':'Dzień bez planu'));
  const description=active?`${data.sets.filter(s=>s.sessionId===active.id&&s.done).length} zapisanych serii · ${active.status==='paused'?'trening wstrzymany':'trening trwa'}`:completed.length?'Trening zapisany. Możesz przejrzeć wyniki.':date<today?'Możesz przejrzeć swoje treningi i plany.':plan?`${plan.exercises.length} ćwiczeń · około ${plan.minutes} min. Czas ruszy po rozpoczęciu.`:scheduled.length>1?`${scheduled.length} plany przypisane do tego dnia. Wybierz swój trening.`:'Odpocznij lub wybierz własny trening.';
  const action=active?'Wróć do treningu':completed.length||date<today?'Zobacz treningi':canStart?'Rozpocznij trening':'Wybierz trening';
  const canFree=date===today&&!anyActive&&!completed.length&&!scheduled.length;
  const freeSession=()=>start({...stamp('free'),name:'Trening bez planu',subtitle:'Własna sesja',minutes:0,version:1,weekdays:[],exercises:[]});
  const kicker=active?'Trening w toku':completed.length?'Zapisany trening':plan?(date===today?'Plan na dziś':'Plan na ten dzień'):scheduled.length>1?'Plany na ten dzień':'Twój ruch';
  const ctx=date===today?{label:'Dziś',cls:'today'}:date<today?{label:'Historia',cls:'past'}:{label:'Plan',cls:'future'};
  return <div className="today-dashboard">
    <HomeCalendar date={date} setDate={setDate}/>
    <div className="day-block rise d2">
      <div className="day-context"><span className={`context-pill ${ctx.cls}`}><CalendarBlank size={14}/>{ctx.label}</span><span>{dateLabel(date,{weekday:'long',day:'numeric',month:'long'})}</span></div>
      {date!==today&&<p className="day-context-hint">Nowe wpisy trafią do tego dnia. Serie dni niżej zawsze pokazują stan na dziś.</p>}
      <Segments value={view} onChange={setView} options={[{value:'training',label:'Trening dnia'},{value:'food',label:'Posiłki dnia'}]}/>
      <div className="home-day-content" key={`${view}-${date}`}>
      {view==='training'?<section className="card home-workout" aria-label="Trening wybranego dnia">
        <div className="home-workout-photo"><SportPhoto index={inspiration.photoIndex} alt="Codzienna inspiracja sportowa"/><span className="photo-kicker">{kicker}</span></div>
        <div className="home-workout-body">
          <div className="home-workout-title"><h2>{title}</h2><span className="meta-line"><Timer size={15}/>{description.replace(' Czas ruszy po rozpoczęciu.','')}</span></div>
          {active?<button className="pill-btn primary wide" onClick={()=>navigate('training')}><span>Wróć do treningu · {active.status==='paused'?'pauza':'trwa'}</span><Play size={18}/></button>
          :canFree?<div className="two-buttons"><button className="pill-btn primary" onClick={()=>navigate('training')}>Wybierz plan</button><button className="pill-btn soft" onClick={freeSession}>Bez planu</button></div>
          :canStart&&plan?<><button className="pill-btn primary wide start" onClick={()=>start(plan)}><span>Rozpocznij trening</span><span className="pill-btn-icon"><Play size={18}/></span></button><small className="home-start-hint"><Info size={14}/>Czas ruszy dopiero po rozpoczęciu treningu.</small></>
          :<button className="pill-btn soft wide" onClick={()=>navigate('training')}><span>{action}</span><ArrowRight size={18}/></button>}
          <button className="spotify-row" aria-label="Otwórz playlistę w Spotify" onClick={()=>void run(()=>openSpotify(profile.spotify))}><span className="spotify-badge"><SpotifyLogo size={26} weight="fill" aria-hidden="true"/></span><span className="row-text"><strong>Playlista na trening</strong><small>{inspiration.text}</small></span><ArrowUpRight size={18}/></button>
        </div>
      </section>:<HomeMeals date={date} openDiary={()=>navigate('food')}/>}
      </div>
    </div>
    <NutritionCard totals={dayTotals(data.food,date)} goal={goalForDate(data.goals,date)} plannedKcal={dayTotals(data.food,date,'planned').kcal} onGoal={()=>show(<GoalForm date={date}/>)} onAdd={()=>show(<AddFood date={date}/>)} onDiary={()=>navigate('food')}/>
    <section className="rise d4" aria-label="Szybki zapis"><h2 className="block-title">Szybki zapis</h2>
      <div className="card list-card">
        <button className="list-row" aria-label={latest?`${fmt(latest.value,1)} kg · Dodaj pomiar masy`:'Dodaj pomiar masy'} onClick={()=>show(<WeightForm date={date}/>)}><span className="icon-bubble fat"><Scale size={22}/></span><span className="row-text"><strong>Pomiar masy</strong><small>{latest?`Ostatnio ${dateLabel(latest.date,{day:'numeric',month:'short'})}`:'Zapisz pierwszy pomiar'}</small></span>{latest&&<span className="row-value">{fmt(latest.value,1)}<small> kg</small></span>}<span className="row-plus"><Plus size={16}/></span></button>
        <div className="row-divider"/>
        <button className="list-row" aria-label="Dodaj aktywność" onClick={()=>show(<ActivityForm date={date}/>)}><span className="icon-bubble pro"><Walk size={22}/></span><span className="row-text"><strong>Inna aktywność</strong><small>Spacer, rower, basen</small></span><span className="row-plus"><Plus size={16}/></span></button>
      </div>
    </section>
    <Streaks/>
    <div className="card split-card rise d6">
      <button className="split-cell" onClick={()=>show(<Calculators/>)}><span className="icon-bubble sunk"><Calculator size={20}/></span><span className="row-text"><strong>Kalkulatory</strong><small>kcal, makro, talerze</small></span></button>
      <span className="split-line"/>
      <button className={`split-cell daily-completion-card ${daily?.complete?'is-complete':''}`} role="switch" aria-label="Wszystkie posiłki zapisane" aria-checked={Boolean(daily?.complete)} disabled={!eaten.length&&!daily?.complete} onClick={()=>void run(async()=>{await updateDaily(date,{complete:!daily?.complete});await reload();})}>{daily?.complete&&<span className="burst" aria-hidden="true"/>}<span className="row-text"><strong>Dziennik pełny</strong><small>{daily?.complete?'Oznaczony · możesz cofnąć':!eaten.length?'Dodaj posiłki':'Wszystkie posiłki zapisane?'}</small></span><span className={`toggle ${daily?.complete?"on":""}`} aria-hidden="true"><span/></span></button>
    </div>
  </div>;
}
export function NutritionCard({totals,goal,plannedKcal=0,onGoal,onAdd,onDiary}:{totals:Nutrients;goal?:Goal;plannedKcal?:number;onGoal?:()=>void;onAdd?:()=>void;onDiary?:()=>void}) {
 const progress=goal?Math.min(100,totals.kcal/goal.kcal*100):0,over=Boolean(goal&&totals.kcal>goal.kcal);
 const macros=[{key:'protein',label:'Białko',icon:Fish},{key:'fat',label:'Tłuszcz',icon:Droplet},{key:'carbs',label:'Węgle',icon:Grains}] as const;
 return <section className="card nutrition-card rise d3" aria-label="Bilans kalorii">
   <div className="card-head"><h2>Bilans kalorii</h2>
     {onDiary&&<button className="round-btn" aria-label="Otwórz dziennik jedzenia" onClick={onDiary}><Notebook size={18}/></button>}
     {onAdd&&<button className="pill-btn primary small" aria-label="Dodaj jedzenie" onClick={onAdd}><Plus size={16}/>Dodaj</button>}
   </div>
   <div className="kcal-row"><div className="kcal-main"><Ring value={goal?totals.kcal/goal.kcal:0} color={over?'var(--err)':'var(--hot)'}><Fire size={22} className="flicker"/></Ring><div><strong className="kcal-number">{fmt(totals.kcal)}</strong><span className="kcal-goal">{goal?`/ ${fmt(goal.kcal)} `:''}kcal zjedzone</span></div></div>
     {goal&&<div className={`kcal-side ${over?'over':''}`}><strong>{over?'+':''}{fmt(Math.abs(goal.kcal-totals.kcal))}</strong><span>{over?'kcal ponad cel':'kcal do celu'}</span></div>}</div>
   <div className="calorie-track" role="progressbar" aria-label="Realizacja celu kalorii" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress)}><i className={over?'over':''} style={{width:`${goal?progress:0}%`}}><span className="shimmer"/></i>{plannedKcal>0&&goal&&<b style={{width:`${Math.min(100-progress,plannedKcal/goal.kcal*100)}%`}}/>}</div>
   {plannedKcal>0&&<small className="nutrition-planned"><Clock size={14}/>Zaplanowane: {fmt(plannedKcal)} kcal - nie wliczone do bilansu</small>}
   <div className="macro-grid">{macros.map(({key,label,icon:Icon})=><div className={`macro macro-${key}`} key={key}><span className="macro-label"><Icon size={14}/>{label}</span><span className="macro-value"><strong>{totals[key]===null?'-':fmt(totals[key]!,0)}</strong><small>{goal?.[key]!=null?` / ${fmt(goal[key]!,0)} g`:' g'}</small></span>{totals[key]===null&&<small className="macro-missing"><Warning size={11}/>niepełne dane</small>}</div>)}</div>
   {!goal&&onGoal&&<button className="dashed-btn" onClick={onGoal}>Brak celu kalorii - oblicz w kalkulatorze lub ustaw w profilu</button>}
 </section>;
}
