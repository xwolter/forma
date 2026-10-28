import type { CSSProperties } from 'react';
import { ChartLineUp, Check, Droplet, Dumbbell, Fire, Pause, Play, Plus } from '../ui/icons';
import { Button, LiveFlame, Ring, Sheet, useUI } from '../ui/UI';
import { nativeWidgets } from '../core/widgets';
import { isNative } from '../core/native';
import {useStore} from '../core/store';
import {dayTotals,goalForDate,localDate,fmt} from '../core/math';
import {habitDates,streakStats} from '../core/streaks';
export function Widgets() {
 const {run,toast}=useUI(),{data}=useStore(),date=localDate();
 const totals=dayTotals(data.food,date),kcal=Math.round(totals.kcal),goals=goalForDate(data.goals,date),goal=goals?.kcal??0;
 const water=data.daily.find(d=>d.date===date)?.water??0,waterGoal=data.profiles[0].waterGoal??0;
 const live=data.sessions.find(s=>['active','paused'].includes(s.status));
 const training=live?.planSnapshot.name??data.plans.find(p=>p.weekdays.includes(new Date(date+'T12:00:00').getDay()))?.name??'Dzień regeneracji';
 const streak=streakStats(habitDates(data).open,date);
 const percent=(value:number,target:number)=>target>0?Math.min(100,Math.round(value/target*100)):0;
 const fill=waterGoal?Math.min(1,water/waterGoal):Math.min(1,water/2500);
 const pin=(kind:'day'|'water'|'streak')=>void run(async()=>{if(!isNative)throw new Error('Widżety są dostępne w APK Androida.');await nativeWidgets.pin({kind});toast('Potwierdź dodanie widżetu na ekranie telefonu.');});
 const macros=[['Białko',totals.protein,goals?.protein,'var(--pro)'],['Tłuszcz',totals.fat,goals?.fat,'var(--fat)'],['Węgle',totals.carbs,goals?.carbs,'var(--carb)']] as const;
 return <Sheet title="Widżety ekranu głównego"><p className="muted small">Podgląd używa Twoich dzisiejszych danych. Ekran główny telefonu ustala ostateczny rozmiar i odstępy.</p>
 <section className="widget-preview" aria-label="Podgląd widżetu dnia"><header><span className="badge"><Dumbbell size={11}/></span>FORMA · Dziś</header>
  <div className="widget-prototype-main"><Ring value={goal?kcal/goal:0} size={78} stroke={9}><Fire size={18} className="flicker"/><span>{goal?`${percent(kcal,goal)}%`:'-'}</span></Ring><div className="row-text"><div className="widget-preview-number"><b>{fmt(kcal)}</b></div><p>{goal?`/ ${fmt(goal)} kcal · ${fmt(Math.max(0,goal-kcal))} do celu`:'Ustaw cel w aplikacji'}</p>
   <div className="widget-prototype-macros">{macros.map(([label,value,target,color])=><span key={label}>{label}<b><i style={{width:`${percent(value??0,target??0)}%`,background:color}}/></b></span>)}</div></div></div>
  <div className="widget-prototype-training"><span className="row-text"><strong>{training}</strong><small>{live?(live.status==='paused'?'Wstrzymano':'Trening trwa'):'Plan na dziś'}</small></span><span className="round-btn">{live&&live.status==='active'?<Pause size={20}/>:<Play size={20}/>}</span></div>
  <div className="widget-preview-actions"><span><Plus size={16}/>Jedzenie</span><span><ChartLineUp size={16}/>Postępy</span></div>
 </section>
 <Button className="full" onClick={()=>pin('day')}>Dodaj widżet dnia</Button>
 <div className="widget-pair">
  <section className="widget-preview widget-preview-hydration" aria-label="Podgląd widżetu wody" style={{'--wave-top':`${100-fill*78-6}%`} as CSSProperties}><i className="wave"/><i className="wave w2"/><header><Droplet size={14}/>Woda</header><div className="widget-preview-number"><b>{fmt(water)}</b></div><p>{waterGoal?`/ ${fmt(waterGoal)} ml`:'ml · bez celu'}</p><div className="widget-preview-actions" style={{marginTop:'auto'}}><span>−250</span><span>+250</span></div></section>
  <section className="widget-preview" aria-label="Podgląd widżetu serii"><header>Seria<span>rekord {streak.longest}</span></header><div className="widget-streak-value"><LiveFlame lit={streak.current>0} size={38}/><span className="row-text"><b>{streak.current}</b><small>dni z rzędu</small></span></div><div className="widget-streak-days">{streak.calendar.slice(-7).map((d,i)=><span key={d.date} className={d.done?(i===6?'today':'done'):''} style={{animationDelay:`${.3+i*.07}s`}}>{d.done?<Check size={10}/>:'-'}</span>)}</div></section>
 </div>
 <div className="button-row"><Button variant="secondary" onClick={()=>pin('water')}>Widżet wody</Button><Button variant="secondary" onClick={()=>pin('streak')}>Widżet serii</Button></div>
 <p className="muted small">Przyciski wody działają także przy zamkniętej aplikacji. Aby dodać widżet ręcznie: przytrzymaj pusty obszar pulpitu → Widżety → FORMA. Bilans i serie odświeżają się po zapisach w aplikacji.</p></Sheet>;
}
