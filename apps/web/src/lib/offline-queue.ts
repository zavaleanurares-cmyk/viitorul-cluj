/**
 * Coada offline pentru prezență (IndexedDB, în browser). O intrare pe eveniment: ultima variantă salvată
 * de antrenor câștigă local; pe server, `save_attendance` compară ora din telefon (recorded_at), deci o
 * sincronizare întârziată nu suprascrie o corectură făcută între timp de altcineva.
 * Fără date medicale: doar id-uri, stare (prezent/absent…) și motivul absenței.
 */
export type QueuedRow = {
  player_id: string;
  status: "present" | "late" | "absent" | "injured";
  reason: "sick" | "injured" | "school" | "family" | "unexcused" | "other" | null;
  recorded_at: string;
};
export type QueuedAttendance = { eventId: string; rows: QueuedRow[]; savedAt: string; tries: number };

const DB = "locker-room";
const STORE = "attendance-queue";

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE, { keyPath: "eventId" });
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

export const queueAvailable = () => typeof indexedDB !== "undefined";

export async function enqueueAttendance(eventId: string, rows: QueuedRow[]): Promise<void> {
  await tx("readwrite", (s) => s.put({ eventId, rows, savedAt: new Date().toISOString(), tries: 0 } satisfies QueuedAttendance));
  window.dispatchEvent(new Event("attendance-queue"));
}

export async function pendingAttendance(): Promise<QueuedAttendance[]> {
  if (!queueAvailable()) return [];
  try {
    return await tx("readonly", (s) => s.getAll() as IDBRequest<QueuedAttendance[]>);
  } catch {
    return [];
  }
}

export async function removeAttendance(eventId: string, savedAt?: string): Promise<void> {
  // nu ștergem o variantă mai nouă salvată între timp
  const current = (await pendingAttendance()).find((q) => q.eventId === eventId);
  if (savedAt && current && current.savedAt !== savedAt) return;
  await tx("readwrite", (s) => s.delete(eventId));
  window.dispatchEvent(new Event("attendance-queue"));
}

export async function bumpTries(item: QueuedAttendance): Promise<void> {
  await tx("readwrite", (s) => s.put({ ...item, tries: item.tries + 1 }));
}
