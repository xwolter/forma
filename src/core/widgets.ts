import { registerPlugin } from '@capacitor/core';
import { dbPromise, loadData } from './db';
import { stamp } from './catalog';
import { dayTotals, goalForDate, localDate } from './math';
import { dayNumber } from './streaks';
import { habitDates, streakStats } from './streaks';
import { isNative } from './native';

export type WidgetAction={id:string;date:string;delta:number};
export const nativeWidgets=registerPlugin<{
  pending():Promise<{actions:WidgetAction[]}>;
  publish(options:{snapshot:Record<string,unknown>;applied:string[]}):Promise<void>;
  clear():Promise<void>;
  pin(options:{kind:'day'|'water'|'streak'}):Promise<void>;
  route():Promise<{route:string}>;
  addListener(event:'launch',fn:()=>void):Promise<{remove:()=>Promise<void>}>;
}>('FormaWidgets');

export async function applyWidgetActions(actions:WidgetAction[]) {
  if(actions.length>500||actions.some(a=>!a||!/^[-a-z0-9]{1,80}$/i.test(a.id)||dayNumber(a.date)===null||!Number.isInteger(a.delta)||!a.delta||Math.abs(a.delta)>250))throw new Error('Nieprawidłowy zapis widżetu.');
  if(!actions.length)return false;
  const db=await dbPromise, tx=db.transaction(['daily','meta'],'readwrite');let changed=false;
  for(const action of actions){
    const key=`widget-action:${action.id}`;
    if(await tx.objectStore('meta').get(key))continue;
    const previous=await tx.objectStore('daily').get(action.date);
    await tx.objectStore('daily').put({...stamp(action.date),date:action.date,complete:false,energy:null,sleep:null,...previous,water:Math.max(0,Math.min(100000,(previous?.water??0)+action.delta)),updatedAt:new Date().toISOString()});
    await tx.objectStore('meta').put(true,key);changed=true;
  }
  await tx.done;return changed;
}
let work=Promise.resolve();
export function synchronizeWidgets():Promise<boolean> {
  if(!isNative)return Promise.resolve(false);
  const next=work.catch(()=>{}).then(async()=>{
    let data=await loadData();
    if(!data.profiles.length){await nativeWidgets.clear();return false;}
    const {actions}=await nativeWidgets.pending();
    const changed=await applyWidgetActions(actions);data=await loadData();
    const profile=data.profiles[0], date=localDate();
    const active=data.sessions.find(s=>s.status==='active'||s.status==='paused');
    const plan=data.plans.find(p=>p.weekdays.includes(new Date(`${date}T12:00:00`).getDay()));
    const food=dayTotals(data.food,date),goal=goalForDate(data.goals,date);
    const openStreak=streakStats(habitDates(data).open,date);
    await nativeWidgets.publish({snapshot:{configured:true,date,water:data.daily.find(d=>d.date===date)?.water??0,waterGoal:profile.waterGoal??0,
      kcal:Math.round(food.kcal),goal:goal?.kcal??0,
      protein:food.protein,fat:food.fat,carbs:food.carbs,
      proteinGoal:goal?.protein??null,fatGoal:goal?.fat??null,carbsGoal:goal?.carbs??null,
      trainingName:active?.planSnapshot.name??plan?.name??'Dzień regeneracji',
      sessionStatus:active?.status??'',sessionDone:active?data.sets.filter(s=>s.sessionId===active.id&&s.done).length:0,
      sessionTotal:active?data.sets.filter(s=>s.sessionId===active.id).length:0,
      streakOpen:openStreak.current,streakBest:openStreak.longest,streakDays:openStreak.calendar.slice(-7).map(d=>d.done)},applied:actions.map(a=>a.id)});
    return changed;
  });
  work=next.then(()=>{},()=>{});return next;
}
