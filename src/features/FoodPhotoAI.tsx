import { useEffect, useMemo, useState } from 'react';
import { Camera, Image as ImageIcon, ArrowLeft, Sparkles, Check } from '../ui/icons';
import { recognizeMealPhoto, type MealPhotoEstimate } from '../core/mealPhotoAI';
import { POPULAR_MEALS } from '../core/popularMeals';
import { foodSearchScore } from '../core/foodDiscovery';
import { numberInput } from '../core/math';
import type { Product } from '../core/types';
import { useStore } from '../core/store';
import { Button, Field } from '../ui/UI';
import { isNative } from '../core/native';

export function FoodPhotoAI({ onBack, onUse, onUseCatalog }: {
  onBack: () => void;
  onUse: (result: MealPhotoEstimate, values: { name: string; grams: number; kcal: number }) => void;
  onUseCatalog: (product: Product, grams: number) => void;
}) {
  const { data } = useStore();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState('');
  const [result, setResult] = useState<MealPhotoEstimate | null>(null);
  const [name, setName] = useState('');
  const [grams, setGrams] = useState('');
  const [kcal, setKcal] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    if (!file) { setPreview(''); return; }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);
  const matches = useMemo(() => {
    if (!result) return [];
    const seen = new Set<string>();
    return [...data.products, ...POPULAR_MEALS].filter(item => {
      if (seen.has(item.id)) return false;
      seen.add(item.id);
      return !item.barcode;
    }).map(item => ({ item, score: foodSearchScore(item, result.name)?.score ?? 0 }))
      .filter(row => row.score >= 40)
      .sort((a, b) => b.score - a.score)
      .slice(0, 2).map(row => row.item);
  }, [data.products, result]);
  function choose(next: File | undefined) {
    if (!next) return;
    setFile(next); setResult(null); setError('');
  }
  async function chooseNative(source: 'camera' | 'gallery') {
    setError('');
    try {
      const { Camera, CameraResultType, CameraSource } = await import('@capacitor/camera');
      const photo = await Camera.getPhoto({ quality: 85, width: 1600, resultType: CameraResultType.Uri, source: source === 'camera' ? CameraSource.Camera : CameraSource.Photos, correctOrientation: true });
      if (!photo.webPath) throw new Error('Nie udało się odczytać zdjęcia.');
      const response = await fetch(photo.webPath);
      if (!response.ok) throw new Error('Nie udało się otworzyć zdjęcia.');
      const blob = await response.blob();
      choose(new File([blob], 'posilek.jpg', { type: blob.type || 'image/jpeg' }));
    } catch (e) {
      const message = e instanceof Error ? e.message : '';
      if (!/cancel|anulow/i.test(message)) setError(message || 'Nie udało się wybrać zdjęcia.');
    }
  }
  async function analyze() {
    if (!file) return;
    setBusy(true); setError('');
    try {
      const next = await recognizeMealPhoto(file);
      setResult(next); setName(next.name); setGrams(String(next.grams)); setKcal(String(next.kcal));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Nie udało się przeanalizować zdjęcia.');
    } finally { setBusy(false); }
  }
  function useEstimate() {
    const weight = numberInput(grams), energy = numberInput(kcal);
    if (!result || !name.trim() || !Number.isFinite(weight) || weight < 10 || weight > 3000 || !Number.isFinite(energy) || energy < 1 || energy > 10000) {
      setError('Podaj nazwę, wagę 10-3000 g i kalorie 1-10000 kcal.'); return;
    }
    onUse(result, { name: name.trim(), grams: weight, kcal: energy });
  }
  return <section className="food-photo-ai">
    <Button variant="ghost" onClick={onBack}><ArrowLeft size={17}/>Wróć do jedzenia</Button>
    <div className="food-photo-heading"><span className="food-photo-icon"><Sparkles size={24}/></span><div><h3>Posiłek ze zdjęcia</h3><p>Rozpoznaj danie, a potem sprawdź i popraw porcję.</p></div></div>
    <div className="food-photo-pickers">{isNative ? <>
      <button type="button" onClick={() => void chooseNative('camera')}><Camera size={19}/>Zrób zdjęcie</button>
      <button type="button" onClick={() => void chooseNative('gallery')}><ImageIcon size={19}/>Z galerii</button>
    </> : <>
      <label><Camera size={19}/>Zrób zdjęcie<input type="file" accept="image/*" capture="environment" onChange={e => { choose(e.target.files?.[0]); e.target.value=''; }}/></label>
      <label><ImageIcon size={19}/>Z galerii<input type="file" accept="image/jpeg,image/png,image/webp" onChange={e => { choose(e.target.files?.[0]); e.target.value=''; }}/></label>
    </>}</div>
    {!file && <div className="food-photo-tips"><strong>Żeby wynik był lepszy</strong><span>• Pokaż cały talerz w dobrym świetle.</span><span>• Fotografuj z góry, bez opakowań zasłaniających jedzenie.</span><span>• Waga ze zdjęcia jest zawsze przybliżona - poprawisz ją przed zapisem.</span><small>Analiza wymaga internetu i potwierdzonego konta FORMA.</small></div>}
    {preview && <img className="food-photo-preview" src={preview} alt="Wybrane zdjęcie posiłku"/>}
    {file && !result && <><p className="food-photo-disclosure">Po naciśnięciu „Analizuj” zdjęcie zostanie przesłane do usługi AI Google w celu rozpoznania posiłku. Nie zapisujemy zdjęcia w dzienniku.</p><Button className="full" disabled={busy} onClick={() => void analyze()}><Sparkles size={18}/>{busy ? 'Analizuję zdjęcie…' : 'Analizuj zdjęcie'}</Button></>}
    {error && <p className="inline-warning" role="alert">{error}</p>}
    {result && <div className="food-photo-result">
      <div className="food-photo-result-title"><Sparkles size={18}/><strong>Propozycja AI</strong><span>{result.confidence === 'high' ? 'wyraźne zdjęcie' : result.confidence === 'medium' ? 'sprawdź skład' : 'mała pewność'}</span></div>
      <Field label="Co jest na zdjęciu"><input value={name} maxLength={100} onChange={e => setName(e.target.value)}/></Field>
      <div className="food-photo-numbers"><Field label="Waga · g"><input inputMode="decimal" value={grams} onChange={e => setGrams(e.target.value)}/></Field><Field label="Kalorie · kcal"><input inputMode="decimal" value={kcal} onChange={e => setKcal(e.target.value)}/></Field></div>
      {result.components.length > 0 && <div className="food-photo-components"><strong>Na talerzu</strong>{result.components.map((part, i) => <span key={`${part.name}-${i}`}>{part.name} <b>~{part.grams} g</b></span>)}</div>}
      <p className="food-photo-caution">To szacunek ze zdjęcia, nie pomiar. {result.uncertainty} Możesz poprawić wagę i kalorie przed zapisem.</p>
      <Button className="full" onClick={useEstimate}><Check size={18}/>Użyj tej propozycji</Button>
      {matches.length > 0 && <div className="food-photo-matches"><strong>Podobne w katalogu</strong><small>Wybierz, jeśli skład jest taki sam. Kalorie zostaną przeliczone z danych katalogu.</small>{matches.map(product => <button key={product.id} type="button" onClick={() => onUseCatalog(product, Number.isFinite(numberInput(grams)) ? numberInput(grams) : result.grams)}><span>{product.name}<small>{Math.round(product.kcal)} kcal / 100 g</small></span><Check size={17}/></button>)}</div>}
    </div>}
  </section>;
}
