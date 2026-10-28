import "fake-indexeddb/auto";
import { beforeAll, afterAll, describe, it, expect, vi } from "vitest";
import { getAuth, connectAuthEmulator, applyActionCode } from "firebase/auth";
import {
  getFirestore,
  connectFirestoreEmulator,
  terminate,
  doc,
  setDoc,
  serverTimestamp,
  deleteDoc,
} from "firebase/firestore";
import { clearAll, commit, dbPromise, seedCatalog, updateDaily } from "./db";
import { stamp } from "./catalog";
import { beginSession, saveExerciseNote, saveSetDraft } from "./workouts";
vi.mock("./cloudConfig", () => ({
  cloudConfig: {
    projectId: "demo-forma-private",
    apiKey: "demo-key",
    appId: "demo-forma-web",
  },
}));
import {
  createAccount,
  refreshAccount,
  createCloudBackup,
  listCloudBackups,
  readCloudBackup,
  login,
  logout,
} from "./cloud";
const enabled = Boolean(
  process.env.FIRESTORE_EMULATOR_HOST &&
  process.env.FIREBASE_AUTH_EMULATOR_HOST,
);
describe.skipIf(!enabled)("Firebase client with real local emulators", () => {
  beforeAll(async () => {
    connectAuthEmulator(getAuth(), "http://127.0.0.1:9095", {
      disableWarnings: true,
    });
    connectFirestoreEmulator(getFirestore(), "127.0.0.1", 8085);
    await fetch(
      "http://127.0.0.1:9095/emulator/v1/projects/demo-forma-private/accounts",
      { method: "DELETE" },
    );
    await clearAll();
    await seedCatalog();
    await updateDaily('2026-10-24', { appOpened: true });
    await commit([
      {
        table: "profiles",
        value: {
          ...stamp("me"),
          name: "Test",
          height: 180,
          age: 30,
          goal: "maintain",
          days: 3,
          equipmentId: "gym",
          theme: "light",
          waterGoal: 2500,
          haptics: true,
          timerSound: false,
          notifications: false,
          demo: false,
        },
      },
    ]);
    await saveExerciseNote("gym", "bench", "Siedzisko 4");
    const plans = await (await dbPromise).getAll("plans");
    plans[0].exercises[0].warmupRest = 30;
    await commit([{ table: "plans", value: plans[0] }]);
    const sessionId = await beginSession(plans[0], "2026-10-23", "gym", "Gym");
    const row = (await (await dbPromise).getAll("sets")).find(
      (s) => s.sessionId === sessionId,
    )!;
    await saveSetDraft(row.id, { weight: "42,5", reps: "10", rir: "" }, "work");
  });
  afterAll(async () => {
    await logout();
    await terminate(getFirestore());
  });
  async function verify(email: string) {
    const r = await fetch(
      "http://127.0.0.1:9095/emulator/v1/projects/demo-forma-private/oobCodes",
    );
    const data = await r.json();
    const code = data.oobCodes.find(
      (c: { email: string; requestType: string }) =>
        c.email === email && c.requestType === "VERIFY_EMAIL",
    );
    await applyActionCode(getAuth(), code.oobCode);
    return refreshAccount();
  }
  it("blocks weak passwords and unverified backup uploads", async () => {
    await expect(createAccount("alice@example.test", "short")).rejects.toThrow(
      "12",
    );
    await createAccount("alice@example.test", "Local-test-password-2026!");
    await expect(createCloudBackup()).rejects.toThrow("potwierdź");
    expect((await verify("alice@example.test"))?.verified).toBe(true);
  });
  it("round-trips a complete private snapshot with original record IDs", async () => {
    const b = await createCloudBackup();
    const all = await listCloudBackups();
    expect(all.find((x) => x.id === b.id)).toBeDefined();
    const data = await readCloudBackup(b);
    expect(data.profiles[0].name).toBe("Test");
    expect(data.daily.find(d => d.date === '2026-10-24')?.appOpened).toBe(true);
    expect(data.plans.length).toBe(3);
    // Unchanged public foods are re-seeded locally, not uploaded into private backups.
    expect(data.products).toEqual([]);
    expect(
      data.equipment.find((e) => e.id === "gym")!.exerciseNotes?.bench,
    ).toBe("Siedzisko 4");
    expect(data.sets.some((s) => s.draft?.weight === "42,5" && !s.done)).toBe(
      true,
    );
    expect(data.plans.some((p) => p.exercises[0]?.warmupRest === 30)).toBe(
      true,
    );
  });
  it("does not offer an interrupted upload for restore", async () => {
    const uid = getAuth().currentUser!.uid;
    await setDoc(doc(getFirestore(), "users", uid, "backups", "interrupted"), {
      version: 1,
      count: 10,
      createdAt: serverTimestamp(),
      complete: false,
    });
    expect((await listCloudBackups()).some((b) => b.id === "interrupted")).toBe(
      false,
    );
  });
  it("rejects a corrupt backup before changing any local entries", async () => {
    const uid = getAuth().currentUser!.uid;
    const ref = doc(getFirestore(), "users", uid, "backups", "broken");
    const createdAt = new Date().toISOString();
    await setDoc(ref, {
      version: 1,
      count: 2,
      createdAt: serverTimestamp(),
      complete: false,
    });
    await setDoc(ref, { complete: true }, { merge: true });
    await expect(
      readCloudBackup({ id: "broken", createdAt, count: 2, version: 1 }),
    ).rejects.toThrow("niekompletna");
    await deleteDoc(ref);
  });
  it("blocks accidental upload of another account local data", async () => {
    const originalOwner = await (await dbPromise).get("meta", "cloud-owner");
    expect(originalOwner).toBeTruthy();
    await createAccount("bob@example.test", "Another-local-test-2026!");
    await verify("bob@example.test");
    expect(await listCloudBackups()).toEqual([]);
    await expect(createCloudBackup()).rejects.toThrow("innego konta");
    await logout();
    await login("alice@example.test", "Local-test-password-2026!");
    expect((await listCloudBackups()).length).toBe(1);
  });
});
