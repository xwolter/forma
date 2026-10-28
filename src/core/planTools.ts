import type { Plan, PlanExercise } from './types';
import { stamp, exerciseById } from './catalog';
import {resultMetric,resultUnit,type ResultMetric} from './exerciseMetrics';
import type {Exercise} from './types';
import type { Session, WorkoutSet } from './types';

export const slotTarget = (s:PlanExercise) => s.target || `${s.min}-${s.max} ${resultUnit(resultMetric(s))}`;
export function defaultPlanExercise(e:Exercise):PlanExercise {
 const metric=e.metric??'reps';return {id:crypto.randomUUID(),exerciseId:e.id,sets:3,min:metric==='seconds'?30:metric==='distance'?20:8,max:metric==='seconds'?45:metric==='distance'?40:12,rest:90,rir:metric==='reps'?2:null,notes:'',metric,...e.defaultTarget};
}
export function changePlanMetric(slot:PlanExercise,metric:ResultMetric):Partial<PlanExercise>{
 if(resultMetric(slot)===metric)return{metric};
 const e=exerciseById(slot.exerciseId),base=defaultPlanExercise({...e,defaultTarget:metric===(e.metric??'reps')?e.defaultTarget:undefined,metric:metric==='reps'?undefined:metric});return{metric,min:base.min,max:base.max,rir:base.rir,target:''};
}
export function planForWeek(plan:Plan, week:number):Plan {
 if(!Number.isInteger(week)||week<1||week>5)throw new Error('Wybierz tydzień od 1 do 5.');
 return {...plan,programWeek:week,exercises:plan.exercises.map(s=>({...s,sets:s.weeklySets?.[week-1]??s.sets}))};
}
export function copyPlan(plan:Plan):Plan {
 return {...plan,...stamp(),name:`${plan.name} - kopia`.slice(0,60),version:1,weekdays:[],exercises:plan.exercises.map(s=>({...s,id:crypto.randomUUID()}))};
}

export function circuitStep(session:Session, completed:WorkoutSet, sets:WorkoutSet[], defaultRest:number) {
 const slots=session.planSnapshot.exercises;
 const slot=slots.find(s=>s.id===completed.slotId);
 if(!slot?.group||completed.type==='warmup')return {rest:defaultRest,currentExercise:session.currentExercise};
 const group=slots.filter(s=>s.group===slot.group);
 if(group.length<2)return {rest:defaultRest,currentExercise:session.currentExercise};
 const candidates=sets.filter(s=>group.some(g=>g.id===s.slotId)&&s.type!=='warmup'&&!s.done&&!s.skipped&&s.id!==completed.id).sort((a,b)=>a.index-b.index||slots.findIndex(x=>x.id===a.slotId)-slots.findIndex(x=>x.id===b.slotId));
 const next=candidates[0];
 if(next)return {rest:next.index===completed.index?(slot.restBetween??defaultRest):slot.rest,currentExercise:slots.findIndex(s=>s.id===next.slotId)};
 const after=sets.filter(s=>slots.findIndex(x=>x.id===s.slotId)>slots.findIndex(x=>x.id===group.at(-1)!.id)&&!s.done&&!s.skipped).sort((a,b)=>slots.findIndex(x=>x.id===a.slotId)-slots.findIndex(x=>x.id===b.slotId)||a.index-b.index)[0];
 return {rest:slot.rest,currentExercise:after?slots.findIndex(s=>s.id===after.slotId):session.currentExercise};
}
