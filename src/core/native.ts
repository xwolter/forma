import { Capacitor, registerPlugin } from "@capacitor/core";
import { Haptics, ImpactStyle } from "@capacitor/haptics";
import { LocalNotifications } from "@capacitor/local-notifications";
import { Filesystem, Directory, Encoding } from "@capacitor/filesystem";
import { Share } from "@capacitor/share";
import { KeepAwake } from "@capacitor-community/keep-awake";

const ExternalLinks = registerPlugin<{
  open(options: { url: string }): Promise<void>;
}>("ExternalLinks");
export function spotifyUrl(input: string) {
  const url = new URL(input || "https://open.spotify.com/genre/workout-page");
  if (
    url.protocol !== "https:" ||
    url.port ||
    url.hostname !== "open.spotify.com" ||
    !/^\/(playlist\/[A-Za-z0-9]{22}|genre\/workout-page)\/?$/.test(
      url.pathname,
    ) ||
    url.username ||
    url.password
  )
    throw new Error("Wklej link do playlisty z open.spotify.com/playlist/…");
  return url.origin + url.pathname;
}
export async function openSpotify(input = "") {
  await openExternal(spotifyUrl(input));
}
export async function openExternal(url: string) {
  const u = new URL(url);
    const approvedMedia=["open.spotify.com", "www.youtube.com", "youtube.com"].includes(u.hostname);
    const approvedAtlas=u.hostname==='www.fabrykasily.pl'&&(/^\/atlas-cwiczen(?:\/|$)/.test(u.pathname)||/^\/cwiczenia\//.test(u.pathname))&&!u.search&&!u.hash;
    if (
    u.protocol !== "https:" ||
    u.port ||
      !(approvedMedia||approvedAtlas) ||
    u.username ||
    u.password
  )
    throw new Error("Nieprawidłowy adres materiału.");
  if (isNative) await ExternalLinks.open({ url: u.href });
  else window.open(u.href, "_blank", "noopener,noreferrer");
}
export async function keepScreenAwake(enabled: boolean) {
  if (isNative) {
    if (enabled) await KeepAwake.keepAwake();
    else await KeepAwake.allowSleep();
  }
}
export async function scanFoodCode(): Promise<string | null> {
  if (!isNative)
    throw new Error(
      "Skaner działa w aplikacji Android. W podglądzie wpisz kod kreskowy w wyszukiwarce.",
    );
  const { BarcodeScanner, BarcodeFormat } =
    await import("@capacitor-mlkit/barcode-scanning");
  if (!(await BarcodeScanner.isSupported()).supported)
    throw new Error(
      "Skaner jest niedostępny na tym telefonie. Wpisz kod ręcznie.",
    );
  if (
    !(await BarcodeScanner.isGoogleBarcodeScannerModuleAvailable()).available
  ) {
    await BarcodeScanner.installGoogleBarcodeScannerModule();
    throw new Error(
      "Pobieranie modułu skanera Google. Połącz się z internetem i spróbuj ponownie za chwilę. Kod możesz też wpisać ręcznie.",
    );
  }
  try {
    const r = await BarcodeScanner.scan({
      formats: [BarcodeFormat.Ean13, BarcodeFormat.Ean8, BarcodeFormat.UpcA, BarcodeFormat.QrCode, BarcodeFormat.DataMatrix, BarcodeFormat.Code128, BarcodeFormat.Itf],
      autoZoom: true,
    });
    return r.barcodes[0]?.rawValue ?? null;
  } catch (e) {
    if (/cancel/i.test(String(e))) return null;
    throw new Error(
      "Nie udało się uruchomić aparatu. Sprawdź usługi Google lub wpisz kod ręcznie.",
    );
  }
}

export async function scanFoodImage(file: File): Promise<string[]> {
  if (file.size > 12 * 1024 * 1024 || !['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) throw new Error('Wybierz zdjęcie JPG, PNG lub WebP do 12 MB.');
  const { BarcodeScanner, BarcodeFormat } = await import('@capacitor-mlkit/barcode-scanning');
  const formats = [BarcodeFormat.Ean13, BarcodeFormat.Ean8, BarcodeFormat.UpcA, BarcodeFormat.QrCode, BarcodeFormat.DataMatrix, BarcodeFormat.Code128, BarcodeFormat.Itf];
  if (!isNative) {
    const { decodeFoodImage } = await import('./scanImage');
    return decodeFoodImage(file);
  }
  const path = 'food-code-' + crypto.randomUUID() + '.' + (file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg');
  try {
    const base64 = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader(); reader.onload = () => resolve(String(reader.result).split(',')[1]); reader.onerror = () => reject(new Error('Nie udało się odczytać zdjęcia.')); reader.readAsDataURL(file);
    });
    const saved = await Filesystem.writeFile({ path, data: base64, directory: Directory.Cache });
    const result = await BarcodeScanner.readBarcodesFromImage({ path: saved.uri, formats }).catch(()=>{throw new Error('Nie udało się odczytać kodu ze zdjęcia. Zrób wyraźniejsze zdjęcie lub wpisz numer z opakowania.');});
    return result.barcodes.map(b => b.rawValue).filter(Boolean);
  } finally { await Filesystem.deleteFile({ path, directory: Directory.Cache }).catch(() => undefined); }
}

export const isNative = Capacitor.isNativePlatform();
export async function haptic(enabled: boolean) {
  if (!enabled) return;
  try {
    if (isNative) await Haptics.impact({ style: ImpactStyle.Light });
    else navigator.vibrate?.(25);
  } catch {
    /* Optional hardware feedback. */
  }
}
export async function notificationPermission() {
  if (!isNative) return false;
  const p = await LocalNotifications.requestPermissions();
  return p.display === "granted";
}
export async function scheduleRest(end: number, enabled: boolean) {
  if (!isNative) return;
  await LocalNotifications.cancel({ notifications: [{ id: 101 }] });
  if (!enabled || end <= Date.now()) return;
  const permission = await LocalNotifications.checkPermissions();
  if (permission.display !== "granted") return;
  await LocalNotifications.schedule({
    notifications: [
      {
        id: 101,
        title: "Przerwa zakończona",
        body: "Wróć do treningu, kiedy będziesz gotowy.",
        schedule: { at: new Date(end) },
        channelId: "forma-rest",
      },
    ],
  });
}
export async function setupNotifications() {
  if (isNative)
    await LocalNotifications.createChannel({
      id: "forma-rest",
      name: "Timer przerwy",
      description: "Zakończenie przerwy w treningu",
      importance: 4,
      visibility: 0,
      vibration: true,
    });
}
export async function exportFile(
  filename: string,
  text: string,
  mime = "application/json",
) {
  if (isNative) {
    const result = await Filesystem.writeFile({
      path: filename,
      data: text,
      directory: Directory.Cache,
      encoding: Encoding.UTF8,
    });
    await Share.share({
      title: "Kopia danych FORMA",
      files: [result.uri],
      dialogTitle: "Zapisz kopię FORMA",
    });
  } else {
    const url = URL.createObjectURL(new Blob([text], { type: mime }));
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}
