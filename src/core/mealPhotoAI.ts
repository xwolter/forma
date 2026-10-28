import { getApps } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFunctions, httpsCallableFromURL } from 'firebase/functions';

export type MealPhotoEstimate = {
  name: string;
  grams: number;
  kcal: number;
  protein: number | null;
  fat: number | null;
  carbs: number | null;
  confidence: 'low' | 'medium' | 'high';
  components: { name: string; grams: number }[];
  uncertainty: string;
};

function validEstimate(value: unknown): value is MealPhotoEstimate {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return typeof v.name === 'string' && v.name.length > 0 &&
    typeof v.grams === 'number' && Number.isFinite(v.grams) && v.grams >= 10 && v.grams <= 3000 &&
    typeof v.kcal === 'number' && Number.isFinite(v.kcal) && v.kcal > 0 && v.kcal <= 10000 &&
    Array.isArray(v.components) && typeof v.uncertainty === 'string';
}

async function readImage(file: File): Promise<{ imageBase64: string; mimeType: string }> {
  if (!file.type.startsWith('image/')) throw new Error('Wybierz plik ze zdjęciem.');
  if (file.size > 15 * 1024 * 1024) throw new Error('Zdjęcie jest za duże. Wybierz plik do 15 MB.');
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    const scale = Math.min(1, 1440 / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
    canvas.getContext('2d', { alpha: false })?.drawImage(img, 0, 0, canvas.width, canvas.height);
    const imageBase64 = canvas.toDataURL('image/jpeg', 0.82).split(',')[1];
    if (!imageBase64 || imageBase64.length > 5_600_000) throw new Error('Nie udało się zmniejszyć zdjęcia. Spróbuj ponownie.');
    return { imageBase64, mimeType: 'image/jpeg' };
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('Nie udało')) throw error;
    throw new Error('Nie udało się otworzyć zdjęcia. Wybierz JPG, PNG lub WebP.');
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function recognizeMealPhoto(file: File): Promise<MealPhotoEstimate> {
  await import('./cloud');
  const app = getApps()[0];
  const auth = app ? getAuth(app) : null;
  await auth?.authStateReady();
  const user = auth?.currentUser;
  if (!user || !user.emailVerified) throw new Error('Zaloguj się na potwierdzone konto FORMA w profilu, aby analizować zdjęcia.');
  if (navigator.onLine === false) throw new Error('Połącz się z internetem, aby rozpoznać posiłek.');
  const image = await readImage(file);
  try {
    const call = httpsCallableFromURL<typeof image, MealPhotoEstimate>(
      getFunctions(app, 'europe-central2'),
      'https://forma-mobi-2026-4e7c1a.web.app/api/recognizeMeal',
      { timeout: 100_000 },
    );
    const response = await call(image);
    if (!validEstimate(response.data)) throw new Error('Otrzymano niepełny wynik. Spróbuj ponownie.');
    return response.data;
  } catch (error) {
    const code = (error as { code?: string }).code;
    if (code === 'functions/permission-denied' || code === 'functions/unauthenticated') throw new Error('Zaloguj się na potwierdzone konto FORMA w profilu.');
    if (code === 'functions/resource-exhausted') throw new Error((error as Error).message || 'Osiągnięto limit analiz zdjęć.');
    if (code === 'functions/failed-precondition') throw new Error((error as Error).message || 'Nie rozpoznano jedzenia na zdjęciu.');
    if (code === 'functions/unavailable' || code === 'functions/deadline-exceeded') throw new Error('Usługa rozpoznawania jest chwilowo niedostępna. Spróbuj później.');
    if (code === 'functions/internal' && /\[0\]/.test((error as Error).message)) throw new Error('Telefon nie może połączyć się z analizą zdjęcia. Sprawdź internet, VPN lub blokadę reklam i spróbuj ponownie.');
    throw error;
  }
}
