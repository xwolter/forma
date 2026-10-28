import fs from 'node:fs';
import crypto from 'node:crypto';
const source='../.tools/data/usda-fndds-2021-2023/surveyDownload.json';
const raw=JSON.parse(fs.readFileSync(source,'utf8')).SurveyFoods;
const dict=new Map(fs.readFileSync('scripts/usda-pl-phrases.txt','utf8').replace(/^\uFEFF/,'').trim().split(/\r?\n/).map(s=>s.split('|')));
const fetchedAt=fs.statSync(source).mtime.toISOString();
const portions={'1 egg':'1 jajko','1 slice':'1 kromka','1 cup':'1 miarka USDA','1 small':'1 mała sztuka','1 medium':'1 średnia sztuka','1 large':'1 duża sztuka','1 piece':'1 sztuka','1 tablespoon':'1 łyżka USDA','1 teaspoon':'1 łyżeczka USDA'};
const rows=[];
for(const p of raw){
 const parts=p.description.split(',').map(s=>s.trim());
 if(!parts.every(s=>dict.has(s)))continue;
 const get=(id,max)=>{const n=p.foodNutrients.find(n=>n.nutrient.id===id);return n&&Number.isFinite(n.amount)&&n.amount>=0&&n.amount<=max?n.amount:null;};
 const kcal=get(1008,1000);if(kcal===null)continue;
 const name=parts.map(s=>dict.get(s)).join(' · ');
 const cat=p.wweiaFoodCategory?.wweiaFoodCategoryDescription||'';
 const breakfast=/Egg|Oatmeal|Yogurt|Pancake|Waffle|Cereal|Bread|Roll|Cheese sandwich|French toast|Croissant|Bagel/.test(p.description);
 const dish=/sandwich|Pizza|Pasta with|Soup|Stew|Lasagna|Burrito|Quesadilla|Egg omelet|Egg sandwich|Pancakes|Waffle|Oatmeal|French toast|Nachos|Fajita|Chili with|Rice,.*with /.test(p.description);
 const serving=p.foodPortions?.find(s=>portions[s.portionDescription]&&s.gramWeight>0&&s.gramWeight<=20000);
 rows.push({id:`usda-${p.fdcId}`,schemaVersion:1,updatedAt:fetchedAt,name,brand:'',unit:'g',barcode:'',favorite:false,kcal,protein:get(1003,100),fat:get(1004,100),carbs:get(1005,100),source:'USDA FoodData Central · FNDDS 2021–2023',sourceUrl:`https://fdc.nal.usda.gov/food-details/${p.fdcId}/nutrients`,fetchedAt,originalName:p.description,kind:dish?'dish':'basic',tags:[...(breakfast?['breakfast']:[]),...(dish?['dishes']:[]),...(/fruit/i.test(cat)?['fruit']:[]),...(/vegetable/i.test(cat)?['vegetables']:[]),...(/beverages|coffee|tea|milk/i.test(cat)?['drinks']:[])],servingSize:serving?portions[serving.portionDescription]:'',...(serving?{servingGrams:serving.gramWeight}:{})});
}
fs.writeFileSync('src/data/foods-usda.json',JSON.stringify(rows,null,2)+'\n');
const meta={source:'USDA FoodData Central / FNDDS 2021–2023, October 2024 release',license:'CC0-1.0 / public domain',sourceUrl:'https://fdc.nal.usda.gov/download-datasets/',sourceArchive:'https://fdc.nal.usda.gov/fdc-datasets/FoodData_Central_survey_food_json_2024-10-31.zip',sourceSha256:crypto.createHash('sha256').update(fs.readFileSync(source)).digest('hex'),fetchedAt,translation:'Polish names translated phrase by phrase; English source name retained. Only fully translated records are included. Nutritional values unchanged, all per 100 g.',products:rows};
fs.writeFileSync('public/data/foods-usda-cc0.json',JSON.stringify(meta,null,2)+'\n');
console.log(JSON.stringify({total:rows.length,breakfast:rows.filter(p=>p.tags.includes('breakfast')).length,dishes:rows.filter(p=>p.kind==='dish').length,sourceSha256:meta.sourceSha256}));
