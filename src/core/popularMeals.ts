import foods from '../data/foods-usda.json';
import type { Product, Nutrients } from './types';

type MealTime = 'breakfast' | 'lunch' | 'dinner';
type Ingredient = [id: string, grams: number];
const byId = new Map((foods as Product[]).map(p => [p.id, p]));
const updatedAt = '2026-10-27T00:00:00.000Z';

function alias(id: string, name: string, time: MealTime[], portion: number, searchTerms = '', photoKey?: number): Product {
  const original = byId.get(`usda-${id}`);
  if (!original) throw new Error(`Missing FNDDS food ${id}`);
  return {
    ...original,
    id: `meal-${id}`,
    name,
    brand: 'Danie orientacyjne',
    source: 'USDA FNDDS 2021-2023',
    originalName: `Przykładowe danie z bazy USDA FNDDS. Wartości dotyczą wariantu o tej nazwie; skład Twojej porcji może się różnić.`,
    searchTerms: `${name} ${searchTerms}`,
    servingSize: 'typowa porcja',
    servingGrams: portion,
    photoKey,
    kind: 'dish',
    tags: time,
  };
}

function composed(id: string, name: string, time: MealTime[], ingredients: Ingredient[], searchTerms = '', photoKey?: number): Product {
  const weight = ingredients.reduce((sum, [, grams]) => sum + grams, 0);
  const totals: Nutrients = { kcal: 0, protein: 0, fat: 0, carbs: 0 };
  for (const [foodId, grams] of ingredients) {
    const p = byId.get(`usda-${foodId}`);
    if (!p) throw new Error(`Missing FNDDS ingredient ${foodId}`);
    totals.kcal += p.kcal * grams / 100;
    for (const key of ['protein', 'fat', 'carbs'] as const) {
      totals[key] = totals[key] === null || p[key] === null ? null : totals[key]! + p[key]! * grams / 100;
    }
  }
  const per100 = (value: number | null) => value === null ? null : Math.round(value * 100 / weight * 10) / 10;
  const description = ingredients.map(([foodId, grams]) => `${byId.get(`usda-${foodId}`)!.name} ${grams} g`).join('; ');
  return {
    id: `meal-${id}`, schemaVersion: 1, updatedAt, name, brand: 'Danie orientacyjne',
    kcal: Math.round(totals.kcal * 100 / weight), protein: per100(totals.protein), fat: per100(totals.fat), carbs: per100(totals.carbs),
    unit: 'g', barcode: '', favorite: false, source: 'Szacunek ze składników USDA FNDDS 2021-2023',
    originalName: `Przykładowy skład porcji: ${description}. Zmień gramaturę, jeśli Twoja porcja jest inna.`,
    searchTerms: `${name} ${searchTerms}`, servingSize: 'przykładowa porcja', servingGrams: weight,
    photoKey, kind: 'dish', tags: time,
  };
}

// Named everyday meals are presented separately from branded products. Their
// portion and ingredients are explicit so users can adjust quantities instead
// of treating a generic recipe as the nutrition label of their own cooking.
export const POPULAR_MEALS: Product[] = [
  composed('tosty-szynka-ser', 'Tosty z szynką i serem', ['breakfast', 'dinner'], [['2707598', 60], ['2705878', 30], ['2705709', 30], ['2710154', 5]], 'tost kanapka grzanka szynka ser cheese ham'),
  alias('2707201', 'Jajecznica na maśle', ['breakfast', 'dinner'], 150, 'jaja jajka scrambled eggs', 0),
  alias('2707205', 'Jajecznica bez tłuszczu', ['breakfast', 'dinner'], 150, 'jaja jajka', 0),
  alias('2707209', 'Omlet z serem', ['breakfast', 'dinner'], 170, 'jajka śniadanie', 1),
  alias('2708383', 'Owsianka na mleku', ['breakfast'], 250, 'płatki owsiane oatmeal', 5),
  composed('owsianka-banan', 'Owsianka z bananem', ['breakfast'], [['2708383', 250], ['2709224', 100]], 'płatki owsiane', 138),
  alias('2708331', 'Tosty francuskie', ['breakfast'], 150, 'chleb w jajku french toast'),
  alias('2705801', 'Tosty z serem', ['breakfast', 'dinner'], 120, 'grzanki kanapka grilled cheese', 59),
  alias('2705794', 'Kanapka z serem', ['breakfast', 'dinner'], 120, 'chleb bułka', 59),
  composed('kanapka-szynka-ser', 'Kanapka z szynką i serem', ['breakfast', 'dinner'], [['2707598', 70], ['2705878', 35], ['2705709', 25]], 'chleb bułka tost', 59),
  alias('2708294', 'Placuszki śniadaniowe', ['breakfast'], 160, 'pancakes placki', 14),
  composed('jogurt-banan', 'Jogurt naturalny z bananem', ['breakfast', 'dinner'], [['2705417', 200], ['2709224', 100]], 'śniadanie przekąska'),
  composed('jajka-kanapka', 'Kanapki z jajkiem', ['breakfast', 'dinner'], [['2707598', 70], ['2707153', 100], ['2709719', 50]], 'jajko chleb pomidor'),
  alias('2708750', 'Lasagne z mięsem', ['lunch', 'dinner'], 300, 'makaron zapiekanka'),
  alias('2708831', 'Makaron z sosem pomidorowym', ['lunch', 'dinner'], 300, 'pasta spaghetti domowy', 122),
  composed('makaron-kurczak', 'Makaron z kurczakiem i pomidorami', ['lunch', 'dinner'], [['2708357', 200], ['2705958', 140], ['2709719', 100]], 'pasta obiad'),
  composed('kurczak-ryz', 'Kurczak z ryżem i brokułem', ['lunch', 'dinner'], [['2705958', 150], ['2708402', 180], ['2709645', 120]], 'pierś kurczaka ryż obiad'),
  composed('kurczak-ziemniaki', 'Kurczak z ziemniakami', ['lunch', 'dinner'], [['2705958', 150], ['2709383', 220], ['2709645', 100]], 'pierś kurczaka obiad'),
  composed('losos-ryz', 'Łosoś z ryżem i brokułem', ['lunch', 'dinner'], [['2706286', 140], ['2708402', 170], ['2709645', 120]], 'ryba obiad'),
  alias('2706592', 'Gulasz wołowy', ['lunch', 'dinner'], 300, 'obiad mięso', 121),
  alias('2709757', 'Zupa pomidorowa', ['lunch', 'dinner'], 300, 'pomidorówka', 119),
  alias('2710113', 'Zupa jarzynowa', ['lunch', 'dinner'], 350, 'warzywna', 56),
  alias('2707134', 'Rosół z kurczaka', ['lunch', 'dinner'], 350, 'zupa drobiowa'),
  alias('2708614', 'Pizza z serem', ['lunch', 'dinner'], 200, 'margherita', 57),
  alias('2708534', 'Burrito', ['lunch', 'dinner'], 220, 'tortilla zawijana'),
  composed('salatka-tunczyk', 'Sałatka z tuńczykiem', ['lunch', 'dinner'], [['2706311', 100], ['2709789', 80], ['2709719', 100], ['2709795', 30]], 'ryba sałata pomidor'),
  composed('salatka-kurczak', 'Sałatka z kurczakiem', ['lunch', 'dinner'], [['2705958', 120], ['2709789', 80], ['2709719', 100]], 'pierś kurczaka sałata pomidor'),
  composed('ryz-tunczyk', 'Ryż z tuńczykiem i pomidorem', ['lunch', 'dinner'], [['2708402', 180], ['2706311', 100], ['2709719', 100]], 'obiad'),
];
