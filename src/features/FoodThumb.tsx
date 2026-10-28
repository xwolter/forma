import { useState } from 'react';
import { Utensils } from '../ui/icons';
import { referencePhoto, referenceTile, safeProductPhoto, FOOD_PHOTOS } from '../core/foodPhotos';
import type { Product } from '../core/types';
import photoProducts from '../data/food-photo-products.json';
import { validFoodImage } from '../core/foodImage';

const localPhotos = new Set<string>(photoProducts);
const mealPhotos: Record<string, string> = {
  'meal-tosty-szynka-ser': '/images/meals/tosty-szynka-ser.png',
  'meal-2708331': '/images/meals/tosty-francuskie.png',
  'meal-2705801': '/images/meals/tosty-z-serem.png',
};
export function FoodThumb({name,product,photoKey,photoData}:{name:string;product?:Product;photoKey?:number;photoData?:string}) {
  const [failed, setFailed] = useState('');
  const code = product?.barcode ?? '';
  const ownPhoto = product?.photoData ?? photoData;
  const curatedPhoto = product ? mealPhotos[product.id] : undefined;
  const url = validFoodImage(ownPhoto) ? ownPhoto : curatedPhoto ?? (localPhotos.has(code) ? `/images/products/${code}.jpg` : safeProductPhoto(product?.imageUrl, code));
  const indexes = referencePhoto(product ?? { name, barcode:'', photoKey });
  const hasPhoto = Boolean(url && failed !== url);
  const caption = hasPhoto ? validFoodImage(ownPhoto) ? `Twoje zdjęcie: ${name}` : curatedPhoto ? `Ilustracja dania: ${name}` : `Opakowanie produktu ${name} · Open Food Facts` : indexes.length ? `Obraz poglądowy: ${indexes.map(i=>FOOD_PHOTOS[i]).join(' / ')}` : 'Brak potwierdzonego zdjęcia';
  return <span className={`food-thumb ${hasPhoto?'product-photo':indexes.length?'food-reference':'empty-thumb'}`} role="img" aria-label={caption} title={caption}>
    {hasPhoto ? <img src={url} alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer" onError={()=>setFailed(url!)}/> : indexes.length ? indexes.map(i=>{const tile=referenceTile(i);return <svg key={i} viewBox={`${tile.x} ${tile.y} ${tile.size} ${tile.size}`} preserveAspectRatio="xMidYMid slice" aria-hidden="true"><image href={tile.src} width="1254" height="1254"/></svg>;}) : <Utensils size={22}/>}
  </span>;
}
