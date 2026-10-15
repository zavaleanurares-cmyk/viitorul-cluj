/**
 * Coada offline pentru prezență (IndexedDB, în browser). O intrare pe (utilizator, eveniment): ultima variantă
 * salvată de antrenor câștigă local; pe server, `save_attendance` compară ora din telefon (recorded_at) pe fiecare
 * rând, deci o sincronizare întârziată nu suprascrie o corectură făcută între timp de altcineva.
 * Fiecare intrare ține minte cine a salvat-o: pe un telefon folosit de doi oameni, nu trimitem prezența unuia
 * cu sesiunea celuilalt. Fără date medicale: doar id-uri, stare (prezent/absent…) și motivul absenței.
 */
export type QueuedRow = {
  player_id: string;
  status: "present" | "late" | "absent" | "injured";
  reason: "sick" | "injured" | "school" | "family" | "unexcused" | "other" | null;
  recorded_at: string;
};
export type QueuedAttendance = {
  key: string;
  userId: string;
  eventId: string;
  rows: QueuedRow[];
  savedAt: string;
  tries: number;
  lastError: string | null;
};

/** După atâtea refuzuri ale serverului (nu lipsă de semnal), nu mai reîncercăm singuri: arătăm eroarea. */
export const MAX_TRIES = 5;

const DB = "locker-room";
const STORE = "attendance-queue-v2";

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 2);
    req.onupgradeneeded = () => {
      const db = req.result;
      // v1 nu știa al cui e rândul; îl renunțăm (nu putem ști cu ce cont să-l trimitem)
      if (db.objectStoreNames.contains("attendance-queue")) db.deleteObjectStore("attendance-queue");
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: "key" });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const t = db.transaction(STORE, mode);
    const r = fn(t.objectStore(STORE));
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
    t.oncomplete = () => db.close();
  });
}

const keyOf = (userId: string, eventId: string) => `${userId}:${eventId}`;
const changed = () => window.dispatchEvent(new Event("attendance-queue"));

export const queueAvailable = () => typeof indexedDB !== "undefined";

export async function enqueueAttendance(userId: string, eventId: string, rows: QueuedRow[]): Promise<void> {
  const key = keyOf(userId, eventId);
  const prev = (await pendingAttendance(userId)).find((q) => q.key === key);
  // rândurile nemodificate acum rămân cu varianta din coadă (nu pierdem o modificare încă netrimisă)
  const merged = new Map((prev?.rows ?? []).map((r) => [r.player_id, r]));
  for (const r of rows) {
    const old = merged.get(r.player_id);
    if (!old || old.recorded_at <= r.recorded_at) merged.set(r.player_id, r);
  }
  const item: QueuedAttendance = { key, userId, eventId, rows: [...merged.values()], savedAt: new Date().toISOString(), tries: 0, lastError: null };
  await tx("readwrite", (s) => s.put(item));
  changed();
}

/** Ce așteaptă trimiterea pentru acest utilizator. */
export async function pendingAttendance(userId: string): Promise<QueuedAttendance[]> {
  if (!queueAvailable()) return [];
  try {
    const all = await tx("readonly", (s) => s.getAll() as IDBRequest<QueuedAttendance[]>);
    return all.filter((q) => q.userId === userId);
  } catch {
    return [];
  }
}

export async function removeAttendance(item: QueuedAttendance): Promise<void> {
  // nu ștergem o variantă mai nouă salvată între timp
  const current = (await pendingAttendance(item.userId)).find((q) => q.key === item.key);
  if (current && current.savedAt !== item.savedAt) return;
  await tx("readwrite", (s) => s.delete(item.key));
  changed();
}

export async function markFailed(item: QueuedAttendance, error: string): Promise<void> {
  await tx("readwrite", (s) => s.put({ ...item, tries: item.tries + 1, lastError: error }));
  changed();
}

