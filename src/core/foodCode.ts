import { validBarcode } from './offProduct';

// Extract identity only. QR links are never opened or fetched.
export function foodCode(raw: string): string {
  const value = raw.trim();
  if (!value || value.length > 2048) throw new Error('Kod jest pusty lub zbyt długi.');
  let candidate = '';
  if (/^[\d\s]+$/.test(value) && [8,12,13,14].includes(value.replace(/\s/g, '').length)) candidate = value.replace(/\s/g, '');
  else {
    const gs1 = value.match(/^(?:\]C1|\]d2|\]Q3)?(?:\(01\)|01)(\d{14})(?=$|\x1d|\(|\d)/);
    if (gs1) candidate = gs1[1];
    else {
      try {
        const url = new URL(value);
        if (url.protocol !== 'https:' || url.username || url.password || url.port || !url.hostname.includes('.') || /^(?:localhost|127\.|192\.168\.|10\.)/.test(url.hostname)) throw new Error();
        const digitalLink = url.pathname.match(/^\/01\/(\d{14})(?:\/|$)/);
        const off = /^(?:world|pl|en|fr)\.openfoodfacts\.org$/.test(url.hostname)
          ? url.pathname.match(/^\/(?:product|produkt|produit)\/(\d{8,14})(?:\/|$)/) : null;
        const retail = /(^|\.)(?:lidl\.pl|biedronka\.pl|auchan\.pl|carrefour\.pl|kaufland\.pl|rossmann\.pl)$/.test(url.hostname);
        candidate = digitalLink?.[1] ?? off?.[1] ?? (retail ? url.searchParams.get('gtin') ?? url.searchParams.get('ean') ?? '' : '');
      } catch { /* Unrecognized text is not a food identifier. */ }
    }
  }
  if (!validBarcode(candidate) || /^0+$/.test(candidate)) throw new Error('Ten kod nie zawiera poprawnego kodu produktu EAN/GTIN. Kupon lub karta sklepu nie identyfikuje jedzenia. Zeskanuj kod kreskowy z opakowania.');
  // A leading zero pads a consumer GTIN; a nonzero packaging indicator is retained.
  const bare=candidate.replace(/^0+/,'');
  if(bare.length<=8)return bare.padStart(8,'0');
  if(bare.length<=13)return bare.padStart(13,'0');
  return candidate;
}

export function sameFoodCode(a: string, b: string) {
  try { return foodCode(a) === foodCode(b); } catch { return false; }
}
