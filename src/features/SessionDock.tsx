import {useEffect,useState} from 'react';
import {Dumbbell,Pause,Play} from '../ui/icons';
import type {Session} from '../core/types';
import {secondsText,sessionSeconds} from '../core/math';
import {changeSessionControl} from '../core/sessionControl';
import {useStore} from '../core/store';
import {useUI} from '../ui/UI';

export function SessionDock({session,onOpen}:{session:Session;onOpen:()=>void}){
 const {reload}=useStore();const {run}=useUI();const [now,setNow]=useState(Date.now());
 useEffect(()=>{if(session.status!=='active')return;const id=setInterval(()=>setNow(Date.now()),1000);return()=>clearInterval(id);},[session.status]);
 const paused=session.status==='paused';const rest=Math.max(0,Math.ceil(((session.restEndsAt??0)-now)/1000));
 const state=paused?'paused':rest?'rest':'active';
 return <aside className={`session-dock ${state}`} aria-label="Zapisany trening"><button className="session-dock-open" aria-label={`Otwórz trening: ${session.planSnapshot.name}`} onClick={onOpen}><span className="dock-icon"><i className="halo"/><Dumbbell size={18}/></span><span className="dock-text"><strong>{session.planSnapshot.name}</strong><small>{paused?'Wstrzymany':rest?'Przerwa':'Trening trwa'}</small></span><b className="dock-time">{rest&&!paused?secondsText(rest):secondsText(sessionSeconds(session,now))}</b></button><button className="dock-toggle" aria-label={paused?'Wznów zapisany trening':'Wstrzymaj zapisany trening'} onClick={()=>void run(async()=>{await changeSessionControl(session.id,paused?'resume':'pause');await reload();})}>{paused?<Play size={22}/>:<Pause size={22}/>}</button></aside>;
}
