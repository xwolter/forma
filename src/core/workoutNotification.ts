import {registerPlugin} from '@capacitor/core';
import {dbPromise,loadData} from './db';
import {isNative} from './native';
import {exerciseById} from './catalog';
import {applySessionActions,type SessionAction} from './sessionControl';
import type {AppData} from './types';
export const workoutNotification=registerPlugin<{
 pending():Promise<{actions:SessionAction[];snapshot:{id?:string;enabled?:boolean;status?:string}}>;
 publish(options:{snapshot:Record<string,unknown>;applied:string[]}):Promise<void>;
 clear():Promise<void>;
 status():Promise<{allowed:boolean;liveUpdatesSupported:boolean;promotedAllowed:boolean}>;
}>('WorkoutNotification');
let work=Promise.resolve();
function snapshot(data:AppData):Record<string,unknown>{
 const s=data.sessions.find(s=>s.status==='active'||s.status==='paused');if(!s||!data.profiles[0])return {};
 const slot=s.planSnapshot.exercises[s.currentExercise];
 return {id:s.id,enabled:data.profiles[0].notifications,title:s.planSnapshot.name.slice(0,100),exercise:slot?exerciseById(slot.exerciseId)?.name.slice(0,120):'Własny trening',status:s.status,startedAt:s.startedAt,pausedAt:s.pausedAt??0,pausedMs:s.pausedMs,restEndsAt:s.restEndsAt??0,restRemaining:s.restRemaining??0,restSeconds:slot?.rest??90,done:data.sets.filter(v=>v.sessionId===s.id&&v.done).length,total:data.sets.filter(v=>v.sessionId===s.id).length};
}
export function synchronizeWorkoutNotification(data?:AppData):Promise<boolean>{
 if(!isNative)return Promise.resolve(false);
 const next=work.catch(()=>{}).then(async()=>{
  const {actions}=await workoutNotification.pending();
  const changed=await applySessionActions(actions);
  if(!data&&!changed)return false;
  const latest=changed?await loadData():data!;
  if(!latest.profiles.length){await workoutNotification.clear();return changed;}
  await workoutNotification.publish({snapshot:snapshot(latest),applied:actions.map(a=>a.id)});return changed;
 });work=next.then(()=>{},()=>{});return next;
}
/** A session explicitly running in Android's notification stays active after WebView recreation. */
export async function recoverNotificationSession(){
 if(!isNative)return false;
 try{const {actions,snapshot:s}=await workoutNotification.pending();await applySessionActions(actions);if(!s.id||!s.enabled)return false;const local=await (await dbPromise).get('sessions',s.id);return local&&['active','paused'].includes(local.status);}catch{return false;}
}
