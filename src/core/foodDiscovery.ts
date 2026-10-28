import type { FoodEntry, Product } from "./types";
import { dayNumber } from "./streaks";

export type FoodFilter = 'all' | 'recent' | 'frequent' | 'favorites' | 'meal';
export const searchText = (text: string) => text.toLocaleLowerCase('pl').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replaceAll('ł', 'l').trim();
const searchWords = (text: string) => searchText(text).split(/[^a-z0-9]+/).filter(Boolean);
const filler = new Set(['z', 'ze', 'i', 'w', 'na', 'do', 'od', 'oraz']);
const foodIndex = new WeakMap<Product, { name: string; nameWords: string[]; allWords: string[] }>();
const termIndex = new Map<string, { terms: string[]; phrase: string }>();
function indexedFood(product: Product) {
  let indexed = foodIndex.get(product);
  if (!indexed) {
    indexed = {
      name: searchText(product.name),
      nameWords: searchWords(product.name),
      allWords: searchWords(`${product.name} ${product.searchTerms ?? ''} ${product.brand ?? ''} ${product.barcode ?? ''}`),
    };
    foodIndex.set(product, indexed);
  }
  return indexed;
}

function nearWord(a: string, b: string): boolean {
  if (a === b || (a.length >= 4 && b.includes(a))) return true;
  const max = a.length >= 7 ? 2 : a.length >= 4 ? 1 : 0;
  if (!max || Math.abs(a.length - b.length) > max) return false;
  // Restricted Damerau distance: catches a missing letter or adjacent swap.
  const rows = Array.from({ length: a.length + 1 }, () => Array<number>(b.length + 1).fill(0));
  for (let i = 0; i <= a.length; i++) rows[i][0] = i;
  for (let j = 0; j <= b.length; j++) rows[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      rows[i][j] = Math.min(rows[i - 1][j] + 1, rows[i][j - 1] + 1, rows[i - 1][j - 1] + Number(a[i - 1] !== b[j - 1]));
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) rows[i][j] = Math.min(rows[i][j], rows[i - 2][j - 2] + 1);
    }
  }
  return rows[a.length][b.length] <= max;
}

export function foodSearchScore(product: Product, query: string, allowApproximate = true): { score: number; approximate: boolean } | null {
  let indexedQuery = termIndex.get(query);
  if (!indexedQuery) {
    indexedQuery = { terms: searchWords(query).filter(t => !filler.has(t)), phrase: searchText(query) };
    if (termIndex.size > 32) termIndex.clear();
    termIndex.set(query, indexedQuery);
  }
  const { terms, phrase } = indexedQuery;
  if (!terms.length) return query.trim() ? null : { score: 0, approximate: false };
  const { name, nameWords, allWords } = indexedFood(product);
  let score = 0;
  let approximate = false;
  for (const term of terms) {
    if (nameWords.some(w => w === term)) score += 24;
    else if (nameWords.some(w => w.includes(term))) score += 18;
    else if (allWords.some(w => w === term || w.includes(term))) score += 12;
    else if (allowApproximate && allWords.some(w => nearWord(term, w))) { score += 5; approximate = true; }
    else return null;
  }
  if (name === phrase) score += 80;
  else if (name.startsWith(phrase)) score += 30;
  if (product.id.startsWith('meal-')) score += 14;
  return { score, approximate };
}
export function productHistory(entries: FoodEntry[], today: string) {
  const history = new Map<string, { count: number; latest: FoodEntry }>();
  for (const entry of entries) {
    if (entry.status !== 'consumed' || entry.quick || !entry.productId || entry.date > today || dayNumber(entry.date) === null) continue;
    const previous = history.get(entry.productId);
    const latest = !previous || `${entry.date}/${entry.updatedAt}` > `${previous.latest.date}/${previous.latest.updatedAt}` ? entry : previous.latest;
    history.set(entry.productId, { count: (previous?.count ?? 0) + 1, latest });
  }
  return history;
}
export type FoodCategory = 'all' | 'breakfast' | 'dishes' | 'packaged' | 'basic';
export function foodCategory(p: Product, category: FoodCategory) {
  if (category === 'all') return true;
  if (category === 'packaged') return Boolean(p.barcode);
  if (category === 'basic') return !p.barcode && p.kind !== 'dish';
  if (category === 'dishes') return p.kind === 'dish';
  return p.tags?.includes('breakfast') || /jaj|omlet|owsian|jogurt|mleko|twaróg|chleb|bułk|płatki|kanapk|gofr|naleśnik/i.test(p.name);
}
export function discoverFoods(products: Product[], history: ReturnType<typeof productHistory>, filter: FoodFilter, query: string, category: FoodCategory = 'all') {
  const terms = searchText(query).split(/\s+/).filter(Boolean);
  return products.filter(p => {
    if (!foodCategory(p, category)) return false;
    if (filter === 'favorites' && !p.favorite) return false;
    if ((filter === 'recent' || filter === 'frequent' || filter === 'meal') && !history.has(p.id)) return false;
    const text = searchText(`${p.name} ${p.originalName ?? ''} ${p.searchTerms ?? ''} ${p.brand} ${p.barcode}`);
    return terms.every(term => text.includes(term));
  }).sort((a, b) => {
    const ah = history.get(a.id), bh = history.get(b.id);
    if (filter === 'frequent' && ah?.count !== bh?.count) return (bh?.count ?? 0) - (ah?.count ?? 0);
    if (filter === 'recent' || filter === 'frequent' || filter === 'meal') {
      const latest = (bh?.latest.date ?? '').localeCompare(ah?.latest.date ?? '') || (bh?.latest.updatedAt ?? '').localeCompare(ah?.latest.updatedAt ?? '');
      if (latest) return latest;
    }
    const relevance=(p:Product)=>{
      if(!terms.length)return 0;
      const name=searchText(p.name),head=name.split(' · ')[0];
      return name===terms.join(' ')?4:terms.every(t=>head.includes(t))?3:terms.every(t=>name.includes(t))?2:1;
    };
    const everyday=(p:Product)=>p.id.startsWith('food-')?4:p.barcode?3:p.source.includes('FNDDS')?2:1;
    return Number(b.favorite) - Number(a.favorite) || relevance(b)-relevance(a) || (!terms.length?everyday(b)-everyday(a):0) || a.name.localeCompare(b.name, 'pl') || a.id.localeCompare(b.id);
  });
}
