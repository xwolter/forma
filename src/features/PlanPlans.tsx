import { useRef, useState } from 'react';
import { Check, ChevronRight, Copy, Edit3, FileUp, Play } from '../ui/icons';
import type { Plan } from '../core/types';
import { useStore } from '../core/store';
import { readPlanBundle } from '../core/planImport';
import { copyPlan, planForWeek, slotTarget } from '../core/planTools';
import { exerciseById } from '../core/catalog';
import { Button, Sheet, useUI } from '../ui/UI';
import { ExerciseDetails, PlanEditor } from './Training';
import { SportPhoto } from './SportPhoto';

export function PlanPreview({plan,start,photoIndex=1}:{plan:Plan;start:(p:Plan)=>void;photoIndex?:number}) {
 const {data,put,mutate}=useStore();const {show,run,close,toast}=useUI();
 const [week,setWeek]=useState(plan.programWeek??1);
 const [notesOpen,setNotesOpen]=useState(false);
 const effective=planForWeek(plan,week);
 const active=data.sessions.some(s=>s.status==='active'||s.status==='paused');
 return <Sheet title="Podgląd planu" wide className="plan-preview-sheet">
  <SportPhoto index={photoIndex} alt="Zdjęcie planu treningowego" className="plan-preview-photo"/>
  <div className="plan-preview-intro">
    {plan.program&&<span className="plan-preview-program">{plan.program}</span>}
    <h1>{plan.name}</h1>
    <p className="muted plan-meta">{plan.exercises.length} ćwiczeń{plan.minutes?` · około ${plan.minutes} min`:''}{plan.weekdays.length?` · ${plan.weekdays.map(d=>['Nd','Pn','Wt','Śr','Cz','Pt','So'][d]).join(' · ')}`:''}</p>
  </div>
  {plan.exercises.some(s=>s.weeklySets)&&<div className="plan-preview-weeks"><span>Tydzień programu</span><div>{[1,2,3,4,5].map(w=><button key={w} className={week===w?'active':''} aria-pressed={week===w} onClick={()=>setWeek(w)}>T{w}</button>)}</div></div>}
  {plan.program&&plan.exercises.some(s=>s.weeklySets)&&<button className="plan-week-apply" onClick={()=>void run(()=>mutate(data.plans.filter(p=>p.program===plan.program).map(p=>({table:'plans' as const,value:{...planForWeek(p,week),updatedAt:new Date().toISOString()}}))),`Ustawiono tydzień ${week} w programie`)}>Ustaw tydzień {week} dla całego programu</button>}
  {plan.notes&&<div className="plan-instructions"><strong>Uwagi programu</strong><p className={notesOpen?'expanded':''}>{plan.notes}</p>{plan.notes.length>240&&<button className="plan-notes-expand" aria-expanded={notesOpen} onClick={()=>setNotesOpen(v=>!v)}>{notesOpen?'Zwiń uwagi':'Pokaż wszystkie uwagi'}</button>}</div>}
  {plan.cardio&&<details className="plan-cardio"><summary>Cardio po treningu</summary><p>{plan.cardio}</p></details>}
  <h2 className="subheading">Ćwiczenia ({effective.exercises.length})</h2>
  <div className="plan-exercise-preview">{effective.exercises.map((s,i)=>{const e=exerciseById(s.exerciseId);return <button key={s.id} className="list-row" onClick={()=>show(<ExerciseDetails exercise={e} slot={s}/>)}><span className="exercise-order">{s.group?`${s.group}${effective.exercises.filter(x=>x.group===s.group).length>1?effective.exercises.slice(0,i+1).filter(x=>x.group===s.group).length:''}`:i+1}</span><img className="exercise-thumb" src={`/exercises/${e.demoId??e.id}/0.jpg`} alt="" loading="lazy"/><span className="row-text"><strong>{e.name}</strong><b className="sets-line">{s.sets} × {slotTarget(s)}</b><small>Przerwa {s.restBetween?`${s.restBetween}s / `:''}{s.rest}s{s.rir!=null?` · RIR ${s.rir}`:''}{s.tempo?` · tempo ${s.tempo}`:''}</small></span></button>;})}</div>
  <div className="button-row"><Button variant="secondary" onClick={()=>show(<PlanEditor plan={effective}/>)}><Edit3 size={17}/>Edytuj plan</Button><Button variant="secondary" onClick={()=>void run(async()=>{const copy=copyPlan(effective);await put('plans',copy);show(<PlanEditor plan={copy}/>);toast('Utworzono kopię planu');})}><Copy size={17}/>Kopiuj plan</Button></div>
  <p className="muted small">RIR - ile powtórzeń zostaje „w zapasie”. Tempo 3-1-1-0 - sekundy opuszczania, pauzy, podnoszenia, pauzy.</p>
  <div className="sheet-footer plan-preview-actions">{active?<p className="warn-text small">Trwa już sesja - możesz mieć tylko jedną naraz.</p>:null}<button className="pill-btn primary wide" disabled={active} onClick={()=>void run(async()=>{await put('plans',effective);close();start(effective);})}><span>Rozpocznij trening</span><Play size={22}/></button></div>
 </Sheet>;
}
export function ImportPlansButton() {
 const input=useRef<HTMLInputElement>(null);const {show,run}=useUI();
 return <><button className="list-row import-plans" onClick={()=>input.current?.click()}><span className="icon-bubble info"><FileUp size={20}/></span><span className="row-text"><strong>Wczytaj plany z pliku FORMA</strong><small>Plik .json przygotowany z arkusza</small></span><ChevronRight size={18}/></button><input ref={input} type="file" hidden accept=".json,application/json" onChange={e=>{const f=e.target.files?.[0];e.target.value='';if(f)void run(async()=>{if(f.size>1024*1024)throw new Error('Plik planów może mieć najwyżej 1 MB.');show(<PlanImportPreview plans={readPlanBundle(JSON.parse(await f.text()))}/>);});}}/></>;
}
function PlanImportPreview({plans}:{plans:Plan[]}) {
 const {data,mutate}=useStore();const {run,close}=useUI();
 const existing=new Set(data.plans.map(p=>p.id));const additions=plans.filter(p=>!existing.has(p.id));
 return <Sheet title="Twoje plany z arkuszy" wide><p>Dodamy {additions.length} treningów do Twojej listy. Obecne plany i wyniki zostaną zachowane.</p><div className="import-plan-list">{plans.map(p=><div key={p.id}><strong>{p.name}</strong><p>{p.exercises.length} ćwiczeń · {p.program}{existing.has(p.id)?' · już zapisany':''}</p></div>)}</div><Button className="full" disabled={!additions.length} onClick={()=>void run(async()=>{await mutate(additions.map(value=>({table:'plans' as const,value})));close();},'Twoje plany są już zapisane')}><Check size={18}/>Dodaj plany ({additions.length})</Button><p className="muted small">Plany zapisują się na tym urządzeniu. Własne dane trafiają do chmury wyłącznie po ręcznym utworzeniu kopii.</p></Sheet>;
}
