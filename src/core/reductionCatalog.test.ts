import {it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {EXERCISES,exerciseById} from './catalog';
import {discoverExercises,exerciseKind} from './exerciseDiscovery';
import {defaultPlanExercise,changePlanMetric} from './planTools';
import {externalVolume} from './math';
import type {WorkoutSet} from './types';
import added from '../data/exercises-reduction.json';
import provenance from '../../public/data/exercise-reduction-sources.json';

it('adds 200 distinct documented source variants with their exact local photographs',()=>{
 expect(added).toHaveLength(200);expect(provenance.exercises).toHaveLength(200);
 expect(new Set(added.map(e=>e.sourceId)).size).toBe(200);
 for(const e of added){expect(exerciseById(e.id)).toBeTruthy();expect(e.instructions).toHaveLength(3);expect(e.mistakes.length).toBeGreaterThan(0);
  const ref=provenance.exercises.find(p=>p.id===e.id)!;expect(ref.sourceId).toBe(e.sourceId);
  for(let i=0;i<2;i++){expect(ref.images[i]).toContain(`/exercises/${e.sourceId}/${i}.jpg`);const b=readFileSync(`public/exercises/${e.id}/${i}.jpg`);expect(b.length).toBeGreaterThan(500);expect([...b.subarray(0,2)]).toEqual([255,216]);}
 }
});
it('combines cardio, starter and no-jump filters with names, equipment and body part',()=>{
 expect(discoverExercises('','','','cardio')).toHaveLength(28);
 expect(discoverExercises('','','','recommended')).toHaveLength(24);
 expect(discoverExercises('','','','lowImpact').every(e=>e.lowImpact)).toBe(true);
 expect(discoverExercises('rower','','','recommended').length).toBeGreaterThan(0);
 expect(discoverExercises('','Gumy','','lowImpact').length).toBeGreaterThan(5);
 expect(discoverExercises('','','','strength').every(e=>exerciseKind(e)==='strength')).toBe(true);
 expect(discoverExercises('skakance','','','lowImpact')).toEqual([]);
 expect(discoverExercises('','','','recommended').some(e=>e.name.includes('Wskok'))).toBe(false);
 expect(discoverExercises('martwy robak')[0].id).toBe('fit-dead-bug');
});
it('uses minutes of cardio in seconds, with a single interval and without stale duration targets after unit changes',()=>{
 const bike=exerciseById('fit-bicycling-stationary'),slot=defaultPlanExercise(bike);
 expect(slot).toMatchObject({metric:'seconds',sets:1,min:600,max:1200,rest:0,rir:null});
 expect(changePlanMetric(slot,'reps')).toMatchObject({min:8,max:12,metric:'reps',rir:2});
 expect(defaultPlanExercise(exerciseById('fit-rope-jumping'))).toMatchObject({metric:'seconds',min:30,max:60});
 for(const e of EXERCISES){const s=defaultPlanExercise(e);expect(s.min).toBeGreaterThan(0);expect(s.max).toBeGreaterThanOrEqual(s.min);}
});
it('counts a single two-handed dumbbell once and excludes timed cardio from lifted volume',()=>{
 const set={done:true,skipped:false,type:'work',loadType:'dumbbell',weight:20,reps:10,exerciseId:'fit-close-grip-dumbbell-press',metric:'reps'} as WorkoutSet;
 expect(externalVolume([set])).toBe(200);
 expect(externalVolume([{...set,exerciseId:'fit-bicycling-stationary',metric:'seconds',reps:600}])).toBe(0);
});
