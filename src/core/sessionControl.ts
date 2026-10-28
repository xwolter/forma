import type { Session } from './types';
import { dbPromise } from './db';

export type SessionControl='pause'|'resume'|'start-rest'|'skip-rest'|'extend-rest';
export type SessionAction={id:string;sessionId:string;action:SessionControl;at:number};
export function controlledSession(s:Session,action:SessionControl,at:number):Session {
 if(!['active','paused'].includes(s.status))return s;
 const time=Math.max(s.startedAt,at);
 if(action==='pause'&&s.status==='active')return {...s,status:'paused',pausedAt:time,restRemaining:Math.max(0,(s.restEndsAt??0)-time),restEndsAt:null,updatedAt:new Date(time).toISOString()};
 if(action==='resume'&&s.status==='paused')return {...s,status:'active',pausedMs:s.pausedMs+Math.max(0,time-(s.pausedAt??time)),pausedAt:null,lastActiveAt:time,restEndsAt:(s.restRemaining??0)>0?time+s.restRemaining!:null,restRemaining:0,updatedAt:new Date(time).toISOString()};
 if(s.status!=='active')return s;
 if(action==='skip-rest')return {...s,restEndsAt:null,restRemaining:0};
 if(action==='extend-rest')return {...s,restEndsAt:Math.max(time,s.restEndsAt??0)+30000};
 if(action==='start-rest'){const seconds=s.planSnapshot.exercises[s.currentExercise]?.rest??90;return {...s,restEndsAt:seconds>0?time+seconds*1000:null};}
 return s;
}
export async function changeSessionControl(sessionId:string,action:SessionControl,at=Date.now()) {
 const db=await dbPromise;const tx=db.transaction('sessions','readwrite');const s=await tx.store.get(sessionId) as Session|undefined;
 if(s)await tx.store.put(controlledSession(s,action,at));await tx.done;
}
export async function applySessionActions(actions:SessionAction[]) {
 if(actions.length>500||actions.some(a=>!a||!/^[-a-z0-9]{1,80}$/i.test(a.id)||typeof a.sessionId!=='string'||a.sessionId.length>150||!['pause','resume','start-rest','skip-rest','extend-rest'].includes(a.action)||!Number.isSafeInteger(a.at)||a.at<0||a.at>Date.now()+300000))throw new Error('Nieprawidłowe sterowanie treningiem.');
 if(!actions.length)return false;
 const db=await dbPromise;const tx=db.transaction(['sessions','meta'],'readwrite');let changed=false;
 for(const a of actions){const key=`session-action:${a.id}`;if(await tx.objectStore('meta').get(key))continue;const s=await tx.objectStore('sessions').get(a.sessionId) as Session|undefined;if(s&&['active','paused'].includes(s.status)){await tx.objectStore('sessions').put(controlledSession(s,a.action,a.at));changed=true;}await tx.objectStore('meta').put(true,key);}
 await tx.done;return changed;
}
