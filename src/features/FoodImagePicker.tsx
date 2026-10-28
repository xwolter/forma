import { useState } from 'react';
import { prepareFoodImage } from '../core/foodImage';
import { FoodThumb } from './FoodThumb';
export function FoodImagePicker({value,onChange,onBusyChange}:{value?:string;onChange:(v:string|undefined)=>void;onBusyChange?:(v:boolean)=>void}) {
  const [error,setError]=useState(''),[busy,setBusy]=useState(false);
  return <div className="own-food-photo">
    {value&&<FoodThumb name="Twoje zdjęcie" photoData={value}/>}
    <label className={`scan-photo-action ${busy?'disabled':''}`}>{busy?'Przygotowuję zdjęcie…':value?'Zmień własne zdjęcie':'Dodaj własne zdjęcie jedzenia'}<input type="file" aria-label="Własne zdjęcie jedzenia" accept="image/jpeg,image/png,image/webp" disabled={busy} onChange={e=>{const file=e.target.files?.[0];e.target.value='';if(!file)return;setBusy(true);onBusyChange?.(true);setError('');void prepareFoodImage(file).then(onChange).catch(e=>setError(e instanceof Error?e.message:'Nie udało się odczytać zdjęcia.')).finally(()=>{setBusy(false);onBusyChange?.(false);});}}/></label>
    {value&&<button type="button" className="text-action" onClick={()=>onChange(undefined)}>Usuń zdjęcie</button>}
    {error&&<p className="inline-warning" role="status">{error}</p>}
  </div>;
}
