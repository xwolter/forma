import { backupData } from './db';
import { initializeApp } from "firebase/app";
import {
  createUserWithEmailAndPassword,
  getAuth,
  onIdTokenChanged,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
  type User,
} from "firebase/auth";
import {
  collection,
  doc,
  getDocs,
  initializeFirestore,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  writeBatch,
  limit,
  where,
  documentId,
  startAfter,
  type QueryDocumentSnapshot,
} from "firebase/firestore";
import { cloudConfig } from "./cloudConfig";
import { dbPromise, emptyData, loadData, TABLES, validateBackup } from "./db";
import type { AppData, TableName } from "./types";

export type CloudAccount = { uid: string; email: string; verified: boolean };
export type CloudBackup = {
  id: string;
  createdAt: string;
  count: number;
  version: 1;
};
const app = cloudConfig ? initializeApp(cloudConfig) : null;
const auth = app ? getAuth(app) : null;
// Long polling also works on mobile networks and WebViews with restrictive proxies.
const firestore = app
  ? initializeFirestore(app, { experimentalAutoDetectLongPolling: true })
  : null;
if (auth) auth.languageCode = "pl";
const snapshot = (u: User | null): CloudAccount | null =>
  u ? { uid: u.uid, email: u.email ?? "", verified: u.emailVerified } : null;
export const observeAccount = (change: (a: CloudAccount | null) => void) =>
  auth ? onIdTokenChanged(auth, (u) => change(snapshot(u))) : () => {};
export async function login(email: string, password: string) {
  if (!auth) throw new Error("Firebase nie jest jeszcze podłączony.");
  await signInWithEmailAndPassword(auth, email.trim(), password);
}
export async function createAccount(email: string, password: string) {
  if (!auth) throw new Error("Firebase nie jest jeszcze podłączony.");
  if (password.length < 12)
    throw new Error("Użyj hasła mającego co najmniej 12 znaków.");
  const result = await createUserWithEmailAndPassword(
    auth,
    email.trim(),
    password,
  );
  await sendEmailVerification(result.user);
}
export async function refreshAccount() {
  await auth?.currentUser?.reload();
  await auth?.currentUser?.getIdToken(true);
  return snapshot(auth?.currentUser ?? null);
}
export async function resendVerification() {
  if (auth?.currentUser) await sendEmailVerification(auth.currentUser);
}
export async function resetPassword(email: string) {
  if (!auth) throw new Error("Firebase nie jest jeszcze podłączony.");
  if (!email.includes("@")) throw new Error("Wpisz e-mail konta.");
  await sendPasswordResetEmail(auth, email.trim());
}
export async function logout() {
  if (auth) await signOut(auth);
}
function requireOwner() {
  const user = auth?.currentUser;
  if (!user || !firestore)
    throw new Error("Zaloguj się, aby użyć kopii w chmurze.");
  if (!user.emailVerified) throw new Error("Najpierw potwierdź adres e-mail.");
  return { uid: user.uid, db: firestore };
}
export async function createCloudBackup() {
  if (typeof navigator !== "undefined" && navigator.onLine === false)
    throw new Error(
      "Połącz się z internetem, aby utworzyć kopię. Dane telefonu są zachowane.",
    );
  const { uid, db } = requireOwner();
  const local = await dbPromise;
  const ownership = local.transaction("meta", "readwrite");
  const owner = await ownership.store.get("cloud-owner");
  if (owner && owner !== uid) {
    await ownership.done;
    throw new Error(
      "Dane na telefonie są przypisane do innego konta. Najpierw wyeksportuj je i przejdź na własny profil lub przywróć kopię tego konta.",
    );
  }
  await ownership.store.put(uid, "cloud-owner");
  await ownership.done;
  const data = backupData(await loadData());
  validateBackup({ format: "forma-backup", version: 1, data });
  const records = TABLES.flatMap((table) =>
    data[table].map((value) => ({ table, payload: JSON.stringify(value) })),
  );
  if (
    records.some((r) => r.payload.length > 100000) ||
    records.reduce(
      (total, r) => total + new TextEncoder().encode(r.payload).byteLength,
      0,
    ) >
      20 * 1024 * 1024
  )
    throw new Error(
      "Kopia jest zbyt duża dla chmury. Użyj eksportu JSON z ustawień.",
    );
  if (records.length > 20000)
    throw new Error(
      "Ta kopia jest duża. Użyj eksportu JSON; limit kopii chmurowej to 20 000 rekordów.",
    );
  const id = crypto.randomUUID();
  const manifest = doc(db, "users", uid, "backups", id);
  const createdAt = new Date().toISOString();
  await setDoc(manifest, {
    version: 1,
    createdAt: serverTimestamp(),
    count: records.length,
    complete: false,
  });
  // An incomplete upload is never offered as a restorable backup.
  for (let offset = 0; offset < records.length; offset += 400) {
    const batch = writeBatch(db);
    for (let i = offset; i < Math.min(offset + 400, records.length); i++)
      batch.set(
        doc(manifest, "records", String(i)),
        JSON.parse(JSON.stringify(records[i])),
      );
    await batch.commit();
  }
  await setDoc(manifest, { complete: true }, { merge: true });
  await local.put("meta", uid, "cloud-owner");
  await local.put("meta", createdAt, "cloud-last-backup");
  return { id, createdAt, count: records.length, version: 1 as const };
}
export async function listCloudBackups(): Promise<CloudBackup[]> {
  const { uid, db } = requireOwner();
  const rows = await getDocs(
    query(
      collection(db, "users", uid, "backups"),
      where("complete", "==", true),
      orderBy("createdAt", "desc"),
      limit(10),
    ),
  );
  return rows.docs.flatMap((d) => {
    const r = d.data();
    return r.complete === true && r.version === 1
      ? [
          {
            id: d.id,
            createdAt: r.createdAt.toDate().toISOString(),
            count: Number(r.count),
            version: 1 as const,
          },
        ]
      : [];
  });
}
export async function readCloudBackup(backup: CloudBackup): Promise<AppData> {
  const { uid, db } = requireOwner();
  const data = emptyData();
  let last: QueryDocumentSnapshot | undefined;
  let count = 0;
  let bytes = 0;
  if (
    !Number.isInteger(backup.count) ||
    backup.count < 1 ||
    backup.count > 20000
  )
    throw new Error("Nieprawidłowa kopia.");
  const ref = collection(db, "users", uid, "backups", backup.id, "records");
  while (true) {
    const page = await getDocs(
      last
        ? query(ref, orderBy(documentId()), startAfter(last), limit(400))
        : query(ref, orderBy(documentId()), limit(400)),
    );
    for (const row of page.docs) {
      const r = row.data();
      count++;
      if (
        !TABLES.includes(r.table as TableName) ||
        typeof r.payload !== "string" ||
        r.payload.length > 100000 ||
        count > backup.count
      )
        throw new Error("Nieprawidłowa kopia.");
      bytes += new TextEncoder().encode(r.payload).byteLength;
      if (bytes > 20 * 1024 * 1024)
        throw new Error("Kopia jest zbyt duża. Nie zmieniono danych telefonu.");
      (data[r.table as TableName] as unknown[]).push(JSON.parse(r.payload));
    }
    if (page.size < 400) break;
    last = page.docs[page.docs.length - 1];
  }
  if (count !== backup.count)
    throw new Error("Kopia jest niekompletna. Nie zmieniono danych telefonu.");
  return validateBackup({ format: "forma-backup", version: 1, data });
}
export function cloudError(error: unknown) {
  const code = (error as { code?: string })?.code ?? "";
  if (code === "auth/email-already-in-use")
    return "Nie można utworzyć konta. Spróbuj logowania lub odzyskania hasła.";
  if (code.startsWith("auth/"))
    return "Nie udało się zalogować. Sprawdź e-mail, hasło i połączenie. Po wielu próbach odczekaj chwilę.";
  if (code === "permission-denied")
    return "Brak dostępu do kopii. Sprawdź potwierdzenie e-maila i konfigurację projektu.";
  if (code === "resource-exhausted")
    return "Osiągnięto limit usługi. Dane telefonu są zachowane; użyj eksportu JSON.";
  return error instanceof Error
    ? error.message
    : "Nie udało się połączyć z chmurą. Dane na telefonie są zachowane.";
}
