import { EXERCISES } from './catalog';
import type { Exercise } from './types';
const aliases:Record<string,string>={bench:'bench press',squat:'back squat',rdl:'romanian deadlift',pulldown:'lat pulldown',row:'seated cable row',lateral:'lateral raise',curl:'biceps curl',shoulder:'shoulder press',legpress:'leg press',legcurl:'leg curl',calf:'calf raise','db-bench':'dumbbell bench press','db-row':'dumbbell row','barbell-row':'barbell row',goblet:'goblet squat',pullup:'pull up podciaganie','step-back-burpee':'burpee padnij powstan'};
export const exerciseSearchText=(s:string)=>s.toLocaleLowerCase('pl').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replaceAll('ł','l').replace(/[-_20132014]/g,' ').replace(/\s+/g,' ').trim();
const searchable=new Map(EXERCISES.map(e=>[e.id,exerciseSearchText(`${e.name} ${e.muscle} ${e.equipment} ${e.pattern} ${e.searchTerms??''} ${aliases[e.id]??''}`)]));
export type ExerciseFocus=''|'recommended'|'cardio'|'lowImpact'|'strength';
export const exerciseKind=(e:Exercise)=>e.trainingType??(e.id==='rowing-ergometer'?'cardio':'strength');
export function discoverExercises(search:string,equipment='',muscle='',focus:ExerciseFocus=''):Exercise[]{
 const terms=exerciseSearchText(search).split(' ').filter(Boolean);
 return EXERCISES.filter(e=>(!equipment||e.equipment===equipment)&&(!muscle||e.muscle===muscle)&&(!focus||(focus==='recommended'?e.recommended:focus==='lowImpact'?e.lowImpact:exerciseKind(e)===focus))&&terms.every(t=>searchable.get(e.id)!.includes(t))).sort((a,b)=>a.name.localeCompare(b.name,'pl'));
}
