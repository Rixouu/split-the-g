/**
 * Client-only IndexedDB queue for pour photos when the device is offline.
 * Flushed on `online`, `visibilitychange`, and service worker sync (`pour-queue`).
 */

const DB = "split-the-g-offline";
const STORE = "pour-queue";
const DB_VERSION = 1;

export interface OfflineQueuedPour {
  id: string;
  imageBase64: string;
  competitionId: string;
  actorUserId: string;
  actorName: string;
  queuedAt: number;
}

function isBrowser(): boolean {
  return typeof indexedDB !== "undefined";
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, DB_VERSION);
    req.onerror = () => reject(req.error ?? new Error("IDB open failed"));
    req.onsuccess = () => resolve(req.result);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "id" });
      }
    };
  });
}

export async function enqueueOfflinePour(item: OfflineQueuedPour): Promise<void> {
  if (!isBrowser()) return;
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("IDB tx failed"));
    tx.objectStore(STORE).put(item);
  });
  db.close();

  try {
    const reg = (await navigator.serviceWorker?.ready) as
      | (ServiceWorkerRegistration & {
          sync?: { register: (tag: string) => Promise<void> };
        })
      | undefined;
    await reg?.sync?.register?.("pour-queue");
  } catch {
    /* optional */
  }
}

export async function listOfflinePourQueue(): Promise<OfflineQueuedPour[]> {
  if (!isBrowser()) return [];
  const db = await openDb();
  const rows = await new Promise<OfflineQueuedPour[]>((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).getAll();
    req.onsuccess = () =>
      resolve(Array.isArray(req.result) ? (req.result as OfflineQueuedPour[]) : []);
    req.onerror = () => reject(req.error ?? new Error("IDB getAll failed"));
  });
  db.close();
  return rows.sort((a, b) => a.queuedAt - b.queuedAt);
}

export async function removeOfflinePour(id: string): Promise<void> {
  if (!isBrowser()) return;
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("IDB tx failed"));
    tx.objectStore(STORE).delete(id);
  });
  db.close();
}

export interface FlushPourQueueHandlers {
  submitPour: (item: OfflineQueuedPour) => Promise<void>;
  /** Called once after one or more items were submitted successfully. */
  onBatchSynced?: (count: number) => void;
  onItemFailed?: (item: OfflineQueuedPour, err: unknown) => void;
}

/** Submit queued items in order; removes each row only after a successful submit. */
export async function flushOfflinePourQueue(
  handlers: FlushPourQueueHandlers,
): Promise<void> {
  if (!isBrowser()) return;
  const items = await listOfflinePourQueue();
  let synced = 0;
  for (const item of items) {
    try {
      await handlers.submitPour(item);
      await removeOfflinePour(item.id);
      synced += 1;
    } catch (err) {
      handlers.onItemFailed?.(item, err);
      break;
    }
  }
  if (synced > 0) {
    handlers.onBatchSynced?.(synced);
  }
}
