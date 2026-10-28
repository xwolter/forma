export function validFoodImage(data: unknown): data is string {
  if(typeof data !== 'string' || data.length>180000 || !/^data:image\/jpeg;base64,\/9j\/[A-Za-z0-9+/]+={0,2}$/.test(data))return false;
  try {
    const bytes=atob(data.slice(23));
    if(bytes.charCodeAt(bytes.length-2)!==255||bytes.charCodeAt(bytes.length-1)!==217)return false;
    let offset=2;
    while(offset+8<bytes.length){
      if(bytes.charCodeAt(offset)!==255)return false;
      const marker=bytes.charCodeAt(offset+1),length=bytes.charCodeAt(offset+2)*256+bytes.charCodeAt(offset+3);
      if([192,193,194].includes(marker)){
        const height=bytes.charCodeAt(offset+5)*256+bytes.charCodeAt(offset+6),width=bytes.charCodeAt(offset+7)*256+bytes.charCodeAt(offset+8);
        return width>0&&height>0&&width<=640&&height<=640;
      }
      if(length<2||marker===218)return false;
      offset+=length+2;
    }
  } catch { return false; }
  return false;
}

export async function prepareFoodImage(file: File): Promise<string> {
  if (!['image/jpeg','image/png','image/webp'].includes(file.type) || file.size>12*1024*1024) throw new Error('Wybierz zdjęcie JPG, PNG lub WebP do 12 MB.');
  const bitmap=await createImageBitmap(file).catch(()=>{throw new Error('Plik nie jest poprawnym zdjęciem. Wybierz inne zdjęcie JPG, PNG lub WebP.');});
  try {
    if(bitmap.width*bitmap.height>40_000_000)throw new Error('Zdjęcie jest za duże. Wybierz mniejszą rozdzielczość.');
    const scale=Math.min(1,640/Math.max(bitmap.width,bitmap.height));
    const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(bitmap.width*scale));canvas.height=Math.max(1,Math.round(bitmap.height*scale));
    const context=canvas.getContext('2d');if(!context)throw new Error('Nie udało się przygotować zdjęcia.');
    context.fillStyle='#ffffff';context.fillRect(0,0,canvas.width,canvas.height);context.drawImage(bitmap,0,0,canvas.width,canvas.height);
    // Re-encoding drops EXIF metadata and never stores the original full-size file.
    for(const quality of [0.8,0.65,0.45]){const data=canvas.toDataURL('image/jpeg',quality);if(validFoodImage(data))return data;}
    throw new Error('Nie udało się zmniejszyć zdjęcia. Wybierz prostsze ujęcie.');
  } finally { bitmap.close(); }
}
