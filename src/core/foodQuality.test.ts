import 'fake-indexeddb/auto';
import {beforeEach,describe,it,expect} from 'vitest';
import {foodCode,sameFoodCode} from './foodCode';
import {safeProductPhoto,referencePhoto,FOOD_PHOTOS} from './foodPhotos';
import {foodFromOFF} from './offProduct';
import {validFoodImage} from './foodImage';
import {readFileSync} from 'node:fs';
import {MultiFormatWriter,BarcodeFormat} from '@zxing/library';
import {decodeFoodPixels} from './scanImage';
import {productHistory,discoverFoods} from './foodDiscovery';
import {clearAll,commit,dbPromise,loadData,seedCatalog,backupData,validateBackup} from './db';
import legacy from '../data/foods-usda-legacy.json';
import previous from '../data/food-catalog-previous.json';
import photos from '../data/food-photo-products.json';
import packaged from '../data/foods-pl.json';
import {stamp} from './catalog';
import type {FoodEntry,Product} from './types';
const ean='5900531000010';
beforeEach(clearAll);
describe('grocery product identity from EAN and QR',()=>{
 it('reads raw EAN, GS1 Digital Link, OFF links and explicit retailer EAN without opening URLs',()=>{
  for(const text of [ean,'590 0531 000010','https://id.gs1.org/01/0'+ean+'/10/batch-17','(01)0'+ean+'(17)281231',']C1010'+ean+'\x1d10LOT','https://pl.openfoodfacts.org/produkt/'+ean+'/twarog','https://www.lidl.pl/p/produkt?ean='+ean])expect(foodCode(text)).toBe(ean);
 });
 it('normalizes padded EAN8 and UPC but retains nonzero packaging indicators',()=>{
  expect(sameFoodCode('54491472','00000054491472')).toBe(true);
  expect(sameFoodCode('012345678905','0012345678905')).toBe(true);
 });
 it('rejects coupons, invalid check digits, oversized text and executable or deceptive links',()=>{
  for(const raw of ['5900531000011','00000000','https://lidl.pl/coupon/12345','javascript:alert(1)','https://pl.openfoodfacts.org.evil.example/product/'+ean,'https://user:pass@pl.openfoodfacts.org/product/'+ean,'http://pl.openfoodfacts.org/product/'+ean,'https://127.0.0.1/01/0'+ean,'x'.repeat(2049)])expect(()=>foodCode(raw)).toThrow();
 });
 it('decodes the actual pixels of a QR image, then resolves its GTIN to an offline product',()=>{
  const text='https://id.gs1.org/01/0'+ean;
  const matrix=new MultiFormatWriter().encode(text,BarcodeFormat.QR_CODE,360,360,new Map());
  const rgba=new Uint8ClampedArray(360*360*4);
  for(let y=0;y<360;y++)for(let x=0;x<360;x++){const i=(y*360+x)*4;rgba[i]=rgba[i+1]=rgba[i+2]=matrix.get(x,y)?0:255;rgba[i+3]=255;}
  const found=decodeFoodPixels(rgba,360,360);expect(found).toEqual([text]);
  expect(packaged.find(p=>sameFoodCode(p.barcode,foodCode(found[0])))).toBeTruthy();
  expect(decodeFoodPixels(new Uint8ClampedArray(100*100*4).fill(255),100,100)).toEqual([]);
 });
});
describe('food photo identity rather than ingredient guessing',()=>{
 it('accepts a real bounded JPEG and rejects forged image data or a decompression bomb header',()=>{
  const bytes=readFileSync('public/images/products/5900531000010.jpg');
  expect(validFoodImage('data:image/jpeg;base64,'+bytes.toString('base64'))).toBe(true);
  expect(validFoodImage('data:image/jpeg;base64,/9j/AAAA')).toBe(false);
  const huge=Buffer.from([255,216,255,192,0,17,8,255,255,255,255,3,1,17,0,2,17,0,3,17,0,255,217]);
  expect(validFoodImage('data:image/jpeg;base64,'+huge.toString('base64'))).toBe(false);
 });
 it('distinguishes raw eggs, omelet, scrambled eggs and the combined USDA source description',()=>{
  const p=(originalName:string)=>({name:'',originalName,barcode:''});
  expect(referencePhoto(p('Egg, whole, raw, fresh'))).toEqual([4]);
  expect(referencePhoto(p('Egg, whole, cooked, omelet'))).toEqual([1]);
  expect(referencePhoto(p('Egg, whole, cooked, scrambled'))).toEqual([0]);
  expect(referencePhoto(p('Egg omelet or scrambled egg, made with butter'))).toEqual([0,1]);
  expect(referencePhoto(p('Egg white, omelet, scrambled, or fried'))).toEqual([]);
 });
 it('does not assign a cooked chicken meal to dry rice, a raw egg to an omelet, or yogurt to cottage cheese',()=>{
  expect(referencePhoto({name:'Ryż biały',barcode:''})).toEqual([16]);
  expect(referencePhoto({name:'Jajko',barcode:''})).toEqual([4]);
  expect(referencePhoto({name:'Twaróg',barcode:''})).toEqual([128]);
  expect(referencePhoto({name:'Serek wiejski',barcode:''})).toEqual([8]);
  expect(referencePhoto({name:'Skyr naturalny',barcode:''})).toEqual([129]);
  expect(referencePhoto({name:'Omlet',barcode:ean})).toEqual([]);
  expect(referencePhoto({name:'Moja zupa z ryżem i kurczakiem',barcode:''})).toEqual([]);
 });
 it('permits only a real OFF image path belonging to the scanned product, including padded short codes',()=>{
  const url='https://images.openfoodfacts.org/images/products/590/053/100/0010/front_pl.12.200.jpg';
  expect(safeProductPhoto(url,ean)).toBe(url);
  expect(safeProductPhoto('https://images.openfoodfacts.org/images/products/000/005/449/1472/front_en.801.200.jpg','54491472')).toBeTruthy();
  for(const bad of [url.replace('0010','0011'),url.replace('images.openfoodfacts.org','images.openfoodfacts.org.evil.example'),url+'?tracking=x','data:image/svg+xml,<svg/>','javascript:alert(1)'])expect(safeProductPhoto(bad,ean)).toBeUndefined();
 });
 it('has all local packaged photos and bounded illustration identities',()=>{
  expect(photos).toHaveLength(packaged.length);expect(new Set(photos).size).toBe(packaged.length);
  for(const p of packaged)expect(safeProductPhoto(p.imageUrl,p.barcode)).toBeTruthy();
  for(const p of legacy)for(const key of referencePhoto(p as Product))expect(key>=0&&key<FOOD_PHOTOS.length).toBe(true);
 });
 it('adds product images without changing validated nutrients',()=>{
  const raw={code:ean,product_name:'Twaróg',image_front_small_url:'https://images.openfoodfacts.org/images/products/590/053/100/0010/front_pl.12.200.jpg',nutriments:{'energy-kcal_100g':100,proteins_100g:12,fat_100g:2,carbohydrates_100g:4}};
  expect(foodFromOFF(raw)).toMatchObject({name:'Twaróg',kcal:100,protein:12,imageUrl:raw.image_front_small_url});
 });
});
describe('upgrading translated labels and repeat meal discovery',()=>{
 it('keeps food identities and brand names instead of hallucinating unrelated translation text',()=>{
  const text=legacy.map(p=>p.name).join('\n');
  expect(text).not.toMatch(/City in Germany|Agave Przewodniczący|ręcznie zmasakrowana|unit synonyms|NAKŁAD OBJĘTY POSTĘPOWANIEM/);
  expect(legacy.find(p=>p.originalName==='Abiyuch, raw')?.name).toContain('Abiyuch (owoc)');
  expect(legacy.find(p=>p.originalName.startsWith('Agave, raw'))?.name).toContain('Agawa');
 });
 it('updates old upstream names while preserving favourites, corrected nutrition, custom names and past food snapshots',async()=>{
  const ref=legacy.find(p=>p.id==='usda-172187')!;const old=previous.find(p=>p.id===ref.id)!;
  const custom={...legacy[0],name:'Moja specjalna nazwa',favorite:true} as Product;
  const diary={...stamp('saved'),date:'2026-10-24',meal:'Śniadanie',name:old.name,brand:'',productId:ref.id,recipeVersion:null,grams:100,unit:'g',nutrients:{kcal:149,protein:9.99,fat:11,carbs:1.61},status:'consumed',quick:false} as FoodEntry;
  await commit([{table:'products',value:{...ref,name:old.name,kcal:150,favorite:true} as Product},{table:'products',value:custom},{table:'food',value:diary}]);
  await seedCatalog();const data=await loadData();
  expect(data.products.find(p=>p.id===ref.id)).toMatchObject({name:ref.name,kcal:150,favorite:true});
  expect(data.products.find(p=>p.id===custom.id)?.name).toBe(custom.name);
  expect(data.food[0]).toEqual(diary);await seedCatalog();expect((await loadData()).food[0]).toEqual(diary);
 });
 it('searches foods actually eaten at breakfast and ranks the named dish before ingredient mentions',()=>{
  const base={...stamp('a'),name:'Jajecznica',brand:'',productId:'egg',recipeVersion:null,grams:100,unit:'g',nutrients:{kcal:100,protein:null,fat:null,carbs:null},status:'consumed',quick:false} as const;
  const entries=[{...base,id:'a',date:'2026-10-10',meal:'Śniadanie'},{...base,id:'b',productId:'other',date:'2026-10-24',meal:'Obiad'},{...base,id:'c',productId:'future',date:'2026-10-25',meal:'Śniadanie'}] as FoodEntry[];
  const history=productHistory(entries.filter(e=>e.meal==='Śniadanie'),'2026-10-24');
  expect([...history.keys()]).toEqual(['egg']);
  const products=[{...legacy[0],id:'egg',name:'Jajecznica'},{...legacy[1],id:'other',name:'Białko jaja · omlet · jajecznica'}] as Product[];
  expect(discoverFoods(products,history,'meal','jajecznica').map(p=>p.id)).toEqual(['egg']);
  expect(discoverFoods(products,new Map(),'all','jajecznica')[0].id).toBe('egg');
 });
 it('rejects unsafe own-photo data during import',async()=>{
  await seedCatalog();const data=backupData(await loadData());
  data.profiles=[{...stamp('profile'),name:'Tester',height:null,age:null,goal:'maintain',days:3,equipmentId:'gym',theme:'light',waterGoal:null,haptics:false,timerSound:false,notifications:false,demo:false}];
  expect(()=>validateBackup({format:'forma-backup',version:1,data})).not.toThrow();
  for(const photoData of ['data:image/svg+xml,<svg onload=alert(1)>','https://evil.example/photo.jpg','data:image/jpeg;base64,'+'a'.repeat(180001)]){
    const candidate={...data,products:[{...legacy[0],photoData}]};
    expect(()=>validateBackup({format:'forma-backup',version:1,data:candidate})).toThrow('zdjęcie');
  }
  expect(await (await dbPromise).get('meta','food-labels-photos-pl-v4')).toBe(true);
 });
});
