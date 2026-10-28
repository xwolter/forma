import { createRequire } from "node:module";
import fs from "node:fs";
import { test, before, after, beforeEach } from "node:test";
const require = createRequire(
  new URL("../../.tools/firebase-testing/package.json", import.meta.url),
);
const {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
} = require("@firebase/rules-unit-testing");
const {
  doc,
  setDoc,
  getDoc,
  getDocs,
  collection,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  Timestamp,
  query,
  limit,
  where,
  orderBy,
  deleteField,
} = require("firebase/firestore");
let env, a, b, anonymous, unverified;
before(async () => {
  env = await initializeTestEnvironment({
    projectId: "demo-forma-private",
    firestore: {
      host: "127.0.0.1",
      port: 8085,
      rules: fs.readFileSync("firebase/firestore.rules", "utf8"),
    },
  });
  a = env
    .authenticatedContext("alice", {
      email: "alice@example.test",
      email_verified: true,
    })
    .firestore();
  b = env
    .authenticatedContext("bob", {
      email: "bob@example.test",
      email_verified: true,
    })
    .firestore();
  unverified = env
    .authenticatedContext("new", {
      email: "new@example.test",
      email_verified: false,
    })
    .firestore();
  anonymous = env.unauthenticatedContext().firestore();
});
after(async () => {
  await env?.cleanup();
});
beforeEach(async () => {
  await env.clearFirestore();
});
const manifest = () => ({
  version: 1,
  createdAt: serverTimestamp(),
  count: 2,
  complete: false,
});
const value = {
  table: "food",
  payload: JSON.stringify({
    id: "food1",
    schemaVersion: 1,
    name: "Synthetic meal",
    kcal: 300,
  }),
};
const parent = (db) => doc(db, "users/alice/backups/one");
const record = (db, id = "0") =>
  doc(db, `users/alice/backups/one/records/${id}`);
async function draft() {
  await setDoc(parent(a), manifest());
}
test("verified owner creates and reads a private backup", async () => {
  await assertSucceeds(setDoc(parent(a), manifest()));
  await assertSucceeds(getDoc(parent(a)));
});
test("another account cannot read or list owner backups", async () => {
  await draft();
  await assertFails(getDoc(parent(b)));
  await assertFails(
    getDocs(query(collection(b, "users/alice/backups"), limit(10))),
  );
});
test("another account cannot forge owner writes or delete them", async () => {
  await draft();
  await assertFails(setDoc(doc(b, "users/alice/backups/forged"), manifest()));
  await assertFails(deleteDoc(parent(b)));
});
test("unauthenticated reads and writes are denied", async () => {
  await assertFails(
    getDocs(query(collection(anonymous, "users/alice/backups"), limit(10))),
  );
  await assertFails(setDoc(parent(anonymous), manifest()));
});
test("unverified email cannot upload", async () => {
  await assertFails(setDoc(doc(unverified, "users/new/backups/x"), manifest()));
});
test("record ownership is private even when its exact path is known", async () => {
  await draft();
  await setDoc(record(a), value);
  await assertFails(getDoc(record(b)));
  await assertFails(setDoc(record(b, "1"), value));
  await assertFails(deleteDoc(record(b)));
});
test("unknown collections and malformed manifests are rejected", async () => {
  await assertFails(setDoc(doc(a, "public/one"), { private: "data" }));
  for (const change of [
    { count: 50000 },
    { count: -1 },
    { count: 1.5 },
    { count: "2" },
    { extra: "unapproved" },
    { version: 2 },
  ])
    await assertFails(setDoc(parent(a), { ...manifest(), ...change }));
});
test("only supported record tables can enter a draft", async () => {
  await draft();
  await assertFails(setDoc(record(a), { ...value, table: "admins" }));
  await assertFails(setDoc(record(a), { table: "food", value: { id: "x" } }));
});
test("complete snapshots cannot be updated or their records independently deleted", async () => {
  await draft();
  await setDoc(record(a), value);
  await assertSucceeds(updateDoc(parent(a), { complete: true }));
  await assertFails(updateDoc(parent(a), { count: 3 }));
  await assertFails(setDoc(record(a, "1"), value));
  await assertFails(updateDoc(record(a), { payload: "changed" }));
  await assertFails(deleteDoc(record(a)));
});
test("1MB string payloads and non-string payloads are denied", async () => {
  await draft();
  for (const payload of ["x".repeat(100001), {}, [], 0, null, ""])
    await assertFails(setDoc(record(a), { table: "food", payload }));
});
test("unknown record fields cannot smuggle authority or extra data", async () => {
  await draft();
  await assertFails(setDoc(record(a), { ...value, isAdmin: true }));
  await assertFails(setDoc(record(a), { ...value, ownerId: "bob" }));
});
test("record slot must fit the declared count and be canonical numeric", async () => {
  await draft();
  for (const id of ["2", "20000", "00", "-1", "other-user"])
    await assertFails(setDoc(record(a, id), value));
  await assertSucceeds(setDoc(record(a, "1"), value));
});
test("server time is required at creation", async () => {
  for (const createdAt of [
    "2026-10-23",
    Timestamp.fromMillis(0),
    Timestamp.fromMillis(Date.now() + 86400000),
  ])
    await assertFails(setDoc(parent(a), { ...manifest(), createdAt }));
});
test("manifest required fields cannot be omitted or removed later", async () => {
  const missing = manifest();
  delete missing.count;
  await assertFails(setDoc(parent(a), missing));
  await draft();
  await assertFails(
    updateDoc(parent(a), { createdAt: deleteField(), complete: true }),
  );
});
test("timestamps and counts stay immutable during completion", async () => {
  await draft();
  await assertFails(
    updateDoc(parent(a), { createdAt: serverTimestamp(), complete: true }),
  );
  await assertFails(updateDoc(parent(a), { count: 3, complete: true }));
});
test("a snapshot cannot be created complete or reverted to draft", async () => {
  await assertFails(setDoc(parent(a), { ...manifest(), complete: true }));
  await draft();
  await updateDoc(parent(a), { complete: true });
  await assertFails(updateDoc(parent(a), { complete: false }));
});
test("query limits are enforced while the exact app query is supported", async () => {
  await draft();
  await updateDoc(parent(a), { complete: true });
  await assertFails(getDocs(collection(a, "users/alice/backups")));
  await assertFails(
    getDocs(query(collection(a, "users/alice/backups"), limit(11))),
  );
  await assertSucceeds(
    getDocs(
      query(
        collection(a, "users/alice/backups"),
        where("complete", "==", true),
        orderBy("createdAt", "desc"),
        limit(10),
      ),
    ),
  );
});
test("record reads are paginated and orphaned subcollections are private", async () => {
  await draft();
  await setDoc(record(a), value);
  await assertFails(getDocs(collection(a, "users/alice/backups/one/records")));
  await assertSucceeds(
    getDocs(
      query(collection(a, "users/alice/backups/one/records"), limit(400)),
    ),
  );
  await deleteDoc(parent(a));
  await assertFails(getDoc(record(a)));
  await assertFails(setDoc(record(a, "1"), value));
  await assertSucceeds(deleteDoc(record(a)));
});
