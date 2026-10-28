import { useState, useEffect, useRef, useMemo, useDeferredValue } from "react";
import { ScanBarcode, Search, Plus, X, Camera, Sparkles } from '../ui/icons';
import { searchFoodPage } from "../core/foodDatabase";
import { searchPolishCatalog } from "../core/offPolishCatalog";
import { catalogStatus, catalogOffer, downloadCatalog, cancelCatalogDownload, findNativeBarcode, searchNativeCatalog, type CatalogOffer } from "../core/nativeFoodCatalog";
import { scanFoodCode, scanFoodImage, exportFile } from "../core/native";
import { foodCode, sameFoodCode } from '../core/foodCode';
import { FoodThumb } from './FoodThumb';
import importedFoods from "../data/foods-pl.json";
import { fmt } from "../core/math";
import type { Product, Recipe, FoodEntry } from "../core/types";
import { Button } from "../ui/UI";
import { useStore } from "../core/store";
import { isNative } from "../core/native";
import { FOOD_STORES, type FoodStoreBit } from "../core/foodStores";
import { foodSearchScore } from '../core/foodDiscovery';
import { POPULAR_MEALS } from '../core/popularMeals';
import { recipePer100 } from '../core/math';

type Category = 'all' | 'breakfast' | 'lunch' | 'dinner' | 'packaged' | 'recent' | 'favorites';

export function FoodLookup({
  query,
  select,
  setQuery,
  initialCode,
  meal,
  history,
  selectRecipe,
  onCreate,
  onQuick,
  onPhoto,
}: {
  query: string;
  select: (p: Product) => Promise<void>;
  setQuery: (q: string) => void;
  initialCode?: string;
  meal: string;
  history: Map<string, { count: number; latest: FoodEntry }>;
  selectRecipe: (recipe: Recipe) => void;
  onCreate: () => void;
  onQuick: () => void;
  onPhoto: () => void;
}) {
  const { data } = useStore();
  const [results, setResults] = useState<Product[]>([]);
  const [resultPage,setResultPage]=useState(0);
  const [hasMore,setHasMore]=useState(false);
  const [localPage,setLocalPage]=useState(0);
  const [localHasMore,setLocalHasMore]=useState(false);
  const [catalogSize,setCatalogSize]=useState(0);
  const [fullAvailable,setFullAvailable]=useState(false);
  const [catalogInfo,setCatalogInfo]=useState<CatalogOffer|null>(null);
  const [catalogBusy,setCatalogBusy]=useState(false);
  const [catalogProgress,setCatalogProgress]=useState(0);
  const [catalogError,setCatalogError]=useState('');
  const [resultSource,setResultSource]=useState<'online'|'native'>('online');
  const [selectedStore,setSelectedStore]=useState<FoodStoreBit>(0);
  const [category,setCategory]=useState<Category>('all');
  const [visibleCount,setVisibleCount]=useState(12);
  const [searchedQuery,setSearchedQuery]=useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const deferredQuery = useDeferredValue(query);
  const initialStarted=useRef(false);
  const lastOnlineRequest=useRef(0);
  const searchSerial=useRef(0);
  const skipAutoFor=useRef('');
  useEffect(() => setVisibleCount(query.trim() ? 40 : 12), [query, category]);
  useEffect(()=>{if(initialCode&&!initialStarted.current){initialStarted.current=true;skipAutoFor.current=initialCode;void lookup(false,undefined,0,initialCode);}},[initialCode]);
  useEffect(()=>{if(!isNative)return;void catalogStatus().then(value=>setFullAvailable(value.available)).catch(()=>{});void catalogOffer().then(setCatalogInfo).catch(()=>{});},[]);
  async function installCatalog(){
    setCatalogBusy(true);setCatalogError('');setCatalogProgress(0);
    try{await downloadCatalog((received,total)=>setCatalogProgress(total>0?Math.min(100,Math.round(received/total*100)):0));setFullAvailable(true);setCatalogProgress(100);}
    catch(e){setCatalogError(e instanceof Error?e.message:'Nie udało się pobrać katalogu.');}
    finally{setCatalogBusy(false);}
  }
  async function lookup(scan = false, image?: File, store = selectedStore, term = query, searchOnline = false) {
    const serial=++searchSerial.current;
    const current=()=>serial===searchSerial.current;
    setBusy(true);
    setMessage("");
    setCatalogError('');
    setResults([]);
    setResultPage(0);
    setHasMore(false);
    setResultSource('online');
    setLocalPage(0);
    setLocalHasMore(false);
    setSearchedQuery('');
    try {
      let q = image ? (await scanFoodImage(image)).map(v => { try { return foodCode(v); } catch { return ''; } }).find(Boolean) : scan ? await scanFoodCode() : term.trim();
      if(!current())return;
      if (q === null) return;
      if (!q) throw new Error('Nie znaleziono kodu produktu na zdjęciu. Zrób wyraźne zdjęcie całego kodu wraz z jasnym marginesem.');
      if (scan || image || /^(?:https?:|\(01\)|\]C1)/.test(q.trim()) || /^[\d\s]+$/.test(q.trim())) q = foodCode(q);
      const storeMask=/^\d+$/.test(q)?0:store;
      if(scan||image){skipAutoFor.current=q;setQuery(q);}
      const cached = data.products.find(
        (p) => p.barcode && sameFoodCode(p.barcode, q),
      );
      const local=!cached && !/^\d+$/.test(q) ? await searchPolishCatalog(q,1,storeMask).catch(()=>null) : null;
      if(!current())return;
      setCatalogSize(local?.catalogSize??0);
      setLocalPage(local?.page??0);
      setLocalHasMore(Boolean(local?.hasMore));
      if(local?.products.length)setResults(local.products);
      let nativeResult: {products:Product[];page:number;hasMore:boolean}|null=null;
      let incomplete=false;
      let nativeError='';
      if(!cached&&fullAvailable){
        try{
          if(/^\d+$/.test(q)){const match=await findNativeBarcode(q);nativeResult={products:match?.product?[match.product]:[],page:1,hasMore:false};incomplete=Boolean(match?.incomplete);}
          else nativeResult=await searchNativeCatalog(q,1,storeMask);
        }catch(e){nativeError=e instanceof Error?e.message:'Nie udało się odczytać pobranej bazy.';}
      }
      if(!current())return;
      if(nativeError)setCatalogError(`Pobrana baza nie działa: ${nativeError} Możesz pobrać ją ponownie.`);
      let online=null;
      if(!cached&&!nativeResult?.products.length&&storeMask===0&&(searchOnline||/^\d+$/.test(q))){
        lastOnlineRequest.current=Date.now();
        online=await searchFoodPage(q).catch(error=>{if(local?.products.length)return null;throw error;});
      }
      if(!current())return;
      const extras=nativeResult?.products.length?nativeResult.products:(online?.products??[]);
      const found=cached?[cached]:[...(local?.products??[]),...extras.filter(p=>!local?.products.some(item=>item.id===p.id))];
      setResults(found);
      setResultSource(nativeResult?.products.length?'native':'online');
      setResultPage(nativeResult?.products.length?nativeResult.page:(online?.page??0));
      setHasMore(nativeResult?.products.length?nativeResult.hasMore:Boolean(online?.hasMore));
      setSearchedQuery(q);
      if (!found.length)
        setMessage(
          nativeError?`Nie udało się przeszukać pobranej bazy. ${nativeError}`:incomplete?"Znaleziono produkt, ale nie ma potwierdzonych kalorii. Wpisz wartości z etykiety jako własny produkt.":storeMask?"Brak produktu z kaloriami oznaczonego dla tego sklepu. Sprawdź inny sklep lub wyszukaj we wszystkich.":"Brak produktu z kompletną informacją o energii. Wpisz wartości z etykiety jako własny produkt.",
        );
    } catch (e) {
      if(current())setMessage(
        e instanceof Error ? e.message : "Nie udało się wyszukać produktu.",
      );
    } finally {
      if(current())setBusy(false);
    }
  }
  useEffect(()=>{
    const term=query.trim();
    if(skipAutoFor.current===term){skipAutoFor.current='';return;}
    if(term.length<2){searchSerial.current++;setResults([]);setMessage('');setSearchedQuery('');setBusy(false);return;}
    const timer=window.setTimeout(()=>void lookup(false,undefined,selectedStore,term),450);
    return ()=>window.clearTimeout(timer);
  },[query,selectedStore,fullAvailable]);
  async function loadMore(){
    if(busy||(!hasMore&&!localHasMore)||!searchedQuery||searchedQuery!==query.trim())return;
    setBusy(true);setMessage('');
    try{
      if(localHasMore){
        const next=await searchPolishCatalog(searchedQuery,localPage+1,selectedStore);
        setResults(previous=>{const ids=new Set(previous.map(p=>p.id));return [...previous,...next.products.filter(p=>!ids.has(p.id))];});
        setLocalPage(next.page);setLocalHasMore(next.hasMore);
        return;
      }
      if(resultSource==='native'){
        const next=await searchNativeCatalog(searchedQuery,resultPage+1,selectedStore);
        if(!next)throw new Error('Katalog jest niedostępny.');
        setResults(previous=>{const ids=new Set(previous.map(p=>p.id));return [...previous,...next.products.filter(p=>!ids.has(p.id))];});
        setResultPage(next.page);setHasMore(next.hasMore);
        return;
      }
      const delay=Math.max(0,6700-(Date.now()-lastOnlineRequest.current));
      if(delay)await new Promise(resolve=>setTimeout(resolve,delay));
      lastOnlineRequest.current=Date.now();
      const next=await searchFoodPage(searchedQuery,resultPage+1);
      setResults(previous=>{const ids=new Set(previous.map(p=>p.id));return [...previous,...next.products.filter(p=>!ids.has(p.id))];});
      setResultPage(next.page);setHasMore(next.hasMore);
      if(!next.products.length&&!next.hasMore)setMessage('To już koniec wyników z kompletnymi danymi.');
    }catch(e){setMessage(e instanceof Error?e.message:'Nie udało się pobrać kolejnych wyników.');}
    finally{setBusy(false);}
  }
  const items = useMemo(() => {
    const byId = new Map<string, Product>();
    for (const product of [...data.products, ...POPULAR_MEALS, ...results]) if (!byId.has(product.id)) byId.set(product.id, product);
    const term = deferredQuery.trim();
    const mealTag = meal === 'Śniadanie' ? 'breakfast' : meal === 'Obiad' ? 'lunch' : meal === 'Kolacja' ? 'dinner' : '';
    const ranked: Array<{ item: Product | Recipe; score: number; approximate: boolean; recipe: boolean }> = [];
    const remoteIds = new Set(results.map(product => product.id));
    const addProducts = (allowApproximate: boolean) => { for (const product of byId.values()) {
      if (category === 'packaged' && !product.barcode) continue;
      if ((category === 'breakfast' || category === 'lunch' || category === 'dinner') && !product.tags?.includes(category)) continue;
      if (category === 'recent' && !history.has(product.id)) continue;
      if (category === 'favorites' && !product.favorite) continue;
      if (selectedStore && (!product.barcode || !remoteIds.has(product.id))) continue;
      if (!term && category === 'all' && !product.id.startsWith('meal-')) continue;
      const match = foodSearchScore(product, term, allowApproximate);
      if (!match || match.approximate !== allowApproximate) continue;
      const count = history.get(product.id)?.count ?? 0;
      const recency = history.get(product.id)?.latest.date ?? '';
      ranked.push({ item: product, score: match.score + Math.min(18, count * 3) + (product.favorite ? 8 : 0) + (!term && product.tags?.includes(mealTag) ? 14 : 0) + (!term && recency ? 12 : 0), approximate: match.approximate, recipe: false });
    }};
    addProducts(false);
    if (term && ranked.length < 8) addProducts(true);
    if (category === 'all' || category === 'recent') for (const recipe of data.recipes) {
      if (category === 'recent' && !history.has(recipe.id)) continue;
      const match = foodSearchScore(recipe as unknown as Product, term);
      if (match) ranked.push({ item: recipe, score: match.score + 25 + Math.min(18, (history.get(recipe.id)?.count ?? 0) * 3), approximate: match.approximate, recipe: true });
    }
    ranked.sort((a, b) => b.score - a.score || (a.recipe === b.recipe ? 0 : Number(b.recipe) - Number(a.recipe)) || a.item.name.localeCompare(b.item.name, 'pl'));
    return ranked;
  }, [data.products, data.recipes, results, deferredQuery, category, history, meal, selectedStore]);
  return (
    <section className="food-lookup unified-food-search" aria-label="Wyszukiwanie jedzenia">
      <div className="food-search-box">
        <Search size={21} aria-hidden="true" />
        <input
          autoFocus
          aria-label="Szukaj jedzenia"
          placeholder="Np. tosty z szynką i serem"
          value={query}
          onChange={event => setQuery(event.target.value)}
          type="search"
          enterKeyHint="search"
          autoComplete="off"
        />
        {query && <button className="food-clear-search" type="button" aria-label="Wyczyść wyszukiwanie" onClick={() => setQuery('')}><X size={16}/></button>}
        <button className="food-scan-button" type="button" aria-label="Skanuj kod produktu" disabled={busy} onClick={() => void lookup(true, undefined, 0)}><ScanBarcode size={23}/></button>
      </div>
      <button className="food-ai-cta" type="button" onClick={onPhoto}><span><Camera size={21}/><Sparkles size={12}/></span><span><strong>Rozpoznaj posiłek ze zdjęcia</strong><small>AI oszacuje danie, wagę i kalorie</small></span><Plus size={17}/></button>
      <div className="food-unified-categories" role="group" aria-label="Pokaż jedzenie">
        {([
          ['all', 'Wszystko'], ['packaged', 'Sklepowe'], ['breakfast', 'Śniadania'],
          ['lunch', 'Obiady'], ['dinner', 'Kolacje'], ['recent', 'Ostatnie'], ['favorites', 'Ulubione'],
        ] as const).map(([value, label]) => <button type="button" key={value} className={category === value ? 'active' : ''} aria-pressed={category === value} onClick={() => { setCategory(value); if (value !== 'packaged') setSelectedStore(0); }}>{label}</button>)}
      </div>
      {category === 'packaged' && <div className="food-store-filter"><span>Sklep</span><select aria-label="Filtr sklepu" value={selectedStore} onChange={event => setSelectedStore(Number(event.target.value) as FoodStoreBit)}><option value={0}>Wszystkie sklepy</option>{FOOD_STORES.map(store => <option key={store.bit} value={store.bit}>{store.name}</option>)}</select><small>Oznaczenia sklepów pochodzą od społeczności; sprawdź etykietę i dostępność.</small></div>}
      <div className="food-result-heading"><strong>{query.trim() ? 'Wyniki' : category === 'all' ? 'Na dobry początek' : 'Pasujące jedzenie'}</strong><span>{busy && query.trim() ? 'Szukam…' : `${items.length} ${items.length === 1 ? 'pozycja' : 'pozycji'}`}</span></div>
      {items.length > 0 ? <div className="food-unified-list">
        {items.slice(0, visibleCount).map(({item, approximate, recipe}) => {
          const product = recipe ? null : item as Product;
          const portion = product?.servingGrams;
          const per100 = recipe ? recipePer100((item as Recipe).nutrients, (item as Recipe).cookedWeight) : product!;
          const kcal = portion ? Math.round(per100.kcal * portion / 100) : Math.round(per100.kcal);
          const isEstimate = Boolean(product?.id.startsWith('meal-'));
          return <button type="button" className="food-unified-row" key={item.id} disabled={busy} onClick={() => {
            if (recipe) selectRecipe(item as Recipe);
            else { setBusy(true); void select(item as Product).catch(() => setMessage('Nie udało się wybrać produktu.')).finally(() => setBusy(false)); }
          }}>
            <FoodThumb name={item.name} product={product ?? undefined} photoKey={recipe ? (item as Recipe).photoKey : undefined} photoData={recipe ? (item as Recipe).photoData : undefined}/>
            <span className="food-unified-copy"><strong>{item.name}</strong><small>{recipe ? 'Twój przepis · 100 g' : isEstimate ? `Przykładowa porcja · ${portion} g` : `${product?.brand || 'Produkt'} · ${portion ? `porcja ${portion} ${product?.unit}` : `100 ${product?.unit}`}`}{approximate && <em> · podobny wynik</em>}</small></span>
            <span className="food-unified-energy"><b>{fmt(kcal)}</b><small>kcal{!portion && !recipe ? ` / 100 ${product?.unit}` : ''}</small></span>
            <span className="food-unified-plus"><Plus size={17}/></span>
          </button>;
        })}
      </div> : <div className="food-search-empty" role="status"><Search size={24}/><strong>{busy ? 'Szukam jedzenia…' : query.trim() ? 'Nie ma pasującego wyniku' : 'Tu pojawią się Twoje posiłki'}</strong><small>{!busy && query.trim() ? ((category === 'all' || category === 'packaged') && message) || 'Spróbuj krótszej nazwy albo wybierz „Wszystko”.' : 'Wpisz nazwę dania lub wybierz kategorię.'}</small></div>}
      {query.trim() && items.some(row => row.approximate) && <p className="food-search-hint">{items.some(row => !row.approximate) ? 'Także podobne dania - sprawdź skład.' : 'Możliwa literówka - sprawdź podobny wynik.'}</p>}
      {items.some(row => !row.recipe && (row.item as Product).id.startsWith('meal-')) && <p className="food-search-hint">Dania domowe: orientacyjne wartości. Porcję możesz zmienić.</p>}
      {items.length > visibleCount && <Button variant="secondary" className="full" onClick={() => setVisibleCount(n => n + 40)}>Pokaż więcej wyników</Button>}
      {(hasMore || localHasMore) && searchedQuery === query.trim() && <Button variant="secondary" className="full" disabled={busy} onClick={() => void loadMore()}>{busy ? 'Pobieram…' : 'Pokaż kolejne z katalogu'}</Button>}
      {items.length > 0 && message.startsWith('Nie udało się wybrać') && <p role="status" className="inline-warning">{message}</p>}
      <div className="food-search-actions"><button type="button" onClick={onCreate}><Plus size={18}/>Dodaj własne danie</button><button type="button" onClick={onQuick}>Wpisz same kcal</button></div>
      <details className="food-search-options"><summary>Więcej sposobów wyszukiwania</summary>
        <label className={`scan-photo-action ${busy ? 'disabled' : ''}`}>Odczytaj kod ze zdjęcia<input type="file" aria-label="Zdjęcie kodu produktu" accept="image/jpeg,image/png,image/webp" disabled={busy} onChange={event => { const file=event.target.files?.[0]; event.target.value=''; if(file) void lookup(false,file); }}/></label>
        <small>Możesz zeskanować EAN z opakowania. QR z numerem GS1 też zadziała; kupony sklepowe nie zawierają danych jedzenia.</small>
        {isNative && <div className="food-catalog-card"><div><strong>Pełna baza produktów na telefon</strong><small>{fullAvailable ? 'Pobrana · wyszukujesz w tym samym polu' : catalogInfo ? `${new Intl.NumberFormat('pl-PL').format(catalogInfo.products)} produktów · plik ${Math.round(catalogInfo.bytes/1048576)} MB · ok. ${Math.round(catalogInfo.databaseBytes/1048576)} MB po pobraniu` : 'Miliony produktów do wyszukiwania po nazwie i kodzie'}</small></div>{(!fullAvailable || catalogError) && (catalogBusy ? <div className="food-catalog-progress"><span>{catalogProgress}%</span><button type="button" onClick={() => void cancelCatalogDownload()}>Anuluj</button></div> : <Button variant="secondary" onClick={() => void installCatalog()}>{fullAvailable ? 'Pobierz ponownie' : 'Pobierz bazę'}</Button>)}{catalogBusy && <progress max="100" value={catalogProgress} aria-label="Postęp pobierania bazy"/>}{catalogError && <p role="status" className="inline-warning">{catalogError}</p>}</div>}
        <div className="food-source-note">Produkty sklepowe: Open Food Facts i Open Prices{catalogSize > 0 ? ` · polski katalog ${new Intl.NumberFormat('pl-PL').format(catalogSize)} produktów` : ''}, dane społecznościowe. Porównaj z etykietą. Dania przykładowe: USDA FNDDS 2021-2023. Zdjęcia opakowań: Open Food Facts contributors (CC BY-SA 3.0).</div>
        <button className="text-action" type="button" onClick={() => void exportFile('FORMA-produkty-ODbL.json', JSON.stringify({source:'Open Food Facts contributors',license:'ODbL-1.0',licenseUrl:'https://opendatacommons.org/licenses/odbl/1-0/',products:importedFoods},null,2)).catch(() => setMessage('Nie udało się udostępnić bazy produktów.'))}>Dane i licencja</button>
      </details>
    </section>
  );
}
