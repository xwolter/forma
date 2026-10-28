import 'fake-indexeddb/auto';
import {beforeEach,describe,it,expect} from 'vitest';
import {backupData,clearAll,commit,dbPromise,loadData,restoreBackup,seedCatalog} from './db';
import {beginSession,makeSets,pauseRunningSessions} from './workouts';
import {controlledSession,applySessionActions} from './sessionControl';
import {readPlanBundle} from './planImport';
import {copyPlan,planForWeek,circuitStep} from './planTools';
import {initialPlans} from './catalog';
import {sessionSeconds,externalVolume} from './math';
import type {Plan,Session} from './types';
import fndds from '../data/foods-usda.json';
import legacy from '../data/foods-usda-legacy.json';
import off from '../data/foods-pl.json';
beforeEach(clearAll);
const circuit=():Plan=>({...initialPlans()[0],id:'program',program:'Mój program',exercises:['bench','row','squat'].map((exerciseId,i)=>({id:`a${i}`,exerciseId,sets:2,min:8,max:10,rest:90,restBetween:45,rir:2,notes:'',group:'A',weeklySets:[2,3,4,4,4],tempo:'3011'}))});
async function session(plan=circuit()){const id=await beginSession(plan,'2026-10-24','gym','Siłownia');return (await (await dbPromise).get('sessions',id)) as Session;}
describe('plans in the workbook style',()=>{
 it('preserves circuits, tempo, rest intervals, MAX and weekly progression on safe import',()=>{
  const p=circuit();p.exercises[1].target='MAX';const [imported]=readPlanBundle({format:'forma-plans',version:1,plans:[p]});
  expect(imported.exercises).toEqual(p.exercises);expect(planForWeek(imported,3).exercises.map(s=>s.sets)).toEqual([4,4,4]);
  expect(imported.exercises[0].sets).toBe(2);expect(copyPlan(imported).exercises[0].id).not.toBe(imported.exercises[0].id);
 });
 it('rejects unknown exercises, invalid units, unbounded weekly arrays and duplicate slots',()=>{
  for(const patch of [{exerciseId:'unknown'},{metric:'hours'},{weeklySets:[2,3,4]},{weeklySets:[2,3,Infinity,4,4]},{restBetween:-1},{tempo:{html:'<script>'}}]){const p=circuit();Object.assign(p.exercises[0],patch);expect(()=>readPlanBundle({format:'forma-plans',version:1,plans:[p]})).toThrow();}
  const p=circuit();p.exercises[1].id=p.exercises[0].id;expect(()=>readPlanBundle({format:'forma-plans',version:1,plans:[p]})).toThrow();
 });
 it('moves between exercises in a round and uses the longer pause after the whole round',async()=>{
  const s=await session(),sets=s.planSnapshot.exercises.flatMap(slot=>makeSets(s.id,slot,s.equipmentId));
  const first=sets.find(x=>x.slotId==='a0'&&x.index===0)!;
  expect(circuitStep(s,first,sets,90)).toEqual({currentExercise:1,rest:45});first.done=true;
  const second=sets.find(x=>x.slotId==='a1'&&x.index===0)!;second.done=true;
  const third=sets.find(x=>x.slotId==='a2'&&x.index===0)!;
  expect(circuitStep(s,third,sets,90)).toEqual({currentExercise:0,rest:90});
 });
 it('keeps seconds out of lifting volume and does not start another session while one is saved',async()=>{
  const p=circuit();p.exercises[0].metric='seconds';const s=await session(p),rows=makeSets(s.id,p.exercises[0],'gym');
  expect(rows[0].metric).toBe('seconds');expect(externalVolume([{...rows[0],weight:20,reps:30,done:true}])).toBe(0);
  expect(await beginSession(circuit(),'2026-10-24','gym','Siłownia')).toBe(s.id);expect((await loadData()).sessions).toHaveLength(1);
 });
});
describe('manual controls and notification recovery',()=>{
 it('pauses session time and a rest countdown, then resumes both without counting the pause',async()=>{
  const raw=await session(),start=100000,s={...raw,startedAt:start,restEndsAt:start+90000,pausedMs:0};
  const paused=controlledSession(s,'pause',start+30000);expect(paused.restRemaining).toBe(60000);expect(paused.restEndsAt).toBeNull();expect(sessionSeconds(paused,start+999999)).toBe(30);
  const resumed=controlledSession(paused,'resume',start+100000);expect(resumed.pausedMs).toBe(70000);expect(resumed.restEndsAt).toBe(start+160000);expect(sessionSeconds(resumed,start+110000)).toBe(40);
 });
 it('replaying notification controls is idempotent and cannot change finished sessions',async()=>{
  const s=await session(),at=Date.now();const q=[{id:'a',sessionId:s.id,action:'pause' as const,at},{id:'b',sessionId:s.id,action:'resume' as const,at:at+100}];
  await applySessionActions(q);const once=(await loadData()).sessions[0];await applySessionActions(q);expect((await loadData()).sessions[0]).toEqual(once);
  await commit([{table:'sessions',value:{...once,status:'finished',endedAt:at+100}}]);await applySessionActions([{id:'c',sessionId:s.id,action:'pause',at}]);expect((await loadData()).sessions[0].status).toBe('finished');
 });
 it('rejects a malformed entire action batch before applying its valid first item',async()=>{
  const s=await session();await expect(applySessionActions([{id:'ok',sessionId:s.id,action:'pause',at:Date.now()},{id:'bad',sessionId:s.id,action:'resume',at:Infinity}])).rejects.toThrow();expect((await loadData()).sessions[0].status).toBe('active');
 });
 it('a restored browser session waits at its last heartbeat instead of counting time while the app was closed',async()=>{
  const raw=await session(),s={...raw,startedAt:Date.now()-3000},last=s.startedAt+1000;await commit([{table:'sessions',value:{...s,lastActiveAt:last}}]);await pauseRunningSessions();const paused=(await loadData()).sessions[0];expect(paused.status).toBe('paused');expect(sessionSeconds(paused,Date.now()+86400000)).toBe(1);
 });
});
describe('large real catalog and personal backups',()=>{
 it('contains over ten thousand unique sourced records with bounded real nutrient values',()=>{
  const all=[...fndds,...legacy,...off];expect(all.length).toBeGreaterThanOrEqual(10000);expect(new Set(all.map(p=>p.id)).size).toBe(all.length);
  for(const p of all){expect(p.sourceUrl).toMatch(/^https:\/\/(fdc.nal.usda.gov\/food-details\/|world.openfoodfacts.org\/product\/)/);expect(p.kcal).toBeGreaterThanOrEqual(0);expect(p.kcal).toBeLessThanOrEqual(1000);}
 });
 it('backs up favourites, corrections and personal products without duplicating 10k immutable reference rows',async()=>{
  await seedCatalog();const all=await loadData();expect(backupData(all).products).toHaveLength(0);
  const favorite={...all.products[0],favorite:true};const custom={...favorite,id:'my-food',name:'Mój produkt',source:'Moja etykieta'};await commit([{table:'products',value:favorite},{table:'products',value:custom}]);
  const b=backupData(await loadData());expect(b.products).toHaveLength(2);await restoreBackup(b);const restored=(await loadData()).products;expect(restored.length).toBe(all.products.length+1);expect(restored.find(p=>p.id===favorite.id)?.favorite).toBe(true);expect(restored.find(p=>p.id==='my-food')?.name).toBe('Mój produkt');
 });
});
