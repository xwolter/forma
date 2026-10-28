import { useEffect } from 'react';
import { App as CapacitorApp } from '@capacitor/app';
import { useStore } from '../core/store';
import { synchronizeWidgets, nativeWidgets } from '../core/widgets';
import { isNative } from '../core/native';
export function NativeWidgetsSync({navigate}:{navigate:(route:string)=>void}) {
 const {data,loading,reload}=useStore();
 useEffect(()=>{if(!isNative||loading)return;void synchronizeWidgets().then(changed=>{if(changed)return reload();}).catch(()=>{});},[data,loading,reload]);
 useEffect(()=>{
  if(!isNative||loading||!data.profiles.length)return;
  let active=true;
  const refresh=async()=>{try{if(await synchronizeWidgets())await reload();const {route}=await nativeWidgets.route();if(active&&['today','food','food-add','training','progress'].includes(route))navigate(route);}catch{}};
  void refresh();const state=CapacitorApp.addListener('appStateChange',s=>{if(s.isActive)void refresh();});const launch=nativeWidgets.addListener('launch',()=>void refresh());
  return()=>{active=false;void state.then(l=>l.remove());void launch.then(l=>l.remove());};
 },[loading,data.profiles[0]?.id,navigate,reload]);
 return null;
}
