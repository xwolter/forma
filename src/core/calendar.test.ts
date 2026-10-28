import {describe,it,expect}from'vitest';
import{weekDates,weekCaption}from'./calendar';
import{shiftDate,dayTotals}from'./math';
import type{FoodEntry}from'./types';
describe('selected week and historical food isolation',()=>{
 it('starts on Monday and crosses a daylight saving weekend without losing a day',()=>{
  expect(weekDates('2026-10-24')).toEqual(['2026-10-19','2026-10-20','2026-10-21','2026-10-22','2026-10-23','2026-10-24','2026-10-25']);
  expect(weekDates(shiftDate('2026-10-24',-7))[5]).toBe('2026-10-17');
  expect(weekDates(shiftDate('2026-10-24',7))[6]).toBe('2026-11-01');
 });
 it('labels cross-month and cross-year weeks and rejects invalid dates',()=>{
  expect(weekCaption('2026-10-24')).toContain('2026');
  expect(weekCaption('2026-10-31')).toMatch(/paź.*lis/);
  expect(weekCaption('2027-01-01')).toMatch(/2026.*2027/);
  expect(()=>weekDates('2026-02-30')).toThrow();
 });
 it('keeps planned, eaten, current and historical meal totals separate',()=>{
  const base={id:'a',updatedAt:'2026-10-24T12:00:00Z',schemaVersion:1,name:'Posiłek',brand:'',productId:null,recipeVersion:null,meal:'Śniadanie',unit:'g',grams:150,quick:false,nutrients:{kcal:100,protein:10,fat:3,carbs:15}} as const;
  const rows=[{...base,date:'2026-10-17',status:'consumed'},{...base,id:'b',date:'2026-10-24',status:'consumed'},{...base,id:'c',date:'2026-10-24',status:'planned'}] as FoodEntry[];
  expect(dayTotals(rows,'2026-10-17').kcal).toBe(150);expect(dayTotals(rows,'2026-10-24').kcal).toBe(150);expect(dayTotals(rows,'2026-10-24','planned').kcal).toBe(150);expect(dayTotals(rows,'2026-10-31').kcal).toBe(0);
 });
});
