import { BinaryBitmap, HybridBinarizer, RGBLuminanceSource, MultiFormatReader, BarcodeFormat, DecodeHintType } from '@zxing/library';

export function decodeFoodPixels(pixels: Uint8ClampedArray, width: number, height: number): string[] {
  const gray = new Uint8ClampedArray(width * height);
  for (let i = 0; i < gray.length; i++) gray[i] = (pixels[i * 4] + 2 * pixels[i * 4 + 1] + pixels[i * 4 + 2]) / 4;
  const hints = new Map();
  hints.set(DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.EAN_13, BarcodeFormat.EAN_8, BarcodeFormat.UPC_A, BarcodeFormat.QR_CODE, BarcodeFormat.DATA_MATRIX, BarcodeFormat.CODE_128, BarcodeFormat.ITF]);
  hints.set(DecodeHintType.TRY_HARDER, true);
  const reader = new MultiFormatReader();
  try {
    const result = reader.decode(new BinaryBitmap(new HybridBinarizer(new RGBLuminanceSource(gray, width, height))), hints);
    return [result.getText()];
  } catch { return []; } finally { reader.reset(); }
}

export async function decodeFoodImage(file: File): Promise<string[]> {
  const bitmap = await createImageBitmap(file).catch(()=>{throw new Error('Nie udało się odczytać zdjęcia kodu. Wybierz inny plik.');});
  try {
    if (bitmap.width * bitmap.height > 40_000_000) throw new Error('Zdjęcie ma zbyt dużą rozdzielczość. Wybierz mniejsze.');
    const scale = Math.min(1, 2000 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale); canvas.height = Math.round(bitmap.height * scale);
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) throw new Error('Nie udało się odczytać zdjęcia.');
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    return decodeFoodPixels(context.getImageData(0, 0, canvas.width, canvas.height).data, canvas.width, canvas.height);
  } finally { bitmap.close(); }
}
