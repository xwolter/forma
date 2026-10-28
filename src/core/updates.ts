import { registerPlugin } from '@capacitor/core';
import { isNative } from './native';
export const UPDATE_ORIGIN='https://forma-mobi-2026-4e7c1a.web.app';
export type Release={schema:1;packageName:string;version:string;versionCode:number;bytes:number;sha256:string;url:string;notes:string[];available?:boolean};
export type ReadyUpdate={token:string;version:string;versionCode:number;bytes:number;sha256:string};
export const nativeUpdater=registerPlugin<{
 status():Promise<{version:string;versionCode:number;installAllowed:boolean}>;
 check():Promise<Release>;
 download():Promise<ReadyUpdate>;
 choose():Promise<ReadyUpdate|undefined>;
 install(options:{token:string}):Promise<{needsPermission:boolean}>;
 addListener(event:'progress',fn:(progress:{received:number;total:number})=>void):Promise<{remove:()=>Promise<void>}>;
}>('FormaUpdater');
export function validateRelease(value:unknown):Release {
 const r=value as Release;
 if(!r||r.schema!==1||r.packageName!=='pl.forma.dziennik'||!/^\d+\.\d+\.\d+$/.test(r.version)||!Number.isInteger(r.versionCode)||r.versionCode<1||r.versionCode>2147483647||!Number.isInteger(r.bytes)||r.bytes<1||r.bytes>100*1024*1024||!/^[a-f0-9]{64}$/i.test(r.sha256)||r.url!==`${UPDATE_ORIGIN}/releases/FORMA-${r.version}.apk`||!Array.isArray(r.notes)||r.notes.length>20||r.notes.some(n=>typeof n!=='string'||n.length>500))throw new Error('Nieprawidłowe informacje o aktualizacji.');
 return r;
}
export async function checkForUpdate() {
 if(isNative)return validateRelease(await nativeUpdater.check());
 const response=await fetch(`${UPDATE_ORIGIN}/releases/latest.json`,{cache:'no-store',signal:AbortSignal.timeout(12000)});
 if(!response.ok)throw new Error('Serwer aktualizacji jest chwilowo niedostępny.');
 const text=await response.text();if(text.length>16384)throw new Error('Nieprawidłowe informacje o wydaniu.');return validateRelease(JSON.parse(text));
}
