import fs from 'node:fs';
const cases=[['src/data/foods-usda-legacy.json','../.tools/data/usda-sr-legacy.json','SRLegacyFoods'],['src/data/foods-usda.json','../.tools/data/usda-fndds-2021-2023/surveyDownload.json','SurveyFoods']];
const fields={kcal:1008,protein:1003,fat:1004,carbs:1005};let total=0;
for(const [catalog,source,key]of cases){
 const originals=new Map(JSON.parse(fs.readFileSync(source,'utf8'))[key].map(p=>['usda-'+p.fdcId,p]));
 const rows=JSON.parse(fs.readFileSync(catalog,'utf8'));
 for(const p of rows){const original=originals.get(p.id);if(!original||p.originalName!==original.description)throw new Error('Food identity differs: '+p.id);
  for(const [field,id]of Object.entries(fields)){const value=original.foodNutrients.find(n=>n.nutrient.id===id)?.amount;const expected=typeof value==='number'&&Number.isFinite(value)&&value>=0&&value<=(field==='kcal'?1000:100)?value:null;
   if(p[field]!==expected)throw new Error('Nutrient differs: '+p.id+' '+field+' '+p[field]+' vs '+expected);
  }
 }
 total+=rows.length;console.log(catalog+': '+rows.length+' records, all source identities and nutrient values unchanged');
}
console.log('AUDIT PASSED: '+total+' real USDA records');
