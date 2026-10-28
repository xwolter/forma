import { dbPromise } from "./db";
import { exerciseById, stamp } from "./catalog";
import type { Plan, PlanExercise, Session, WorkoutSet } from "./types";
import { circuitStep, defaultPlanExercise } from './planTools';
import {resultMetric} from './exerciseMetrics';

export function makeSets(
  sessionId: string,
  slot: PlanExercise,
  equipmentId: string,
): WorkoutSet[] {
  const exercise = exerciseById(slot.exerciseId);
  return Array.from({ length: slot.sets }, (_, i) => ({
    ...stamp(`${sessionId}-${slot.id}-${i}`),
    sessionId,
    slotId: slot.id,
    exerciseId: slot.exerciseId,
    equipmentId,
    index: i,
    type: "work",
    loadType: exercise.loadType,
    weight: 0,
    reps: 0,
    rir: null,
    done: false,
    skipped: false,
    completedAt: null,
    metric: slot.metric ?? exercise.metric ?? 'reps',
  }));
}
export async function replaceSessionExercise(sessionId:string,slotId:string,exerciseId:string){
 const next=exerciseById(exerciseId);if(!next)throw new Error('Nieznane ćwiczenie.');
 const db=await dbPromise,tx=db.transaction(['sessions','sets'],'readwrite');
 const session=await tx.objectStore('sessions').get(sessionId) as Session|undefined;
 const slot=session?.planSnapshot.exercises.find(s=>s.id===slotId);
 if(!session||!slot||!['active','paused'].includes(session.status)||slot.exerciseId===exerciseId){await tx.done;throw new Error('Nie można teraz zamienić tego ćwiczenia.');}
 const rows=(await tx.objectStore('sets').getAll() as WorkoutSet[]).filter(s=>s.sessionId===sessionId&&s.slotId===slotId);
 const pending=rows.filter(s=>!s.done&&!s.skipped),remaining=pending.filter(s=>s.type!=='warmup').length;
 if(!remaining){await tx.done;throw new Error('Wszystkie serie są rozliczone. Dodaj nowe ćwiczenie do treningu.');}
 if(remaining>20){await tx.done;throw new Error('Zamiana obsługuje do 20 pozostałych serii. Rozlicz nadmiarowe serie.');}
 const retained=rows.filter(s=>s.done||s.skipped),sameMetric=resultMetric(slot)===(next.metric??'reps');
 const replacement:PlanExercise={...slot,...(!sameMetric?defaultPlanExercise(next):{}),id:crypto.randomUUID(),exerciseId,sets:remaining,rest:slot.rest,notes:'',target:'',tempo:'',metric:next.metric??'reps'};
 const slots=session.planSnapshot.exercises.flatMap(s=>s.id!==slotId?[s]:retained.length?[{...s,sets:Math.max(1,retained.filter(r=>r.type!=='warmup').length)},replacement]:[replacement]);
 if(slots.length>80){await tx.done;throw new Error('Trening ma już maksymalną liczbę pozycji.');}
 for(const row of pending)await tx.objectStore('sets').delete(row.id);
 for(const row of makeSets(sessionId,replacement,session.equipmentId))await tx.objectStore('sets').put(row);
 await tx.objectStore('sessions').put({...session,planSnapshot:{...session.planSnapshot,exercises:slots},currentExercise:slots.findIndex(s=>s.id===replacement.id),restEndsAt:null,restRemaining:0,comparable:false,updatedAt:new Date().toISOString()});
 await tx.done;return replacement.id;
}
export async function appendWorkoutSet(sessionId:string,slotId:string){
 const db=await dbPromise,tx=db.transaction(['sessions','sets'],'readwrite');const session=await tx.objectStore('sessions').get(sessionId) as Session|undefined;
 const slot=session?.planSnapshot.exercises.find(s=>s.id===slotId);if(!slot||session?.status!=='active'){await tx.done;throw new Error('Wznów trening przed dodaniem serii.');}
 const rows=(await tx.objectStore('sets').getAll() as WorkoutSet[]).filter(s=>s.sessionId===sessionId&&s.slotId===slotId);
 if(rows.length>=20){await tx.done;throw new Error('Możesz zapisać do 20 serii jednego ćwiczenia.');}
 const row=makeSets(sessionId,{...slot,id:slot.id,sets:1},session.equipmentId)[0];
 const next={...row,...stamp(),index:Math.max(-1,...rows.map(s=>s.index))+1};await tx.objectStore('sets').put(next);await tx.done;return next;
}
export async function beginSession(
  plan: Plan,
  date: string,
  equipmentId: string,
  equipmentName: string,
): Promise<string> {
  const db = await dbPromise;
  const tx = db.transaction(["sessions", "sets"], "readwrite");
  const existing = (await tx.objectStore("sessions").getAll()).find(
    (s: Session) => s.status === "active" || s.status === "paused",
  );
  if (existing) {
    await tx.done;
    return existing.id;
  }
  const session: Session = {
    ...stamp(),
    date,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    planId: plan.id,
    planSnapshot: structuredClone(plan),
    equipmentId,
    equipmentName,
    status: "active",
    startedAt: Date.now(),
    lastActiveAt: Date.now(),
    endedAt: null,
    pausedAt: null,
    pausedMs: 0,
    currentExercise: 0,
    restEndsAt: null,
    note: "",
    pain: false,
    mood: "",
    comparable: true,
  };
  await tx.objectStore("sessions").put(session);
  for (const slot of plan.exercises)
    for (const set of makeSets(session.id, slot, equipmentId))
      await tx.objectStore("sets").put(set);
  await tx.done;
  return session.id;
}

export async function heartbeatSession() {
 const db=await dbPromise;const tx=db.transaction('sessions','readwrite');
 for(const s of await tx.store.getAll() as Session[])if(s.status==='active')await tx.store.put({...s,lastActiveAt:Date.now()});
 await tx.done;
}
/** A restored or backgrounded session always waits for an explicit resume. */
export async function pauseRunningSessions(at?:number) {
 const db=await dbPromise;const tx=db.transaction('sessions','readwrite');let changed=false;
 for(const s of await tx.store.getAll() as Session[])if(s.status==='active'){
  const saved=s.lastActiveAt??Date.parse(s.updatedAt);
  const pausedAt=Math.min(Date.now(),Math.max(s.startedAt,at??(Number.isFinite(saved)?saved:s.startedAt)));
  await tx.store.put({...s,status:'paused',pausedAt,restEndsAt:null,updatedAt:new Date().toISOString()});changed=true;
 }
 await tx.done;return changed;
}
export async function completeSet(
  set: WorkoutSet,
  rest: number,
): Promise<boolean> {
  const db = await dbPromise;
  const tx = db.transaction(["sets", "sessions"], "readwrite");
  const saved: WorkoutSet = await tx.objectStore("sets").get(set.id);
  const session: Session = await tx.objectStore("sessions").get(set.sessionId);
  if (!saved || saved.done || saved.skipped || session?.status !== "active") {
    await tx.done;
    return false;
  }
  const { draft: _draft, ...completed } = set;
  await tx.objectStore("sets").put({
    ...completed,
    done: true,
    skipped: false,
    completedAt: Date.now(),
    updatedAt: new Date().toISOString(),
  });
  const step=circuitStep(session,set,await tx.objectStore('sets').getAll(),rest);
  await tx.objectStore("sessions").put({
    ...session,
    restEndsAt: step.rest>0?Date.now() + step.rest * 1000:null,
    currentExercise:step.currentExercise,
    lastActiveAt:Date.now(),
    updatedAt: new Date().toISOString(),
  });
  await tx.done;
  return true;
}

// Draft text keeps a Polish decimal comma intact until a set is confirmed.
// The transaction also prevents a late keystroke from changing a completed set.
export async function saveSetDraft(
  id: string,
  draft: NonNullable<WorkoutSet["draft"]>,
  type: WorkoutSet["type"],
) {
  if (
    Object.keys(draft).sort().join(",") !== "reps,rir,weight" ||
    Object.values(draft).some((v) => typeof v !== "string" || v.length > 12) ||
    !["work", "warmup", "assisted"].includes(type)
  )
    throw new Error("Nieprawidłowy zapis pól serii.");
  const db = await dbPromise;
  const tx = db.transaction(["sets", "sessions"], "readwrite");
  const row: WorkoutSet | undefined = await tx.objectStore("sets").get(id);
  const session: Session | undefined = row
    ? await tx.objectStore("sessions").get(row.sessionId)
    : undefined;
  if (row && !row.done && !row.skipped && session?.status === "active")
    await tx
      .objectStore("sets")
      .put({ ...row, draft, type, updatedAt: new Date().toISOString() });
  await tx.done;
}

export async function changeSetStatus(id: string, action: "skip" | "undo") {
  const db = await dbPromise;
  const tx = db.transaction(["sets", "sessions"], "readwrite");
  const row: WorkoutSet | undefined = await tx.objectStore("sets").get(id);
  const session: Session | undefined = row
    ? await tx.objectStore("sessions").get(row.sessionId)
    : undefined;
  if (row && session?.status === "active" && (action === "undo" || !row.done))
    await tx
      .objectStore("sets")
      .put({
        ...row,
        done: false,
        skipped: action === "skip",
        completedAt: null,
        updatedAt: new Date().toISOString(),
      });
  await tx.done;
}

export async function copySetToRemaining(sourceId: string) {
  const db = await dbPromise;
  const tx = db.transaction(["sets", "sessions"], "readwrite");
  const store = tx.objectStore("sets");
  const source: WorkoutSet | undefined = await store.get(sourceId);
  const session: Session | undefined = source
    ? await tx.objectStore("sessions").get(source.sessionId)
    : undefined;
  let count = 0;
  if (source?.done && session?.status === "active") {
    for (const row of (await store.getAll()) as WorkoutSet[]) {
      if (
        row.sessionId !== source.sessionId ||
        row.slotId !== source.slotId ||
        row.index <= source.index ||
        row.type !== source.type ||
        row.done ||
        row.skipped
      )
        continue;
      // Explicitly copy to untouched rows only; preserve any manually entered draft.
      if (
        row.weight !== 0 ||
        row.reps !== 0 ||
        row.rir !== null ||
        Object.values(row.draft ?? {}).some((v) => v.trim() !== "")
      )
        continue;
      await store.put({
        ...row,
        weight: source.weight,
        reps: source.reps,
        rir: source.rir,
        draft: {
          weight: String(source.weight),
          reps: String(source.reps),
          rir: source.rir === null ? "" : String(source.rir),
        },
        updatedAt: new Date().toISOString(),
      });
      count++;
    }
  }
  await tx.done;
  return count;
}

export async function saveExerciseNote(
  equipmentId: string,
  exerciseId: string,
  text: string,
) {
  if (!exerciseById(exerciseId)) throw new Error("Nieznane ćwiczenie.");
  if (text.length > 1500) throw new Error("Notatka może mieć do 1500 znaków.");
  const db = await dbPromise;
  const tx = db.transaction("equipment", "readwrite");
  const equipment = await tx.store.get(equipmentId);
  if (!equipment) {
    await tx.done;
    throw new Error("Nie znaleziono miejsca treningu.");
  }
  const notes = { ...equipment.exerciseNotes };
  if (text.trim()) notes[exerciseId] = text.trim();
  else delete notes[exerciseId];
  await tx.store.put({
    ...equipment,
    exerciseNotes: notes,
    updatedAt: new Date().toISOString(),
  });
  await tx.done;
}
