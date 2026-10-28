import {exerciseById} from './catalog';
export type ResultMetric='reps'|'seconds'|'distance';
export const resultMetric=(v:{exerciseId:string;metric?:ResultMetric}):ResultMetric=>v.metric??exerciseById(v.exerciseId)?.metric??'reps';
export const resultLimit=(metric:ResultMetric)=>metric==='seconds'?86400:metric==='distance'?100000:1000;
export const resultUnit=(metric:ResultMetric)=>metric==='seconds'?'s':metric==='distance'?'m':'powt.';
export const resultLabel=(metric:ResultMetric)=>metric==='seconds'?'Sekundy':metric==='distance'?'Metry':'Powtórzenia';
