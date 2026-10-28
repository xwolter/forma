import fs from 'node:fs';
import path from 'node:path';
const root=path.resolve(import.meta.dirname,'..');
const products=JSON.parse(fs.readFileSync(path.join(root,'src/data/foods-pl.json'),'utf8'));
const dir=path.join(root,'public/images/products');fs.mkdirSync(dir,{recursive:true});
const ok=[],fail=[];let next=0;
async function worker(){
 while(next<products.length){const p=products[next++];if(!p.imageUrl){fail.push(p.barcode);continue;}
  try{const file=path.join(dir,p.barcode+'.jpg');
   if(!fs.existsSync(file)){const r=await fetch(p.imageUrl,{headers:{'User-Agent':'FORMA/0.6 food-catalog'},signal:AbortSignal.timeout(20000)});if(!r.ok||!r.headers.get('content-type')?.includes('image/'))throw new Error('image unavailable');const bytes=Buffer.from(await r.arrayBuffer());if(bytes.length>1000000||bytes[0]!==255||bytes[1]!==216)throw new Error('invalid JPEG');fs.writeFileSync(file,bytes);}
   ok.push(p.barcode);
  }catch{fail.push(p.barcode);}
 }
}
await Promise.all([worker(),worker(),worker()]);
fs.writeFileSync(path.join(root,'src/data/food-photo-products.json'),JSON.stringify(ok.sort())+'\n');
fs.writeFileSync(path.join(root,'public/data/food-photo-credits.json'),JSON.stringify({source:'Open Food Facts contributors',license:'CC-BY-SA-3.0',licenseUrl:'https://creativecommons.org/licenses/by-sa/3.0/',photos:products.filter(p=>ok.includes(p.barcode)).map(p=>({code:p.barcode,name:p.name,source:p.imageUrl,product:p.sourceUrl}))},null,2)+'\n');
console.log(JSON.stringify({downloaded:ok.length,unavailable:fail}));
