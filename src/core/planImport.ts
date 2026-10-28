import {resultMetric,resultLimit} from './exerciseMetrics';
import { EXERCISES } from './catalog';
import type { Plan, PlanExercise } from './types';

const text=(v:unknown,max:number,required=false):string|undefined=>{
 if(v===undefined&&!required)return undefined;
 if(typeof v!=='string'||v.length>max||(required&&!v.trim()))throw new Error('Nieprawidłowy tekst planu.');
 return v;
};
const integer=(v:unknown,min:number,max:number):number=>{
 if(typeof v!=='number'||!Number.isInteger(v)||v<min||v>max)throw new Error('Nieprawidłowa liczba w planie.');
 return v;
};
const finite=(v:unknown,min:number,max:number):number=>{if(typeof v!=='number'||!Number.isFinite(v)||v<min||v>max)throw new Error('Nieprawidłowa liczba w planie.');return v;};
/** Import data only. Never evaluate workbook formulas, URLs or embedded code. */
export function readPlanBundle(input:unknown):Plan[] {
 const b=input as {format?:unknown;version?:unknown;plans?:unknown};
 if(!b||b.format!=='forma-plans'||b.version!==1||!Array.isArray(b.plans)||!b.plans.length||b.plans.length>100)throw new Error('Wybierz plik planów FORMA (.json).');
 const ids=new Set<string>();
 return b.plans.map(raw=>{
  if(!raw||typeof raw!=='object')throw new Error('Nieprawidłowy plan.');
  const p=raw as Record<string,unknown>;
  const id=text(p.id,150,true)!;if(ids.has(id))throw new Error('Powtórzony plan.');ids.add(id);
  if(!Array.isArray(p.exercises)||!p.exercises.length||p.exercises.length>80)throw new Error('Plan musi mieć od 1 do 80 ćwiczeń.');
  const slotIds=new Set<string>();
  const exercises:PlanExercise[]=p.exercises.map(rawSlot=>{
   const s=rawSlot as Record<string,unknown>;if(!s||typeof s!=='object')throw new Error('Nieprawidłowe ćwiczenie.');
   const sid=text(s.id,150,true)!;if(slotIds.has(sid))throw new Error('Powtórzone ćwiczenie w planie.');slotIds.add(sid);
   const exerciseId=text(s.exerciseId,100,true)!;if(!EXERCISES.some(e=>e.id===exerciseId))throw new Error(`Brak ćwiczenia w tej wersji aplikacji: ${exerciseId}`);
   const limit=resultLimit(resultMetric(s as unknown as PlanExercise));
   const min=integer(s.min,1,limit),max=integer(s.max,min,limit);
   if(s.weeklySets!==undefined&&(!Array.isArray(s.weeklySets)||s.weeklySets.length!==5))throw new Error('Nieprawidłowa progresja tygodni.');
   if(s.metric!==undefined&&!['reps','seconds','distance'].includes(String(s.metric)))throw new Error('Nieprawidłowa jednostka ćwiczenia.');
   return {id:sid,exerciseId,sets:integer(s.sets,1,20),min,max,rest:integer(s.rest,0,1800),rir:s.rir===null?null:finite(s.rir,0,10),notes:text(s.notes,8000)??'',...(s.group!==undefined?{group:text(s.group,8)}:{}),...(s.tempo!==undefined?{tempo:text(s.tempo,12)}:{}),...(s.target!==undefined?{target:text(s.target,80)}:{}),...(s.metric!==undefined?{metric:s.metric as PlanExercise['metric']}:{}),...(s.restBetween!==undefined?{restBetween:integer(s.restBetween,0,1800)}:{}),...(s.warmupRest!==undefined?{warmupRest:integer(s.warmupRest,0,1800)}:{}),...(Array.isArray(s.weeklySets)?{weeklySets:s.weeklySets.map(n=>integer(n,1,20))}:{})};
  });
  if(!Array.isArray(p.weekdays)||p.weekdays.length>7)throw new Error('Nieprawidłowe dni planu.');
  return {id,schemaVersion:1,updatedAt:new Date().toISOString(),name:text(p.name,100,true)!,subtitle:text(p.subtitle,500)??'',minutes:finite(p.minutes,0,600),version:integer(p.version,1,100000),weekdays:[...new Set(p.weekdays.map(d=>integer(d,0,6)))],exercises,...(p.program!==undefined?{program:text(p.program,100)}:{}),...(p.programWeek!==undefined?{programWeek:integer(p.programWeek,1,5)}:{}),...(p.notes!==undefined?{notes:text(p.notes,10000)}:{}),...(p.cardio!==undefined?{cardio:text(p.cardio,2000)}:{}),...(p.source!==undefined?{source:text(p.source,200)}:{})};
 });
}
