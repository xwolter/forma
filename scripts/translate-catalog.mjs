import fs from 'node:fs';
const read=f=>JSON.parse(fs.readFileSync(f,'utf8'));
const dictionary=new Map();
for(const file of ['scripts/usda-pl-phrases.txt','scripts/usda-pl-reviewed.txt'])for(const line of fs.readFileSync(file,'utf8').replace(/^\uFEFF/,'').trim().split(/\r?\n/)){const [en,pl]=line.split('|');if(pl)dictionary.set(en,pl);}
const machine=read(fs.existsSync('../.tools/translation/translated.json')?'../.tools/translation/translated.json':'scripts/usda-pl-legacy-phrases.json');
const before=read('src/data/foods-usda-legacy.json');
const snapshot=before.map(p=>({id:p.id,name:p.name}));
if(!fs.existsSync('src/data/food-catalog-previous.json'))fs.writeFileSync('src/data/food-catalog-previous.json',JSON.stringify(snapshot));
const phrases={};
function translate(s,head=false){
 if(dictionary.has(s))return dictionary.get(s);
 // Brand names, grade codes and product names in uppercase retain identity.
 if(s===s.toUpperCase() && /[A-Z]/.test(s))return s;
 const pizza=s.match(/^(.*?) (\d+)" (.*?) Pizza$/i);
 if(pizza){const topping={'Cheese':'serowa','Pepperoni':'pepperoni','Sausage':'z kiełbasą','Original Round Cheese':'serowa na okrągłym spodzie','Original Round Pepperoni':'pepperoni na okrągłym spodzie','Original Round Meat and Vegetable':'mięsno-warzywna na okrągłym spodzie','The Works':'The Works','Super Supreme':'Super Supreme','EXTRAVAGANZZA FEAST':'EXTRAVAGANZZA FEAST'};return `Pizza ${topping[pizza[3]]??pizza[3]} ${pizza[1]} · ${pizza[2]} cali`;}
 const silk=s.match(/^SILK (.*)$/);if(silk){const flavour={'Chocolate':'czekoladowy','Light Plain':'naturalny o obniżonej wartości energetycznej','Light Vanilla':'waniliowy o obniżonej wartości energetycznej','Light Chocolate':'czekoladowy o obniżonej wartości energetycznej','Very Vanilla':'waniliowy','Nog':'jajeczno-mleczny wariant Nog','Chai':'chai','Mocha':'mokka','Raspberry soy yogurt':'jogurt sojowy malinowy','Peach soy yogurt':'jogurt sojowy brzoskwiniowy','Black Cherry soy yogurt':'jogurt sojowy z czarnymi wiśniami','Blueberry soy yogurt':'jogurt sojowy borówkowy','Hazelnut Creamer':'dodatek do kawy o smaku orzechowym','Plain':'naturalny','Vanilla':'waniliowy','Plus Omega-3 DHA':'z omega-3 DHA','Plus for Bone Health':'Plus for Bone Health','Plus Fiber':'z błonnikiem','Unsweetened':'niesłodzony','Coffee':'kawowy','Vanilla soy yogurt (family size)':'jogurt sojowy waniliowy, opakowanie rodzinne','Vanilla soy yogurt (single serving size)':'jogurt sojowy waniliowy, pojedyncza porcja','Plain soy yogurt':'jogurt sojowy naturalny','Strawberry soy yogurt':'jogurt sojowy truskawkowy','Key Lime soy yogurt':'jogurt sojowy limonkowy','Banana-Strawberry soy yogurt':'jogurt sojowy bananowo-truskawkowy','Original Creamer':'dodatek do kawy Original','French Vanilla Creamer':'dodatek do kawy waniliowy'};return `SILK · ${flavour[silk[1]]??silk[1]}`;}
 // Remaining unreviewed leading names are brands, culturally specific names or
 // scientific identities. Preserve them instead of guessing a different food.
 if(head)return s;
 if(/separable lean/.test(s))return (s.includes('boneless')?'bez kości · ':'')+(s.includes('and fat')?'mięso z tłuszczem':'samo chude mięso');
 if(/^trimmed to /.test(s))return 'warstwa tłuszczu: '+s.replace(/^trimmed to /,'').replace(/fat/g,'cala');
 const t=machine[s]||s;
 // A failed translation must never silently replace the identity of a food.
 if(t.split(/\s+/).length>s.split(/\s+/).length*2+5 || /unit synonyms|matching user input|City in|Przewodniczący|zmasakrow|molibden/.test(t))return s;
 return t;
}
const heads=new Set(before.map(p=>p.originalName.split(',')[0].trim()));
for(const p of before)for(const s of p.originalName.split(',').map(s=>s.trim()))phrases[s]=translate(s,heads.has(s));
fs.writeFileSync('scripts/usda-pl-legacy-phrases.json',JSON.stringify(phrases,null,2)+'\n');
const rows=before.map(p=>{
 const common={'Egg, whole, cooked, scrambled':'Jajecznica · całe jajko · po przygotowaniu','Egg, whole, cooked, omelet':'Omlet · całe jajko · po przygotowaniu','Egg, whole, cooked, fried':'Jajko sadzone · całe jajko · po przygotowaniu'};
 const name=common[p.originalName]??p.originalName.split(',').map(s=>phrases[s.trim()]).join(' · ');
 const breakfast=/\b(?:egg|eggs|oatmeal|oats|yogurt|pancake|pancakes|waffle|waffles|bread|rolls|cereals|bagel|croissant)\b/i.test(p.originalName.split(',')[0]);
 const dish=/\b(?:sandwich|pizza|soup|stew|lasagna|burrito|omelet|scrambled|pancakes|waffles|salad)\b/i.test(p.originalName);
 return {...p,name,kind:dish?'dish':'basic',tags:[...(breakfast?['breakfast']:[]),...(dish?['dishes']:[])]};
});
fs.writeFileSync('src/data/foods-usda-legacy.json',JSON.stringify(rows)+'\n');
const oldLabels=read('src/data/food-catalog-previous.json'),seenLabels=new Set(oldLabels.map(p=>p.id+'\0'+p.name));
for(let i=0;i<rows.length;i++)if(rows[i].name!==before[i].name&&!seenLabels.has(before[i].id+'\0'+before[i].name))oldLabels.push({id:before[i].id,name:before[i].name});
fs.writeFileSync('src/data/food-catalog-previous.json',JSON.stringify(oldLabels)+'\n');
const publication=read('public/data/foods-usda-legacy-cc0.json');
fs.writeFileSync('public/data/foods-usda-legacy-cc0.json',JSON.stringify({...publication,translation:'Polish phrase translations: reviewed food terminology plus local Argos en_pl 1.9 translation. English original descriptions retained. Nutrient values and source identifiers unchanged.',products:rows})+'\n');
console.log(JSON.stringify({translated:rows.length,reviewedTerms:dictionary.size,phrases:Object.keys(phrases).length,unchangedNutrients:rows.every((p,i)=>['id','kcal','protein','fat','carbs'].every(k=>p[k]===before[i][k]))}));
