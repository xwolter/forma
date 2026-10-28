import { useState, type CSSProperties } from 'react';
import { Droplet, Minus, Plus } from '../ui/icons';
import { useStore } from '../core/store';
import { incrementWater, setWater } from '../core/db';
import { fmt, numberInput } from '../core/math';
import { Button, Field, Sheet, useUI } from '../ui/UI';

export function WaterPanel({date}:{date:string}) {
  const { data, reload } = useStore();
  const { run, show, toast } = useUI();
  const [waterFx,setWaterFx]=useState(0);
  const value = data.daily.find(d=>d.date===date)?.water ?? 0;
  const goal = data.profiles[0]?.waterGoal;
  const fill = goal?Math.min(1,value/goal):Math.min(1,value/2500);
  const adjust = (amount:number) => void run(async()=>{
    const delta = await incrementWater(date, amount);
    await reload();
    if(delta){if(delta>0)setWaterFx(v=>v+1);toast(`${delta>0?'+':''}${fmt(delta)} ml wody`,async()=>{await incrementWater(date,-delta);await reload();});}
  });
  return <section className="water-panel" aria-label="Woda" style={{'--wave-top':`${100-fill*78-6}%`} as CSSProperties}>
    <i className="wave w1" aria-hidden="true"/><i className="wave w2" aria-hidden="true"/>
    <i className="bubble b1" aria-hidden="true"/><i className="bubble b2" aria-hidden="true"/>
    {waterFx>0&&<span key={waterFx} className="water-action-drop" aria-hidden="true"><Droplet size={20}/><i/></span>}
    <div className="water-head"><span className="icon-bubble card"><Droplet size={20}/></span><strong>Woda</strong><span className="water-remaining">{goal?value>=goal?'Cel osiągnięty':`${fmt(goal-value)} ml do celu`:'Ustaw cel'}</span></div>
    <div className="water-amount"><strong key={value}>{fmt(value)}</strong><span>{goal?`/ ${fmt(goal)} ml`:'ml'}</span></div>
    <div className="water-track" role="progressbar" aria-label="Wypita woda w ml" aria-valuemin={0} aria-valuenow={value} aria-valuemax={Math.max(value,goal??100000)}><i style={{width:`${goal?Math.min(100,value/goal*100):0}%`}}/></div>
    <div className="water-controls"><button aria-label="Odejmij 250 ml wody" disabled={!value} onClick={()=>adjust(-250)}><Minus size={16}/>250</button><button className="primary" aria-label="Dodaj 250 ml wody" onClick={()=>adjust(250)}><Plus size={16}/>250 ml</button><button className="water-edit" aria-label="Zmień ilość" onClick={()=>show(<WaterEditor date={date}/>)}>Zmień</button></div>
  </section>;
}
function WaterEditor({date}:{date:string}) {
  const {data,reload}=useStore();const {run,close,toast}=useUI();
  const [value,setValue]=useState(String(data.daily.find(d=>d.date===date)?.water??0));
  return <Sheet title="Zmień ilość wody"><p className="muted">Wpisz łączną ilość wypitą tego dnia. Możesz poprawić pomyłkę albo wpisać 0.</p><Field label="Woda tego dnia · ml"><input className="big-input" inputMode="numeric" value={value} onChange={e=>setValue(e.target.value)}/></Field><div className="chip-row water-quick-presets">{[0,500,1000,1500,2000,2500].map(n=><button key={n} className={numberInput(value)===n?'active':''} onClick={()=>setValue(String(n))}>{fmt(n)} ml</button>)}</div><Button className="full" onClick={()=>void run(async()=>{const previous=await setWater(date,numberInput(value));await reload();close();toast('Ilość wody poprawiona',async()=>{await setWater(date,previous);await reload();});})}>Zapisz ilość</Button></Sheet>;
}
