import { useState, useRef, useMemo } from "react";
import {
  ArrowLeft,
  Check,
  Copy,
  Plus,
  Trash2,
  X,
  ChevronLeft,
  ChevronRight,
  Droplet,
  Fire,
  Fish,
  Grains,
  Clock,
  CalendarBlank,
  SealCheck,
  Warning,
} from '../ui/icons';
import { stamp } from "../core/catalog";
import {
  dayTotals,
  dateLabel,
  emptyNutrients,
  fmt,
  goalForDate,
  numberInput,
  positiveInput,
  recipePer100,
  recipeTotals,
  scaleNutrients,
  shiftDate,
  plural,
  localDate,
} from "../core/math";
import { useStore } from "../core/store";
import type {
  FoodEntry,
  Nutrients,
  Product,
  Recipe,
  RecipeIngredient,
} from "../core/types";
import {
  Button,
  Confirm,
  DateNav,
  Empty,
  Field,
  IconButton,
  PageTitle,
  Ring,
  Segments,
  Sheet,
  useUI,
} from "../ui/UI";
import { GoalForm } from "./forms";
import { FoodLookup } from "./FoodLookup";
import { FoodPhotoAI } from './FoodPhotoAI';
import type { MealPhotoEstimate } from '../core/mealPhotoAI';
import { expandRecipe } from "../core/meals";
import { updateDaily } from "../core/db";
import { discoverFoods, productHistory } from "../core/foodDiscovery";
import { FoodThumb } from './FoodThumb';
import { FOOD_PHOTOS } from '../core/foodPhotos';
import { FoodImagePicker } from './FoodImagePicker';
import { foodCode } from '../core/foodCode';
import { WaterPanel } from './Water';

const MEALS = ["Śniadanie", "Obiad", "Kolacja", "Przekąski"];
export function Food({
  date,
  setDate,
}: {
  date: string;
  setDate: (d: string) => void;
}) {
  const { data, put, remove, reload } = useStore();
  const { show, run, toast } = useUI();
  const [view, setView] = useState<"diary" | "recipes">("diary");
  const totals = dayTotals(data.food, date);
  const planned = dayTotals(data.food, date, "planned");
  const goal = goalForDate(data.goals, date);
  const daily = data.daily.find((d) => d.date === date);
  return (
    <>
      <PageTitle title="Jedzenie" subtitle="Dziennik posiłków, woda i przepisy" />
      <Segments
        value={view}
        onChange={setView}
        options={[
          { value: "diary", label: "Dziennik" },
          { value: "recipes", label: "Moje przepisy" },
        ]}
      />
      {view === "diary" ? (
        <div className="food-diary">
          <div className="food-day-nav"><IconButton icon={ChevronLeft} label="Poprzedni dzień" onClick={()=>setDate(shiftDate(date,-1))}/><div><CalendarBlank size={18}/><DateNav date={date} onChange={setDate} label={dateLabel(date,{weekday:'short',day:'numeric',month:'short'})}/><small>{date===localDate()?'Dziś':date<localDate()?'Historia':'Plan'}</small></div><IconButton icon={ChevronRight} label="Następny dzień" onClick={()=>setDate(shiftDate(date,1))}/></div>
          <FoodNutritionCard
            totals={totals}
            goal={goal}
            plannedKcal={planned.kcal}
            onGoal={() => show(<GoalForm date={date} />)}
          />
          <WaterPanel date={date}/>
          {[
            ...new Set([
              ...MEALS,
              ...data.food.filter((e) => e.date === date).map((e) => e.meal),
            ]),
          ].map((meal) => {
            const entries = data.food.filter(
              (e) => e.date === date && e.meal === meal,
            );
            const plannedMeal = entries.filter(e=>e.status==='planned');
            return (
              <section className="card list-card meal" key={meal}>
                <div className="meal-title">
                  <span className="row-text"><h2>{meal}</h2><small><b>{fmt(dayTotals(entries, date).kcal)}</b> kcal{plannedMeal.length>0&&` · ${fmt(dayTotals(plannedMeal,date,'planned').kcal)} kcal plan`}</small></span>
                  <button className="round-btn primary" aria-label={`Dodaj do: ${meal}`} onClick={() => show(<AddFood date={date} meal={meal} />)}><Plus size={18}/></button>
                </div>
                {entries.length ? (
                  entries.map((entry) => (
                    <div
                      className={`food-entry ${entry.status === "planned" ? "planned" : ""}`}
                      key={entry.id}
                    >
                      <button
                        className="entry-main"
                        onClick={() => show(<EntryEditor entry={entry} />)}
                      >
                        <FoodThumb name={entry.name} product={data.products.find(p=>p.id===entry.productId)} photoKey={data.recipes.find(r=>r.id===entry.productId)?.photoKey} photoData={data.recipes.find(r=>r.id===entry.productId)?.photoData}/>
                        <span className="row-text">
                          <strong>{entry.name}</strong>
                          <small>
                            {entry.quick
                              ? "Szybkie kcal · bez makro"
                              : `${fmt(entry.grams, 1)} ${entry.unit}`}
                            {entry.brand ? ` · ${entry.brand}` : ""}
                            {entry.status === "planned" && <span className="tag info"><Clock size={12}/>Zaplanowane</span>}
                          </small>
                        </span>
                        <span className="row-value">
                          {fmt(
                            scaleNutrients(
                              entry.nutrients,
                              entry.quick ? 1 : entry.grams / 100,
                            ).kcal,
                          )}
                          <small> kcal</small>
                        </span>
                      </button>
                      {entry.status === "planned" && (
                        <IconButton
                          icon={Check}
                          label={`Potwierdź zjedzenie: ${entry.name}`}
                          onClick={() =>
                            void run(
                              () =>
                                put("food", {
                                  ...entry,
                                  status: "consumed",
                                  updatedAt: new Date().toISOString(),
                                }),
                              "Posiłek potwierdzony",
                            )
                          }
                        />
                      )}
                      <IconButton
                        icon={Trash2}
                        label={`Usuń: ${entry.name}`}
                        onClick={() =>
                          show(
                            <Confirm
                              title="Usunąć wpis?"
                              text={entry.name}
                              danger
                              confirm="Usuń wpis"
                              onConfirm={async () => {
                                await remove("food", entry.id);
                                toast("Wpis usunięty", () =>
                                  put("food", entry),
                                );
                              }}
                            />,
                          )
                        }
                      />
                    </div>
                  ))
                ) : (
                  <button
                    className="empty-meal"
                    onClick={() => show(<AddFood date={date} meal={meal} />)}
                  >
                    Brak wpisów - dotknij +, aby dodać.
                  </button>
                )}
              </section>
            );
          })}
          <div className="card list-card">
            <button className="list-row" onClick={() => show(<CopyDay date={date} />)}><span className="icon-bubble acc"><Copy size={20}/></span><span className="row-text"><strong>Kopiuj dzień</strong><small>Na inny dzień jako zjedzone lub plan</small></span><ChevronRight size={18}/></button>
            <div className="row-divider"/>
            <button className={`list-row daily-completion-card ${daily?.complete?'is-complete':''}`} role="switch" aria-checked={Boolean(daily?.complete)} onClick={() => void run(async () => { await updateDaily(date, { complete: !daily?.complete }); await reload(); })}>{daily?.complete&&<span className="burst" aria-hidden="true"/>}<span className="icon-bubble ok"><SealCheck size={22}/></span><span className="row-text"><strong>Dziennik pełny</strong><small>{daily?.complete ? "Oznaczony jako kompletny" : "Oznacz, gdy zapiszesz wszystkie posiłki"}</small></span><span className={`toggle ${daily?.complete?"on":""}`} aria-hidden="true"><span/></span></button>
          </div>
          <button className="pill-btn primary wide" aria-label="Dodaj posiłek" onClick={() => show(<AddFood date={date} />)}><span>Dodaj jedzenie</span><Plus size={19}/></button>
          <p className="muted small">
            Pusty lub niepotwierdzony dzień nie jest traktowany jako pełny zapis
            jedzenia. Zaplanowane posiłki nie wliczają się do bilansu.
          </p>
        </div>
      ) : (
        <div className="recipe-grid">
          {data.recipes.map((recipe, i) => (
            <div className="recipe-tile" key={recipe.id} style={{animationDelay:`${i*40}ms`}}>
              <button className="recipe-open" onClick={() => show(<RecipeEditor recipe={recipe} />)}>
                <span className="recipe-photo"><FoodThumb name={recipe.name} photoKey={recipe.photoKey} photoData={recipe.photoData}/></span>
                <span className="row-text"><strong>{recipe.name}</strong><small>{fmt(recipePer100(recipe.nutrients, recipe.cookedWeight).kcal)} kcal / 100 g · wersja {recipe.version}</small></span>
              </button>
              <div className="recipe-actions">
                <button className="pill-btn soft small" aria-label={`Dodaj przepis ${recipe.name} do dziennika`} onClick={() => show(<AddFood date={date} initialRecipe={recipe} />)}><Plus size={15}/>Porcja</button>
                <button className="pill-btn sunk small recipe-ingredients-button" aria-label="Dodaj składniki osobno" onClick={() => show(<RecipeIngredients recipe={recipe} date={date} />)}><Copy size={15}/>Składniki</button>
              </div>
            </div>
          ))}
          <button className="recipe-new" onClick={() => show(<RecipeEditor />)}><span className="round-btn primary big"><Plus size={22}/></span><strong>{data.recipes.length ? 'Nowy przepis' : 'Utwórz pierwszy przepis'}</strong>{!data.recipes.length&&<small>Dodaj składniki i masę po przygotowaniu. Kolejny posiłek zapiszesz samą gramaturą.</small>}</button>
        </div>
      )}
    </>
  );
}

function FoodNutritionCard({totals,goal,plannedKcal,onGoal}:{totals:Nutrients;goal:ReturnType<typeof goalForDate>;plannedKcal:number;onGoal:()=>void}) {
  const macros=[{key:'protein',label:'Białko',Icon:Fish},{key:'fat',label:'Tłuszcz',Icon:Droplet},{key:'carbs',label:'Węgle',Icon:Grains}] as const;
  const progress=goal?.kcal?Math.min(100,totals.kcal/goal.kcal*100):0,over=Boolean(goal&&totals.kcal>goal.kcal);
  return <section className="card food-nutrition" aria-label="Bilans kalorii">
    <div className="kcal-row"><div className="kcal-main"><Ring value={goal?.kcal?totals.kcal/goal.kcal:0} color={over?'var(--err)':'var(--hot)'}><Fire size={22} className="flicker"/></Ring><div><strong className="kcal-number">{fmt(totals.kcal)}</strong>{goal?<span className="kcal-goal">/ {fmt(goal.kcal)} kcal · {fmt(Math.abs(goal.kcal-totals.kcal))} {over?'ponad cel':'do celu'}</span>:<button className="text-action" onClick={onGoal}>Ustaw cel kalorii</button>}</div></div></div>
    <div className="food-calorie-track" role="progressbar" aria-label="Realizacja celu kalorii" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress)}><i className={over?'over':''} style={{width:`${progress}%`}}/></div>
    {plannedKcal>0&&<small className="food-nutrition-note info"><Clock size={14}/>Zaplanowane osobno: {fmt(plannedKcal)} kcal</small>}
    <div className="food-macros">{macros.map(({key,label,Icon})=><div className={`food-macro food-macro-${key}`} key={key}><span><Icon size={13}/>{label}</span><p><strong>{totals[key]===null?'-':fmt(totals[key]!,0)}</strong>{goal?.[key]!=null?<small> / {fmt(goal[key]!,0)} g</small>:<small> g</small>}</p><div className="food-macro-track"><i style={{width:`${goal?.[key]&&totals[key]!=null?Math.min(100,totals[key]!/goal[key]!*100):0}%`}}/></div></div>)}</div>
    {Object.values(totals).some(v=>v===null)&&<small className="food-nutrition-note"><Warning size={13}/>Część produktów nie ma pełnych danych o makroskładnikach.</small>}
  </section>;
}

export function AddFood({
  date,
  meal: initialMeal = "Śniadanie",
  initialRecipe,
  initialBarcode,
}: {
  date: string;
  meal?: string;
  initialRecipe?: Recipe;
  initialBarcode?: string;
}) {
  const { data, put, remove, busy } = useStore();
  const { run, close, show, toast } = useUI();
  const [tab, setTab] = useState<"search" | "quick" | "photo">("search");
  const [search, setSearch] = useState(initialBarcode??"");
  const [selected, setSelected] = useState<Product | Recipe | null>(
    initialRecipe ?? null,
  );
  const [grams, setGrams] = useState("100");
  const [meal, setMeal] = useState(initialMeal);
  const [status, setStatus] = useState<FoodEntry["status"]>(date>localDate()?"planned":"consumed");
  const [creating, setCreating] = useState(false);
  const [quickName, setQuickName] = useState("Szybki wpis");
  const [quickKcal, setQuickKcal] = useState("");
  const isRecipe = selected && "cookedWeight" in selected;
  const nutrients = selected
    ? isRecipe
      ? recipePer100(
          (selected as Recipe).nutrients,
          (selected as Recipe).cookedWeight,
        )
      : (selected as Product)
    : emptyNutrients();
  const amount = numberInput(grams);
  const preview = scaleNutrients(
    nutrients,
    Number.isFinite(amount) && amount >= 0 ? amount / 100 : 0,
  );
  const today = localDate();
  const history = useMemo(() => productHistory(data.food, today), [data.food, today]);
  const previousPortion = selected && !isRecipe ? history.get(selected.id)?.latest : undefined;
  return (
    <Sheet
      title={
        creating
          ? "Własny produkt"
          : selected
            ? "Dodaj porcję"
            : "Dodaj jedzenie"
      }
      wide
    >
      <p className="food-entry-context">{dateLabel(date,{weekday:'long',day:'numeric',month:'long',year:'numeric'})} · {meal}</p>
      {creating ? (
        <ProductFields
          product={
            selected && !("cookedWeight" in selected) ? selected : undefined
          }
          onSaved={(p) => {
            setSelected(p);
            setCreating(false);
          }}
        />
      ) : selected ? (
        <>
          <Button variant="ghost" onClick={() => setSelected(null)}>
            <ArrowLeft size={17} />
            Wybierz inny produkt
          </Button>
          <div className="selected-food-heading"><FoodThumb name={selected.name} product={isRecipe?undefined:selected as Product} photoKey={isRecipe?(selected as Recipe).photoKey:undefined} photoData={isRecipe?(selected as Recipe).photoData:undefined}/><h3 className="selected-product">{selected.name}</h3></div>
          <p className="muted small">
            {isRecipe
              ? `Przepis v${(selected as Recipe).version} · po przygotowaniu`
              : (selected as Product).source}
          </p>
          {!isRecipe && (selected as Product).originalName && <details className="source-detail"><summary>Skład i dokładność</summary><p>{(selected as Product).originalName}</p><p>Domowy przepis może mieć inne proporcje. Jeśli znasz skład, zapisz własny przepis z dokładnymi ilościami.</p>{(selected as Product).sourceUrl?.startsWith('https://fdc.nal.usda.gov/food-details/') && <a href={(selected as Product).sourceUrl} target="_blank" rel="noreferrer">Zobacz rekord USDA</a>}</details>}
          {isRecipe && (
            <Button
              variant="secondary"
              onClick={() =>
                show(
                  <RecipeIngredients
                    recipe={selected as Recipe}
                    date={date}
                    initialMeal={meal}
                    initialStatus={status}
                  />,
                )
              }
            >
              <Copy size={17} />
              Dodaj jako osobne składniki
            </Button>
          )}
          {!isRecipe && (
            <>
              {(selected as Product).barcode && (
                <p className="muted small">
                  Kod: {(selected as Product).barcode} · podstawa: 100{" "}
                  {(selected as Product).unit}
                </p>
              )}
              {(selected as Product).fetchedAt && (
                <p className="muted small">
                  Pobrano:{" "}
                  {new Date(
                    (selected as Product).fetchedAt!,
                  ).toLocaleDateString("pl-PL")}
                </p>
              )}
              {(selected as Product).sourceUrl &&
                /^\d{8,14}$/.test((selected as Product).barcode) && (
                  <p className="muted small">
                    <a
                      href={`https://world.openfoodfacts.org/product/${(selected as Product).barcode}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Zobacz źródło i etykietę
                    </a>{" "}
                    · dane społecznościowe, sprawdź opakowanie
                  </p>
                )}
              <Button variant="ghost" onClick={() => setCreating(true)}>
                Popraw dane lub zdjęcie
              </Button>
              {(selected as Product).servingGrams && (
                <Button
                  variant="secondary"
                  onClick={() =>
                    setGrams(String((selected as Product).servingGrams))
                  }
                >
                  {(selected as Product).servingSize || 'Porcja z etykiety'} · {fmt((selected as Product).servingGrams!)}{" "}
                  {(selected as Product).unit}
                </Button>
              )}
              {previousPortion && previousPortion.unit === (selected as Product).unit && (
                <Button variant="secondary" onClick={() => setGrams(String(previousPortion.grams))}>
                  Ostatnia porcja · {fmt(previousPortion.grams, 1)} {previousPortion.unit}
                </Button>
              )}
            </>
          )}
          <Field
            label={`Porcja · ${isRecipe ? "g" : (selected as Product).unit}`}
          >
            <input
              autoFocus
              inputMode="decimal"
              value={grams}
              onChange={(e) => setGrams(e.target.value)}
            />
          </Field>
          <div className="portion-shortcuts">{[50,100,150,200,250].map(n=><button key={n} onClick={()=>setGrams(String(n))}>{n} {isRecipe?'g':(selected as Product).unit}</button>)}</div>
          <PortionPreview nutrients={preview} />
          <MealFields
            meal={meal}
            setMeal={setMeal}
            status={status}
            setStatus={setStatus}
          />
          <Button
            className="full"
            disabled={busy}
            onClick={() =>
              void run(
                async () => {
                  const quantity = positiveInput(grams, 10000);
                  const entry:FoodEntry = {
                    ...stamp(),
                    date,
                    meal,
                    name: selected.name,
                    brand: isRecipe
                      ? "Po przygotowaniu"
                      : (selected as Product).brand,
                    productId: selected.id,
                    recipeVersion: isRecipe
                      ? (selected as Recipe).version
                      : null,
                    grams: quantity,
                    unit: isRecipe ? "g" : (selected as Product).unit,
                    nutrients: {
                      kcal: nutrients.kcal,
                      protein: nutrients.protein,
                      fat: nutrients.fat,
                      carbs: nutrients.carbs,
                    },
                    status,
                    quick: false,
                  };
                  if (!isRecipe && !data.products.some(item => item.id === selected.id)) await put('products', selected as Product);
                  await put('food',entry);
                  close();
                  toast(status==='consumed'?'Dodano do dziennika':'Posiłek zaplanowany',()=>remove('food',entry.id));
                },
              )
            }
          >
            <Plus size={19} />
            {status === "consumed" ? "Dodaj do dziennika" : "Zapisz jako plan"}
          </Button>
        </>
      ) : (
        <>
          {tab === "search" ? (
            <FoodLookup
              initialCode={initialBarcode}
              query={search}
              setQuery={setSearch}
              meal={meal}
              history={history}
              onCreate={() => setCreating(true)}
              onQuick={() => setTab('quick')}
              onPhoto={() => setTab('photo')}
              selectRecipe={(recipe) => { setSelected(recipe); setGrams('100'); }}
              select={async (product) => {
                if (!data.products.some(item => item.id === product.id)) await put('products', product);
                setSelected(product);
                setGrams(String(product.servingGrams ?? 100));
              }}
            />
          ) : tab === 'photo' ? (
            <FoodPhotoAI onBack={() => setTab('search')} onUse={(result: MealPhotoEstimate, values) => {
              const factor = 100 / values.grams;
              const product: Product = {
                ...stamp(), name: values.name, brand: 'Szacunek AI', unit: 'g', barcode: '', favorite: false,
                source: 'AI - szacunek ze zdjęcia', originalName: `${result.components.map(part => `${part.name} ~${part.grams} g`).join(', ')}. ${result.uncertainty}`,
                kind: 'dish', servingSize: 'porcja ze zdjęcia', servingGrams: values.grams,
                kcal: Math.round(values.kcal * factor * 10) / 10,
                protein: result.protein === null ? null : Math.round(result.protein * factor * 10) / 10,
                fat: result.fat === null ? null : Math.round(result.fat * factor * 10) / 10,
                carbs: result.carbs === null ? null : Math.round(result.carbs * factor * 10) / 10,
              };
              setSelected(product); setGrams(String(values.grams)); setTab('search');
            }} onUseCatalog={(product, weight) => {setSelected(product);setGrams(String(weight));setTab('search');}}/>
          ) : (
            <>
              <Button variant="ghost" onClick={() => setTab('search')}><ArrowLeft size={17}/>Wróć do wyszukiwania</Button>
              <p className="muted">
                Gdy znasz tylko kalorie. Makro zostanie oznaczone jako niepełne.
              </p>
              <Field label="Nazwa">
                <input
                  maxLength={100}
                  value={quickName}
                  onChange={(e) => setQuickName(e.target.value)}
                />
              </Field>
              <Field label="Energia · kcal">
                <input
                  inputMode="decimal"
                  value={quickKcal}
                  onChange={(e) => setQuickKcal(e.target.value)}
                />
              </Field>
              <MealFields
                meal={meal}
                setMeal={setMeal}
                status={status}
                setStatus={setStatus}
              />
              <Button
                className="full"
                disabled={busy}
                onClick={() =>
                  void run(async () => {
                    const entry:FoodEntry = {
                      ...stamp(),
                      date,
                      meal,
                      name: quickName.trim() || "Szybki wpis",
                      brand: "",
                      productId: null,
                      recipeVersion: null,
                      grams: 1,
                      unit: "porcja",
                      nutrients: {
                        kcal: positiveInput(quickKcal, 15000),
                        protein: null,
                        fat: null,
                        carbs: null,
                      },
                      status,
                      quick: true,
                    };
                    await put('food',entry);
                    close();
                    toast('Wpis zapisany',()=>remove('food',entry.id));
                  })
                }
              >
                Zapisz kalorie
                <Check size={18} />
              </Button>
            </>
          )}
        </>
      )}
    </Sheet>
  );
}
function RecipeIngredients({
  recipe,
  date,
  initialMeal = "Śniadanie",
  initialStatus = "consumed",
}: {
  recipe: Recipe;
  date: string;
  initialMeal?: string;
  initialStatus?: FoodEntry["status"];
}) {
  const { mutate, busy } = useStore();
  const { run, close, toast } = useUI();
  const saving = useRef(false);
  const [amounts, setAmounts] = useState(
    recipe.ingredients.map((i) => String(i.grams)),
  );
  const [meal, setMeal] = useState(initialMeal);
  const [status, setStatus] = useState(initialStatus);
  const ingredients = recipe.ingredients.map((i, index) => ({
    ...i,
    grams:
      Number.isFinite(numberInput(amounts[index])) &&
      numberInput(amounts[index]) >= 0
        ? numberInput(amounts[index])
        : 0,
  }));
  const total = recipeTotals(ingredients);
  return (
    <Sheet title={`${recipe.name} · składniki`} wide>
      <p className="muted">
        Dodaj swój stały zestaw. Popraw ilości lub wpisz 0, aby pominąć
        składnik. Każdy produkt będzie osobnym wpisem.
      </p>
      {recipe.ingredients.map((i, index) => (
        <div className="ingredient-portion" key={index}>
          <Field label={`${i.name} · ${i.unit}`}>
            <input
              inputMode="decimal"
              maxLength={12}
              value={amounts[index]}
              onChange={(e) =>
                setAmounts((values) =>
                  values.map((v, n) => (n === index ? e.target.value : v)),
                )
              }
            />
          </Field>
          <small className="muted">
            {fmt(
              scaleNutrients(i.nutrients, ingredients[index].grams / 100).kcal,
            )}{" "}
            kcal
          </small>
        </div>
      ))}
      <PortionPreview nutrients={total} />
      <MealFields
        meal={meal}
        setMeal={setMeal}
        status={status}
        setStatus={setStatus}
      />
      <Button
        className="full"
        disabled={busy}
        onClick={() => {
          if (saving.current) return;
          saving.current = true;
          void run(async () => {
            const entries = expandRecipe(
              recipe,
              amounts.map(numberInput),
              date,
              meal,
              status,
            );
            await mutate(entries.map((value) => ({ table: "food", value })));
            close();
            toast(
              `Dodano ${entries.length} ${plural(entries.length, "składnik", "składniki", "składników")}`,
              () =>
                mutate(entries.map((e) => ({ table: "food", remove: e.id }))),
            );
          }).finally(() => {
            saving.current = false;
          });
        }}
      >
        <Plus size={18} />
        {status === "planned"
          ? "Zaplanuj składniki"
          : "Dodaj składniki do dziennika"}
      </Button>
      <p className="small muted">
        Używamy wartości zapisanych w przepisie v{recipe.version}. Nie dodajemy
        drugi raz gotowego dania.
      </p>
    </Sheet>
  );
}

function MealFields({
  meal,
  setMeal,
  status,
  setStatus,
}: {
  meal: string;
  setMeal: (s: string) => void;
  status: FoodEntry["status"];
  setStatus: (s: FoodEntry["status"]) => void;
}) {
  return (
    <div className="form-grid">
      <Field label="Posiłek">
        <select value={meal} onChange={(e) => setMeal(e.target.value)}>
          {[...new Set([...MEALS, meal])].map((m) => (
            <option key={m}>{m}</option>
          ))}
        </select>
      </Field>
      <Field label="Status">
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as FoodEntry["status"])}
        >
          <option value="consumed">Zjedzone</option>
          <option value="planned">Zaplanowane</option>
        </select>
      </Field>
    </div>
  );
}
function PortionPreview({ nutrients: n }: { nutrients: Nutrients }) {
  return (
    <div className="portion-preview">
      <strong>
        {fmt(n.kcal)} <span>kcal</span>
      </strong>
      <p>
        B {n.protein === null ? "-" : fmt(n.protein, 1)} g · T{" "}
        {n.fat === null ? "-" : fmt(n.fat, 1)} g · W{" "}
        {n.carbs === null ? "-" : fmt(n.carbs, 1)} g
      </p>
    </div>
  );
}

function ProductFields({
  product,
  onSaved,
}: {
  product?: Product;
  onSaved: (p: Product) => void;
}) {
  const { put, busy } = useStore();
  const { run } = useUI();
  const [name, setName] = useState(product?.name ?? "");
  const [photoData, setPhotoData] = useState(product?.photoData);
  const [photoBusy,setPhotoBusy]=useState(false);
  const [brand, setBrand] = useState(product?.brand ?? "");
  const [barcode, setBarcode] = useState(product?.barcode ?? "");
  const [unit, setUnit] = useState<Product["unit"]>(product?.unit ?? "g");
  const [kcal, setKcal] = useState(product ? String(product.kcal) : "");
  const [protein, setProtein] = useState(
    product?.protein !== null && product ? String(product.protein) : "",
  );
  const [fat, setFat] = useState(
    product?.fat !== null && product ? String(product.fat) : "",
  );
  const [carbs, setCarbs] = useState(
    product?.carbs !== null && product ? String(product.carbs) : "",
  );
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if(photoBusy)return;
        void run(async () => {
          const optional = (s: string) => {
            if (!s.trim()) return null;
            const n = numberInput(s);
            if (!Number.isFinite(n) || n < 0 || n > (unit === "ml" ? 150 : 100))
              throw new Error("Sprawdź wartości odżywcze.");
            return n;
          };
          const energy = numberInput(kcal);
          if (!Number.isFinite(energy) || energy < 0 || energy > 1000)
            throw new Error("Podaj prawidłową energię na 100 g lub ml.");
          const p: Product = {
            ...stamp(product?.id),
            name: name.trim(),
            brand: brand.trim(),
            barcode: barcode.trim()?foodCode(barcode):'',
            ...(photoData?{photoData}:{}),
            unit,
            kcal: energy,
            protein: optional(protein),
            fat: optional(fat),
            carbs: optional(carbs),
            favorite: product?.favorite ?? false,
            source: "Własny produkt · dane z etykiety",
          };
          await put("products", p);
          onSaved(p);
        }, "Produkt zapisany");
      }}
    >
      <Field label="Nazwa produktu">
        <input
          required
          maxLength={100}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </Field>
      <Field label="Marka · opcjonalnie">
        <input
          maxLength={60}
          value={brand}
          onChange={(e) => setBrand(e.target.value)}
        />
      </Field>
      <FoodImagePicker value={photoData} onChange={setPhotoData} onBusyChange={setPhotoBusy}/>
      <div className="form-grid">
        <Field label="Podstawa wartości">
          <select
            value={unit}
            onChange={(e) => setUnit(e.target.value as Product["unit"])}
          >
            <option value="g">Na 100 g</option>
            <option value="ml">Na 100 ml</option>
          </select>
        </Field>
        <Field label="Energia · kcal">
          <input
            required
            inputMode="decimal"
            value={kcal}
            onChange={(e) => setKcal(e.target.value)}
          />
        </Field>
      </div>
      <div className="form-grid three">
        <Field label="Białko · g">
          <input
            inputMode="decimal"
            value={protein}
            onChange={(e) => setProtein(e.target.value)}
          />
        </Field>
        <Field label="Tłuszcze · g">
          <input
            inputMode="decimal"
            value={fat}
            onChange={(e) => setFat(e.target.value)}
          />
        </Field>
        <Field label="Węglow. · g">
          <input
            inputMode="decimal"
            value={carbs}
            onChange={(e) => setCarbs(e.target.value)}
          />
        </Field>
      </div>
      <Field label="Kod kreskowy · opcjonalnie">
        <input
          inputMode="numeric"
          maxLength={30}
          value={barcode}
          onChange={(e) => setBarcode(e.target.value)}
        />
      </Field>
      <p className="small muted">
        Brakujące makro zostaw puste. Zero oznacza potwierdzony brak danego
        składnika.
      </p>
      <Button type="submit" className="full" disabled={busy||photoBusy}>
        Zapisz produkt <Check size={19} />
      </Button>
    </form>
  );
}

export function EntryEditor({ entry }: { entry: FoodEntry }) {
  const { put, busy } = useStore();
  const { run, close } = useUI();
  const [grams, setGrams] = useState(String(entry.grams));
  const [kcal, setKcal] = useState(String(entry.nutrients.kcal));
  const [meal, setMeal] = useState(entry.meal);
  const [status, setStatus] = useState(entry.status);
  const [date, setDate] = useState(entry.date);
  return (
    <Sheet title="Edytuj wpis">
      <h3>{entry.name}</h3>
      <Field label={entry.quick ? "Energia · kcal" : `Porcja · ${entry.unit}`}>
        <input
          inputMode="decimal"
          value={entry.quick ? kcal : grams}
          onChange={(e) =>
            entry.quick ? setKcal(e.target.value) : setGrams(e.target.value)
          }
        />
      </Field>
      <MealFields
        meal={meal}
        setMeal={setMeal}
        status={status}
        setStatus={setStatus}
      />
      <Field label="Data">
        <input
          type="date"
          required
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />
      </Field>
      <Button
        className="full"
        disabled={busy}
        onClick={() =>
          void run(async () => {
            if (!date) throw new Error("Wybierz datę.");
            await put("food", {
              ...entry,
              date,
              meal,
              status,
              grams: entry.quick ? 1 : positiveInput(grams, 10000),
              nutrients: entry.quick
                ? { ...entry.nutrients, kcal: positiveInput(kcal, 15000) }
                : entry.nutrients,
              updatedAt: new Date().toISOString(),
            });
            close();
          }, "Wpis poprawiony")
        }
      >
        Zapisz zmianę
        <Check size={19} />
      </Button>
    </Sheet>
  );
}

function CopyDay({ date }: { date: string }) {
  const { data, mutate, busy } = useStore();
  const { run, close } = useUI();
  const [source, setSource] = useState(shiftDate(date, -1));
  const [status, setStatus] = useState<FoodEntry["status"]>("planned");
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [excluded, setExcluded] = useState<string[]>([]);
  const entries = data.food.filter((e) => e.date === source);
  return (
    <Sheet title="Kopiuj dzień jedzenia">
      <Field label="Skopiuj z dnia">
        <input
          type="date"
          value={source}
          onChange={(e) => {
            setSource(e.target.value);
            setAmounts({});
            setExcluded([]);
          }}
        />
      </Field>
      <p className="muted small">
        Sprawdź porcje przed zapisem. Kopia jest domyślnie planem, dopóki nie
        potwierdzisz zjedzenia.
      </p>
      {entries
        .filter((e) => !excluded.includes(e.id))
        .map((e) => (
          <div className="copy-entry" key={e.id}>
            <span>
              <strong>{e.name}</strong>
              <small>{e.meal}</small>
            </span>
            {!e.quick && (
              <input
                aria-label={`Porcja ${e.name}`}
                inputMode="decimal"
                value={amounts[e.id] ?? String(e.grams)}
                onChange={(ev) =>
                  setAmounts((v) => ({ ...v, [e.id]: ev.target.value }))
                }
              />
            )}
            <small>{e.quick ? "kcal" : e.unit}</small>
            <IconButton
              icon={X}
              label={`Pomiń ${e.name}`}
              onClick={() => setExcluded((v) => [...v, e.id])}
            />
          </div>
        ))}
      {!entries.length && (
        <Empty
          icon={Copy}
          title="W tym dniu nie ma wpisów"
          text="Wybierz inny dzień."
        />
      )}
      <Field label="Zapisz jako">
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as FoodEntry["status"])}
        >
          <option value="planned">Zaplanowane</option>
          <option value="consumed">Potwierdzam zjedzenie</option>
        </select>
      </Field>
      <Button
        className="full"
        disabled={busy || !entries.length}
        onClick={() =>
          void run(async () => {
            const included = entries.filter((e) => !excluded.includes(e.id));
            if (!included.length)
              throw new Error("Wybierz co najmniej jeden wpis.");
            await mutate(
              included.map((entry) => ({
                table: "food",
                value: {
                  ...entry,
                  ...stamp(),
                  date,
                  status,
                  grams: entry.quick
                    ? 1
                    : positiveInput(
                        amounts[entry.id] ?? String(entry.grams),
                        10000,
                      ),
                },
              })),
            );
            close();
          }, "Dzień skopiowany")
        }
      >
        Skopiuj na {dateLabel(date, { day: "numeric", month: "short" })}
        <Copy size={18} />
      </Button>
    </Sheet>
  );
}

function RecipeEditor({ recipe }: { recipe?: Recipe }) {
  const { data, put, remove, busy } = useStore();
  const { run, close, show } = useUI();
  const [name, setName] = useState(recipe?.name ?? "");
  const [photoKey, setPhotoKey] = useState<number|undefined>(recipe?.photoKey);
  const [photoData, setPhotoData] = useState(recipe?.photoData);
  const [photoBusy,setPhotoBusy]=useState(false);
  const [weight, setWeight] = useState(
    recipe ? String(recipe.cookedWeight) : "",
  );
  const [ingredients, setIngredients] = useState<RecipeIngredient[]>(
    recipe?.ingredients ?? [],
  );
  const [productId, setProductId] = useState("");
  const [ingredientSearch,setIngredientSearch]=useState("");
  const ingredientChoices=useMemo(()=>{const rows=discoverFoods(data.products,new Map(),'all',ingredientSearch).slice(0,80);const selected=data.products.find(p=>p.id===productId);return selected&&!rows.some(p=>p.id===selected.id)?[selected,...rows]:rows;},[data.products,ingredientSearch,productId]);
  const [grams, setGrams] = useState("");
  const total = recipeTotals(ingredients);
  const add = () => {
    void run(async () => {
      const p = data.products.find((p) => p.id === productId);
      if (!p) throw new Error("Wybierz składnik.");
      const amount = positiveInput(grams, 20000);
      setIngredients((v) => [
        ...v,
        {
          productId: p.id,
          name: p.name,
          unit: p.unit,
          grams: amount,
          nutrients: {
            kcal: p.kcal,
            protein: p.protein,
            fat: p.fat,
            carbs: p.carbs,
          },
        },
      ]);
      setGrams("");
    });
  };
  return (
    <Sheet title={recipe ? "Edytuj przepis" : "Nowy przepis"} wide>
      <Field label="Nazwa dania">
        <input
          maxLength={100}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </Field>
      <h3 className="subheading">Składniki przed przygotowaniem</h3>
      <div className="recipe-photo-picker"><FoodThumb name={name} photoKey={photoKey} photoData={photoData}/><Field label="Obraz dania" hint="Wybierz tylko pasujący obraz poglądowy. Składniki nie wyznaczają wyglądu gotowego dania."><select value={photoKey??''} onChange={e=>setPhotoKey(e.target.value===''?undefined:Number(e.target.value))}><option value="">Bez zdjęcia</option>{FOOD_PHOTOS.map((label,i)=><option key={i} value={i}>{label}</option>)}</select></Field></div>
      <FoodImagePicker value={photoData} onChange={setPhotoData} onBusyChange={setPhotoBusy}/>
      {ingredients.map((i, index) => (
        <div className="copy-entry" key={index}>
          <span>
            <strong>{i.name}</strong>
            <small>
              {fmt(i.grams)} {i.unit} ·{" "}
              {fmt(scaleNutrients(i.nutrients, i.grams / 100).kcal)} kcal
            </small>
          </span>
          <IconButton
            icon={Trash2}
            label={`Usuń składnik ${i.name}`}
            onClick={() =>
              setIngredients((v) => v.filter((_, n) => n !== index))
            }
          />
        </div>
      ))}
      <Field label="Szukaj składnika"><input aria-label="Szukaj składnika przepisu" placeholder="np. jajko, ryż, jogurt…" value={ingredientSearch} onChange={e=>setIngredientSearch(e.target.value)}/></Field>
      <Field label="Produkt">
        <select
          value={productId}
          onChange={(e) => setProductId(e.target.value)}
        >
          <option value="">Wybierz składnik</option>
          {ingredientChoices.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
              {p.brand ? ` · ${p.brand}` : ""} · {p.unit}
            </option>
          ))}
        </select>
      </Field>
      <div className="ingredient-add">
        <Field label="Ilość · g lub ml produktu">
          <input
            inputMode="decimal"
            value={grams}
            onChange={(e) => setGrams(e.target.value)}
          />
        </Field>
        <Button variant="secondary" onClick={add}>
          <Plus size={19} />
          Dodaj
        </Button>
      </div>
      <Field
        label="Masa całej potrawy po przygotowaniu · g"
        hint="Odparowanie zmienia masę, ale nie sumę kalorii składników."
      >
        <input
          inputMode="decimal"
          value={weight}
          onChange={(e) => setWeight(e.target.value)}
        />
      </Field>
      <div className="portion-preview">
        <strong>
          {fmt(total.kcal)} <span>kcal w całym daniu</span>
        </strong>
        {numberInput(weight) > 0 && (
          <p>
            {fmt(recipePer100(total, numberInput(weight)).kcal)} kcal / 100 g po
            przygotowaniu
          </p>
        )}
      </div>
      <Button
        className="full"
        disabled={busy||photoBusy}
        onClick={() =>
          void run(async () => {
            if(photoBusy)return;
            if (!name.trim() || !ingredients.length)
              throw new Error("Podaj nazwę i dodaj składniki.");
            await put("recipes", {
              ...stamp(recipe?.id),
              name: name.trim(),
              ...(photoKey !== undefined ? {photoKey} : {}),
              ...(photoData ? {photoData} : {}),
              version: (recipe?.version ?? 0) + 1,
              cookedWeight: positiveInput(weight, 50000),
              ingredients,
              nutrients: total,
            });
            close();
          }, "Przepis zapisany")
        }
      >
        Zapisz {recipe ? `wersję ${recipe.version + 1}` : "przepis"}
        <Check size={19} />
      </Button>
      <p className="muted small">
        Zmiana przepisu nie zmieni wcześniejszych wpisów w dzienniku.
      </p>
      {recipe && (
        <Button
          variant="ghost"
          className="full danger-text"
          onClick={() =>
            show(
              <Confirm
                title="Usunąć przepis?"
                text="Wcześniejsze posiłki zachowają swoje składniki i kaloryczność."
                danger
                confirm="Usuń przepis"
                onConfirm={() => remove("recipes", recipe.id)}
              />,
            )
          }
        >
          <Trash2 size={16} />
          Usuń przepis
        </Button>
      )}
    </Sheet>
  );
}
