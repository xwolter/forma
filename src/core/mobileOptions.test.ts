import 'fake-indexeddb/auto';
import {beforeEach,describe,it,expect} from 'vitest';
import {clearAll,commit,incrementWater,loadData,seedCatalog,setWater,updateDaily} from './db';
import {applyWidgetActions} from './widgets';
import {discoverFoods} from './foodDiscovery';
import {validateRelease,UPDATE_ORIGIN} from './updates';
import usda from '../data/foods-usda.json';
import legacy from '../data/foods-usda-legacy.json';
import type {Product} from './types';
beforeEach(clearAll);
describe('correcting water and actual widget actions',()=>{
 it('subtracts water, clamps at zero and returns the amount actually changed for undo',async()=>{
  await incrementWater('2026-10-24',100);
  expect(await incrementWater('2026-10-24',-250)).toBe(-100);
  expect((await loadData()).daily[0].water).toBe(0);
  await incrementWater('2026-10-24',100);
  expect((await loadData()).daily[0].water).toBe(100);
 });
 it('undoes a tap without replacing water added in the meantime',async()=>{
  const delta=await incrementWater('2026-10-24',250);
  await incrementWater('2026-10-24',500);
  await incrementWater('2026-10-24',-delta);
  expect((await loadData()).daily[0].water).toBe(500);
 });
 it('manual correction preserves other daily fields and accepts zero',async()=>{
  await updateDaily('2026-10-24',{appOpened:true,complete:true});
  await setWater('2026-10-24',1234);expect(await setWater('2026-10-24',0)).toBe(1234);
  expect((await loadData()).daily[0]).toMatchObject({water:0,appOpened:true,complete:true});
  for(const invalid of [-1,Infinity,0.5,100001])await expect(setWater('2026-10-24',invalid)).rejects.toThrow();
 });
 it('queued widget actions survive rereads and are applied exactly once even if acknowledgement is retried',async()=>{
  const actions=[{id:'one',date:'2026-10-24',delta:250},{id:'two',date:'2026-10-24',delta:250},{id:'three',date:'2026-10-24',delta:-250}];
  expect(await applyWidgetActions(actions)).toBe(true);expect((await loadData()).daily[0].water).toBe(250);
  expect(await applyWidgetActions(actions)).toBe(false);expect((await loadData()).daily[0].water).toBe(250);
 });
 it('keeps widget days separate and rejects a malformed batch before writing anything',async()=>{
  await applyWidgetActions([{id:'yesterday',date:'2026-10-23',delta:250},{id:'today',date:'2026-10-24',delta:250}]);
  expect((await loadData()).daily).toHaveLength(2);
  await expect(applyWidgetActions([{id:'valid',date:'2026-10-24',delta:250},{id:'bad',date:'2026-02-30',delta:250}])).rejects.toThrow();
  expect((await loadData()).daily.find(d=>d.date==='2026-10-24')!.water).toBe(250);
 });
});
describe('real meals and breakfast catalog',()=>{
 it('has over two thousand distinct source records with Polish names and unaltered source identifiers',()=>{
  expect(usda.length).toBeGreaterThan(2000);expect(new Set(usda.map(p=>p.id)).size).toBe(usda.length);
  for(const p of usda){expect(p.sourceUrl).toBe(`https://fdc.nal.usda.gov/food-details/${p.id.slice(5)}/nutrients`);expect(p.unit).toBe('g');expect(p.originalName).toBeTruthy();expect(Number.isFinite(p.kcal)).toBe(true);}
 });
 it('finds scrambled eggs, porridge, omelets and actual breakfasts without accents',()=>{
  const products=usda as Product[];
  for(const query of ['jajecznica','owsianka','omlet','kanapka'])expect(discoverFoods(products,new Map(),'all',query,'breakfast').length).toBeGreaterThan(1);
  expect(discoverFoods(products,new Map(),'all','','breakfast').length).toBeGreaterThan(300);
  expect(discoverFoods(products,new Map(),'all','','dishes').length).toBeGreaterThan(400);
 });
 it('retains the published egg reference values and measured portion rather than inventing a standard serving',()=>{
  const egg=usda.find(p=>p.id==='usda-2707198')!;
  expect(egg).toMatchObject({kcal:185,protein:11.6,fat:15,carbs:0.91,servingGrams:55,servingSize:'1 jajko'});
 });
 it('installs the catalog on upgrade without changing local corrections and historic meal snapshots',async()=>{
  const corrected={...usda[0],kcal:99,favorite:true,source:'Moja etykieta'} as Product;
  await commit([{table:'products',value:corrected}]);await seedCatalog();
  const products=(await loadData()).products;expect(products.filter(p=>p.id.startsWith('usda-'))).toHaveLength(usda.length+legacy.length);
  expect(products.find(p=>p.id===corrected.id)).toMatchObject({kcal:99,favorite:true,source:'Moja etykieta'});
 });
});
describe('update channel input validation',()=>{
 const valid={schema:1,packageName:'pl.forma.dziennik',version:'0.5.0',versionCode:5,bytes:32000000,sha256:'a'.repeat(64),url:`${UPDATE_ORIGIN}/releases/FORMA-0.5.0.apk`,notes:['Nowe funkcje']};
 it('accepts a bounded release for the fixed app and download channel',()=>expect(validateRelease(valid).versionCode).toBe(5));
 it('rejects another domain, downgrade metadata tricks, path traversal, credentials and invalid hashes',()=>{
  for(const patch of [{url:'https://evil.test/app.apk'},{url:`${UPDATE_ORIGIN}/releases/../app.apk`},{url:'https://user:pass@forma-mobi-2026-4e7c1a.web.app/releases/FORMA-0.5.0.apk'},{packageName:'other.package'},{versionCode:'6'},{bytes:101*1024*1024},{sha256:'bad'},{notes:['x'.repeat(501)]}])expect(()=>validateRelease({...valid,...patch})).toThrow();
 });
});
