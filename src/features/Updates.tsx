import { useEffect, useState } from 'react';
import { Download, FileCheck2, RefreshCw, ShieldCheck } from '../ui/icons';
import { version as appVersion } from '../../package.json';
import { Button, Sheet, useUI } from '../ui/UI';
import { checkForUpdate, nativeUpdater, type ReadyUpdate, type Release } from '../core/updates';
import { isNative } from '../core/native';
import { dbPromise } from '../core/db';

export function Updates() {
 const {run}=useUI();const [release,setRelease]=useState<Release|null>(null),[ready,setReady]=useState<ReadyUpdate|null>(null),[version,setVersion]=useState(appVersion),[currentCode,setCurrentCode]=useState(11),[busy,setBusy]=useState(false),[progress,setProgress]=useState(0),[message,setMessage]=useState(''),[error,setError]=useState('');
 const check=async()=>{setBusy(true);setError('');try{if(isNative){const status=await nativeUpdater.status();setVersion(status.version);setCurrentCode(status.versionCode);}setRelease(await checkForUpdate());}catch(e){setError(e instanceof Error?e.message:'Nie udało się sprawdzić aktualizacji.');}finally{setBusy(false);}};
 useEffect(()=>{void check();if(!isNative)return;const listener=nativeUpdater.addListener('progress',p=>setProgress(p.total?Math.min(100,Math.round(p.received/p.total*100)):0));return()=>{void listener.then(l=>l.remove());};},[]);
 const perform=(action:()=>Promise<void>)=>{setBusy(true);void run(action).finally(()=>setBusy(false));};
 return <Sheet title="Aktualizacje FORMA"><div className="update-version"><RefreshCw size={26}/><span>Twoja wersja<strong>{version}</strong></span></div>
 {error&&<p role="status" className="inline-warning">{error}</p>}
 {release&&<section className="release-panel"><h3>{release.versionCode>currentCode?`Dostępna wersja ${release.version}`:'Masz aktualną wersję'}</h3><p className="muted small">Najnowsze wydanie: {release.version} · {(release.bytes/1024/1024).toFixed(1)} MB</p><ul>{release.notes.map(n=><li key={n}>{n}</li>)}</ul></section>}
 {ready?<div className="ready-update"><FileCheck2 size={25}/><h3>Wersja {ready.version} gotowa do instalacji</h3><p>Sprawdzono zgodność aplikacji i podpisu. Android dodatkowo zweryfikuje APK przed instalacją.</p><Button className="full" disabled={busy} onClick={()=>perform(async()=>{const r=await nativeUpdater.install({token:ready.token});setMessage(r.needsPermission?'Zezwól aplikacji FORMA na instalowanie aktualizacji w ustawieniach Androida, wróć tutaj i ponów instalację.':'Potwierdź aktualizację w oknie Androida. Twoje dane pozostaną w aplikacji.');})}>Zainstaluj aktualizację</Button></div>:release&&release.versionCode>currentCode&&<Button className="full" disabled={busy||!isNative} onClick={()=>perform(async()=>{setProgress(0);setReady(await nativeUpdater.download());setProgress(100);})}><Download size={18}/>{busy?`Pobieranie · ${progress}%`:'Pobierz aktualizację'}</Button>}
 {busy&&progress>0&&<progress className="download-progress" value={progress} max={100} aria-label="Postęp pobierania"/>}{message&&<p role="status" className="inline-warning">{message}</p>}
 <Button variant="secondary" className="full" disabled={busy} onClick={()=>void check()}><RefreshCw size={17}/>{busy?'Sprawdzanie…':'Sprawdź ponownie'}</Button>
 {isNative&&<Button variant="ghost" className="full" disabled={busy} onClick={()=>perform(async()=>{const r=await nativeUpdater.choose();if(r?.token)setReady(r);})}>Wybierz pobrany plik APK</Button>}
 <p className="update-security muted small"><ShieldCheck size={17}/>APK pobierane są wyłącznie z serwera FORMA. Aplikacja sprawdza rozmiar, SHA-256, nazwę pakietu, nowszy numer wersji i zgodność podpisu. Instalację zatwierdzasz w Androidzie. Przed instalacją możesz wykonać kopię w ustawieniach.</p>
 {!isNative&&<p className="muted small">Pobieranie i instalowanie aktualizacji działa w aplikacji Android. To podgląd przeglądarkowy.</p>}</Sheet>;
}
export function UpdateNotice() {
 const {show}=useUI();const [available,setAvailable]=useState('');
 useEffect(()=>{if(!isNative)return;let active=true;void (async()=>{const db=await dbPromise,last=await db.get('meta','last-update-check');if(typeof last==='number'&&Date.now()-last<86400000)return;await db.put('meta',Date.now(),'last-update-check');const release=await checkForUpdate(),status=await nativeUpdater.status();if(active&&release.versionCode>status.versionCode)setAvailable(release.version);})().catch(()=>{});return()=>{active=false;};},[]);
 return available?<button className="update-notice" onClick={()=>show(<Updates/>)}>Dostępna FORMA {available} · Zobacz aktualizację →</button>:null;
}
