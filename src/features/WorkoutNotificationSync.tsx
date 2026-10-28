import {useEffect} from 'react';
import {App as CapacitorApp} from '@capacitor/app';
import {useStore} from '../core/store';
import {isNative,scheduleRest} from '../core/native';
import {synchronizeWorkoutNotification} from '../core/workoutNotification';
export function WorkoutNotificationSync(){
 const {data,loading,reload}=useStore();const s=data.sessions.find(s=>s.status==='active'||s.status==='paused');
 useEffect(()=>{if(!isNative||loading)return;void synchronizeWorkoutNotification(data).then(changed=>changed?reload():undefined).catch(()=>{});},[data,loading,reload]);
 useEffect(()=>{void scheduleRest(s?.status==='active'?(s.restEndsAt??0):0,data.profiles[0]?.notifications??false).catch(()=>{});},[s?.status,s?.restEndsAt,data.profiles[0]?.notifications]);
 useEffect(()=>{if(!isNative||loading)return;const sync=()=>{void synchronizeWorkoutNotification().then(changed=>changed?reload():undefined).catch(()=>{});};const timer=setInterval(()=>{if(document.visibilityState==='visible')sync();},1000);const state=CapacitorApp.addListener('appStateChange',s=>{if(s.isActive)sync();});return()=>{clearInterval(timer);void state.then(l=>l.remove());};},[loading,reload]);
 return null;
}
