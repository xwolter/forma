import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import { dayNumber, habitDates, streakStats } from "./streaks";
import { clearAll, commit, dbPromise, emptyData, incrementWater, loadData, seedCatalog, updateDaily, validateBackup } from "./db";
import { stamp, initialPlans } from "./catalog";
import { beginSession, completeSet, changeSetStatus } from "./workouts";
import { discoverFoods, productHistory } from "./foodDiscovery";
import type { FoodEntry, Product } from "./types";
import foods from "../data/foods-pl.json";

beforeEach(clearAll);
const food = (id: string, productId: string, date = '2026-10-24', status: FoodEntry['status'] = 'consumed'): FoodEntry => ({ ...stamp(id), productId, date, status, quick: false, meal: 'Obiad', name: 'Test', brand: '', recipeVersion: null, grams: 150, unit: 'g', nutrients: {kcal: 100, protein: 3, fat: 1, carbs: 20} });
describe('calendar streaks', () => {
  it('counts each day once and preserves yesterday until today ends', () => {
    const s = streakStats(['2026-10-21','2026-10-22','2026-10-23','2026-10-23'], '2026-10-24');
    expect(s).toMatchObject({current:3,longest:3,total:3,todayDone:false,last30:3});
    expect(streakStats(['2026-10-21','2026-10-22','2026-10-23'], '2026-10-25').current).toBe(0);
  });
  it('handles DST, year boundaries and leap days by calendar date', () => {
    expect(streakStats(['2026-10-24','2026-10-25','2026-10-26'], '2026-10-26').current).toBe(3);
    expect(streakStats(['2025-12-31','2026-01-01'], '2026-01-01').current).toBe(2);
    expect(streakStats(['2024-02-28','2024-02-29','2024-03-01'], '2024-03-01').current).toBe(3);
  });
  it('ignores future and impossible dates without inventing history', () => {
    expect(dayNumber('2026-02-29')).toBeNull();
    const s = streakStats(['2026-10-25','2026-02-30','2026-1-1','bad'], '2026-10-24');
    expect(s).toMatchObject({current:0,longest:0,total:0,last30:0});
  });
  it('keeps the previous record and only 30 recent calendar days after a gap', () => {
    const s = streakStats(['2026-09-01','2026-09-02','2026-09-03','2026-10-24'], '2026-10-24');
    expect(s).toMatchObject({current:1,longest:3,total:4,last30:1});
    expect(s.calendar).toHaveLength(30);
    expect(s.calendar[29]).toEqual({date:'2026-10-24',done:true});
  });
  it('records one app opening and concurrent water/completion changes without loss', async () => {
    const results = await Promise.all([updateDaily('2026-10-24',{appOpened:true}), updateDaily('2026-10-24',{appOpened:true}), incrementWater('2026-10-24'), updateDaily('2026-10-24',{complete:true})]);
    expect(results.filter(x => x === true)).toHaveLength(2);
    expect((await loadData()).daily).toHaveLength(1);
    expect((await loadData()).daily[0]).toMatchObject({appOpened:true,water:250,complete:true});
    expect(await updateDaily('2026-10-24',{appOpened:true})).toBe(false);
  });
  it('does not award plans, skipped sets or zero minute activities', async () => {
    await seedCatalog();
    const id = await beginSession(initialPlans()[0], '2026-10-24','gym','Gym');
    const row = (await loadData()).sets.find(s=>s.sessionId===id)!;
    const draft = await loadData();
    draft.food = [food('planned','food-0','2026-10-24','planned')];
    expect(habitDates(draft).movement).toEqual([]);
    expect(habitDates(draft).food).toEqual([]);
    await completeSet({...row,weight:20,reps:10},60);
    expect(habitDates(await loadData()).movement).toEqual(['2026-10-24']);
    await changeSetStatus(row.id,'undo');
    expect(habitDates(await loadData()).movement).toEqual([]);
    const data = emptyData();
    data.activities = [{...stamp(),date:'2026-10-24',name:'Spacer',minutes:20,distance:null,kcal:null,sourceId:null}];
    expect(habitDates(data).movement).toEqual(['2026-10-24']);
    data.activities[0].minutes=0;
    expect(habitDates(data).movement).toEqual([]);
  });
  it('food streak is independent of calorie targets and complete-day marker', () => {
    const data = emptyData();
    data.food = [food('one','food-0'),food('two','food-0')];
    expect(streakStats(habitDates(data).food,'2026-10-24').current).toBe(1);
    data.food=[];
    expect(streakStats(habitDates(data).food,'2026-10-24').current).toBe(0);
  });
  it('preserves open days in backups, accepts older backups and rejects a forged flag type', async () => {
    await seedCatalog();
    await updateDaily('2026-10-24', {appOpened:true});
    const data=await loadData();
    data.profiles=[{...stamp('me'),name:'Test',height:null,age:null,goal:'maintain',days:3,equipmentId:'gym',theme:'light',waterGoal:null,haptics:true,timerSound:false,notifications:false,demo:false}];
    const backup={format:'forma-backup',version:1,data};
    expect(validateBackup(backup).daily[0].appOpened).toBe(true);
    delete data.daily[0].appOpened;
    expect(()=>validateBackup(backup)).not.toThrow();
    (data.daily[0] as unknown as Record<string,unknown>).appOpened='yes';
    expect(()=>validateBackup(backup)).toThrow('dziennik');
  });
});
describe('food shortcuts and catalog upgrade', () => {
  it('finds Polish names without accents and matches brand in any term order', () => {
    const products: Product[] = [{...foods[0],name:'Płatki owsiane',brand:'Łowicz'} as Product];
    expect(discoverFoods(products,new Map(),'all','lowicz platki')[0]?.name).toBe('Płatki owsiane');
  });
  it('recent and frequent lists survive reload and exclude planned/future foods', async () => {
    const entries=[food('a','one','2026-10-22'),food('b','one','2026-10-23'),food('c','two'),food('d','three','2026-10-24','planned'),food('e','four','2026-10-25')];
    await commit(entries.map(value=>({table:'food' as const,value})));
    const history=productHistory((await loadData()).food,'2026-10-24');
    const products=['one','two','three','four'].map(id=>({...foods[0],id,name:id}) as Product);
    expect(discoverFoods(products,history,'recent','').map(p=>p.id)).toEqual(['two','one']);
    expect(discoverFoods(products,history,'frequent','').map(p=>p.id)).toEqual(['one','two']);
    expect(history.get('two')?.latest.grams).toBe(150);
    expect(discoverFoods(products,history,'all','three')).toHaveLength(1);
  });
  it('adds new real products to an old installation without overwriting corrections or favorites', async () => {
    const db=await dbPromise;
    await db.put('meta',true,'foods-pl-2026-10');
    const corrected={...foods[0],kcal:123,favorite:true,source:'Etykieta użytkownika'} as Product;
    await commit([{table:'products',value:corrected}]);
    await seedCatalog();
    const data=await loadData();
    expect(data.products.find(p=>p.id===corrected.id)).toMatchObject({kcal:123,favorite:true});
    expect(data.products.filter(p=>p.id.startsWith('off-'))).toHaveLength(264);
    await seedCatalog();
    expect((await loadData()).products).toHaveLength(data.products.length);
  });
  it('has actual valid source records for every imported barcode', () => {
    expect(foods).toHaveLength(264);
    expect(foods.every(p=>p.sourceUrl.endsWith(p.barcode)&&p.fetchedAt&&p.name)).toBe(true);
  });
});
