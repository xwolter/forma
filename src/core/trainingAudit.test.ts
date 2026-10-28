import {readPlanBundle} from './planImport';
import 'fake-indexeddb/auto';
import {beforeEach,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {EXERCISES,exerciseById,stamp,loadLabel} from './catalog';
import frames from '../data/exercise-frames.json';
import videos from '../data/exercise-videos.json';
import mapping from '../../scripts/exercise-expanded-map.json';
import {discoverExercises} from './exerciseDiscovery';
import {defaultPlanExercise,changePlanMetric,slotTarget} from './planTools';
import {resultMetric,resultLimit} from './exerciseMetrics';
import {beginSession,completeSet,replaceSessionExercise,appendWorkoutSet} from './workouts';
import {clearAll,loadData,commit,emptyData,validateBackup,backupData} from './db';
import {externalVolume,bestWorkingSet,progression} from './math';
import type {Plan,WorkoutSet} from './types';
beforeEach(clearAll);
const plan=(id='bench'):Plan=>({...stamp('audit-plan'),name:'Próba',subtitle:'',minutes:30,version:1,weekdays:[],exercises:[defaultPlanExercise(exerciseById(id))]});
it('appends a set using the plan unit override, allocates unique indices and respects pause and the limit',async()=>{
 const p=plan();p.exercises[0].metric='seconds';const id=await beginSession(p,'2026-10-25','gym','Test');const slot=p.exercises[0].id;
 const rows=await Promise.all([appendWorkoutSet(id,slot),appendWorkoutSet(id,slot)]);expect(rows.map(r=>r.index)).toEqual([3,4]);expect(rows.every(r=>r.metric==='seconds')).toBe(true);
 let d=await loadData();await commit([{table:'sessions',value:{...d.sessions[0],status:'paused'}}]);await expect(appendWorkoutSet(id,slot)).rejects.toThrow('Wznów');await commit([{table:'sessions',value:d.sessions[0]}]);
 for(let n=5;n<20;n++)await appendWorkoutSet(id,slot);await expect(appendWorkoutSet(id,slot)).rejects.toThrow('20 serii');expect((await loadData()).sets).toHaveLength(20);
});
it('has 300 distinct exercises, stable original IDs, Polish instructions and exact frame mappings',()=>{
 expect(EXERCISES).toHaveLength(300);expect(new Set(EXERCISES.map(e=>e.id)).size).toBe(300);
 for(const e of EXERCISES){expect(e.instructions.length).toBeGreaterThanOrEqual(3);for(const id of e.alternatives)expect(exerciseById(id),e.name).toBeTruthy();const photo=e.demoId??e.id;expect(frames.includes(photo)||(photo in videos),photo).toBe(true);for(const frame of frames.includes(photo)?[0,1]:[0]){const b=readFileSync(`public/exercises/${photo}/${frame}.jpg`);expect(b[0]).toBe(255);expect(b[1]).toBe(216);}}
 for(const [id,sourceId]of Object.entries(mapping))expect(exerciseById(id).sourceId).toBe(sourceId);
});
it('finds accented Polish names without Polish keys, English aliases, multiple terms and combined filters',()=>{
 expect(discoverExercises('sciaganie drazka').some(e=>e.id==='pulldown')).toBe(true);
 expect(discoverExercises('hip thrust')[0].id).toBe('hip-thrust');
 expect(discoverExercises('bench press','Hantle').every(e=>e.equipment==='Hantle')).toBe(true);
 expect(discoverExercises('','Wyciąg','Barki').map(e=>e.id)).toContain('face-pull');
 expect(discoverExercises('qwerty')).toEqual([]);
});
it('sets useful targets and proper units for repetitions, holds and carries',()=>{
 expect(slotTarget(defaultPlanExercise(exerciseById('plank')))).toBe('30-45 s');
 expect(slotTarget(defaultPlanExercise({...exerciseById('farmer-walk'),metric:'distance'}))).toBe('20-40 m');
 expect(slotTarget(defaultPlanExercise(exerciseById('bench')))).toBe('8-12 powt.');
 const slot={...defaultPlanExercise(exerciseById('bench')),target:'8 powtórzeń'};expect(changePlanMetric(slot,'seconds')).toMatchObject({min:30,max:45,target:'',metric:'seconds'});
});
it('keeps a finished original set and replaces only pending sets, with no orphaned history',async()=>{
 const p=plan();await commit([{table:'plans',value:p}]);const id=await beginSession(p,'2026-10-25','gym','Test');let d=await loadData();const first=d.sets[0];await completeSet({...first,weight:55,reps:12},90);
 const newSlot=await replaceSessionExercise(id,p.exercises[0].id,'db-bench');d=await loadData();expect(d.sets).toHaveLength(3);expect(d.sets.find(s=>s.id===first.id)).toMatchObject({exerciseId:'bench',weight:55,reps:12,done:true});expect(d.sets.filter(s=>s.slotId===newSlot)).toHaveLength(2);
 const saved=d.sessions[0];expect(saved.currentExercise).toBe(1);expect(saved.restEndsAt).toBeNull();for(const set of d.sets)expect(saved.planSnapshot.exercises.some(s=>s.id===set.slotId)).toBe(true);expect(d.plans[0]).toEqual(p);
});
it('resets incompatible target units during a swap and rejects a second stale swap',async()=>{
 const p=plan('plank');p.exercises[0].target='45 sekund';const id=await beginSession(p,'2026-10-25','gym','Test');await replaceSessionExercise(id,p.exercises[0].id,'crunch');const d=await loadData();expect(d.sessions[0].planSnapshot.exercises[0]).toMatchObject({metric:'reps',target:'',min:8,max:12});expect(d.sets.every(s=>s.metric==='reps')).toBe(true);await expect(replaceSessionExercise(id,p.exercises[0].id,'bench')).rejects.toThrow();
});
it('exports and restores a 1200-second hold, while rejecting impossible durations and rep counts',async()=>{
 const p=plan('plank');p.exercises[0].min=1200;p.exercises[0].max=1800;const id=await beginSession(p,'2026-10-25','gym','Test');const d=await loadData();await completeSet({...d.sets[0],reps:1200},0);const data={...emptyData(),...backupData(await loadData())};data.equipment=[{...stamp('gym'),name:'Test',types:['Masa ciała'],step:2.5,notes:''}];data.profiles=[{...stamp('profile'),name:'Tester',height:null,age:null,goal:'maintain',days:3,equipmentId:'gym',theme:'light',waterGoal:null,haptics:false,timerSound:false,notifications:false,demo:false}];
 expect(()=>validateBackup({format:'forma-backup',version:1,data})).not.toThrow();const set=data.sets.find(s=>s.sessionId===id&&s.done)!;set.reps=86401;expect(()=>validateBackup({format:'forma-backup',version:1,data})).toThrow();set.metric='reps';set.reps=1001;expect(()=>validateBackup({format:'forma-backup',version:1,data})).toThrow();expect(resultLimit(resultMetric({...set,metric:'seconds'}))).toBe(86400);
});
it('does not count seconds as volume and counts one two-handed dumbbell once',()=>{
 const s={done:true,skipped:false,type:'work',loadType:'dumbbell',weight:20,reps:10,exerciseId:'db-pullover',metric:'reps'} as WorkoutSet;
 expect(externalVolume([s])).toBe(200);expect(loadLabel('dumbbell','db-pullover')).toBe('jeden hantel · kg');expect(externalVolume([{...s,exerciseId:'goblet-box-squat'}])).toBe(200);expect(externalVolume([{...s,metric:'seconds'}])).toBe(0);
 expect(bestWorkingSet([{...s,metric:'seconds',weight:30,reps:30},{...s,metric:'seconds',weight:20,reps:60}],'dumbbell')?.reps).toBe(60);
});
it('does not suggest increasing weights from holds or distance results',()=>{
 const p=plan('plank'),now=Date.now();const sessions=[0,1].map(i=>({...stamp('s'+i),date:'2026-10-25',equipmentId:'gym',status:'finished' as const,comparable:true,pain:false,endedAt:now-i*86400000,planSnapshot:p}));
 const sets=sessions.flatMap(s=>[0,1,2].map(index=>({...stamp(`${s.id}-${index}`),sessionId:s.id,exerciseId:'plank',equipmentId:'gym',slotId:'slot',index,type:'work',loadType:'barbell',weight:20,reps:60,rir:3,done:true,skipped:false,metric:'seconds',completedAt:now}) as WorkoutSet));
 expect(progression(sessions as Parameters<typeof progression>[0],sets,'plank','gym',{count:3,max:45,rir:2},2.5)).toBeNull();
});

it('imports long timed plans without changing fractional RIR or estimated minutes',()=>{const p=plan('plank');p.minutes=30.5;p.exercises[0].min=1200;p.exercises[0].max=1800;p.exercises[0].rir=2.5;const imported=readPlanBundle({format:'forma-plans',version:1,plans:[p]})[0];expect(imported.exercises).toEqual(p.exercises);expect(imported.minutes).toBe(30.5);p.exercises[0].max=86401;expect(()=>readPlanBundle({format:'forma-plans',version:1,plans:[p]})).toThrow();});
