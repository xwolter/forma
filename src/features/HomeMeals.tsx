import { ArrowRight, Clock, Plus } from '../ui/icons';
import { dayTotals, dateLabel, fmt, scaleNutrients, plural } from '../core/math';
import { useStore } from '../core/store';
import type { FoodEntry } from '../core/types';
import { Button, Sheet, useUI } from '../ui/UI';
import { AddFood, EntryEditor } from './Food';
import { FoodThumb } from './FoodThumb';

export function HomeMeals({date,openDiary}:{date:string;openDiary:()=>void}) {
  const {data}=useStore(),{show}=useUI();
  const names=[...new Set(['Śniadanie','Obiad','Kolacja','Przekąski',...data.food.filter(e=>e.date===date).map(e=>e.meal)])];
  return <section className="card list-card home-day-meals" aria-label="Posiłki wybranego dnia">
    {names.map(meal=>{
      const entries=data.food.filter(e=>e.date===date&&e.meal===meal);
      const consumed=entries.filter(e=>e.status==='consumed'),planned=entries.filter(e=>e.status==='planned');
      return <div className="meal-line" key={meal}>
        <button className="meal-line-open" onClick={()=>show(entries.length?<HomeMealDetail date={date} meal={meal}/>:<AddFood date={date} meal={meal}/>)}>
          <span className="row-text"><strong>{meal}</strong><small>{entries.length?`${entries.length} ${plural(entries.length,'pozycja','pozycje','pozycji')}`:'Brak wpisów'}{planned.length>0&&<> · <Clock size={12}/> {fmt(dayTotals(planned,date,'planned').kcal)} kcal plan</>}</small></span>
          <span className="row-value">{fmt(dayTotals(consumed,date).kcal)}<small> kcal</small></span>
        </button>
        <button className="round-btn soft" aria-label={`Dodaj do: ${meal}`} onClick={()=>show(<AddFood date={date} meal={meal}/>)}><Plus size={18}/></button>
      </div>;
    })}
    <button className="pill-btn sunk wide" onClick={openDiary}><span>Otwórz dziennik dnia</span><ArrowRight size={18}/></button>
  </section>;
}
function HomeMealDetail({date,meal}:{date:string;meal:string}) {
  const {data}=useStore(),{show}=useUI();
  const entries=data.food.filter(e=>e.date===date&&e.meal===meal);
  return <Sheet title={meal}>
    <p className="food-entry-context">{dateLabel(date,{day:'numeric',month:'long',year:'numeric'})}</p>
    <div className="entry-stack">{entries.map((entry:FoodEntry)=><button className={`food-row ${entry.status==='planned'?'planned':''}`} key={entry.id} onClick={()=>show(<EntryEditor entry={entry}/>)}>
      <FoodThumb name={entry.name} product={data.products.find(p=>p.id===entry.productId)} photoKey={data.recipes.find(r=>r.id===entry.productId)?.photoKey} photoData={data.recipes.find(r=>r.id===entry.productId)?.photoData}/>
      <span className="row-text"><strong>{entry.name}</strong><small>{fmt(entry.grams)} {entry.unit}{entry.status==='planned'&&<span className="tag info"><Clock size={12}/>Zaplanowane</span>}</small></span>
      <span className="row-value">{fmt(scaleNutrients(entry.nutrients,entry.quick?1:entry.grams/100).kcal)}<small> kcal</small></span>
    </button>)}</div>
    <Button className="full" onClick={()=>show(<AddFood date={date} meal={meal}/>)}><Plus size={18}/>Dodaj do tego posiłku</Button>
  </Sheet>;
}
