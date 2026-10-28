import fs from 'node:fs';
const a=JSON.parse(fs.readFileSync('../.tools/data/usda-fndds-2021-2023/surveyDownload.json','utf8')).SurveyFoods;
const dict=new Map(fs.readFileSync('scripts/usda-pl-phrases.txt','utf8').replace(/^\uFEFF/,'').trim().split(/\r?\n/).map(s=>s.split('|')));
const full=a.filter(p=>p.description.split(',').every(s=>dict.has(s.trim())));
console.log('Fully translated',full.length);
const freq=new Map();for(const p of a){const missing=p.description.split(',').map(s=>s.trim()).filter(s=>!dict.has(s));if(missing.length===1)freq.set(missing[0],(freq.get(missing[0])||0)+1);}
console.log([...freq].sort((a,b)=>b[1]-a[1]).slice(0,150).map(([p,n])=>n+' '+p).join('\n'));
