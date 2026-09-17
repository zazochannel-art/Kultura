/**
 * Un wrapper minimal peste IndexedDB.
 *
 * Aplicația este „local-first”: tot ce se vede în interfață vine din IndexedDB,
 * iar sincronizarea cu Supabase se face în fundal. Așa merge și pe internet
 * slab sau deloc — exact cazul de pe șantier.
 *
 * Fiecare apel este tolerant la erori: în Safari privat sau când stocarea e
 * blocată, IndexedDB aruncă la deschidere. Într-un asemenea caz cădem elegant
 * pe un mod „doar în memorie” în loc să crăpăm aplicația.
 */
import { TABLE_NAMES } from "../types";

const DB_NAME = "montajpro";
const DB_VERSION = 1;

export const OUTBOX_STORE = "__outbox";
export const META_STORE = "__meta";
export const BLOB_STORE = "__blobs";

let dbPromise: Promise<IDBDatabase | null> | null = null;

export function idbAvailable(): boolean {
  return typeof indexedDB !== "undefined";
}

function openDB(): Promise<IDBDatabase | null> {
  if (!idbAvailable()) return Promise.resolve(null);
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve) => {
    let request: IDBOpenDBRequest;
    try {
      request = indexedDB.open(DB_NAME, DB_VERSION);
    } catch {
      resolve(null);
      return;
    }

    request.onupgradeneeded = () => {
      const db = request.result;
      for (const table of TABLE_NAMES) {
        if (!db.objectStoreNames.contains(table)) {
          db.createObjectStore(table, { keyPath: "id" });
        }
      }
      if (!db.objectStoreNames.contains(OUTBOX_STORE)) {
        db.createObjectStore(OUTBOX_STORE, { keyPath: "key" });
      }
      if (!db.objectStoreNames.contains(META_STORE)) {
        db.createObjectStore(META_STORE);
      }
      if (!db.objectStoreNames.contains(BLOB_STORE)) {
        db.createObjectStore(BLOB_STORE);
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => resolve(null);
    request.onblocked = () => resolve(null);
  });

  return dbPromise;
}

function tx<T>(
  storeName: string,
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T | null> {
  return openDB().then(
    (db) =>
      new Promise<T | null>((resolve) => {
        if (!db) return resolve(null);
        try {
          const transaction = db.transaction(storeName, mode);
          const request = run(transaction.objectStore(storeName));
          request.onsuccess = () => resolve(request.result);
          request.onerror = () => resolve(null);
        } catch {
          resolve(null);
        }
      }),
  );
}

export async function idbGetAll<T>(storeName: string): Promise<T[]> {
  const rows = await tx<T[]>(storeName, "readonly", (store) => store.getAll());
  return rows ?? [];
}

export async function idbGet<T>(storeName: string, key: IDBValidKey): Promise<T | null> {
  return (await tx<T>(storeName, "readonly", (store) => store.get(key))) ?? null;
}

export async function idbPut(
  storeName: string,
  value: unknown,
  key?: IDBValidKey,
): Promise<void> {
  await tx(storeName, "readwrite", (store) =>
    key === undefined ? store.put(value) : store.put(value, key),
  );
}

export async function idbBulkPut(storeName: string, values: unknown[]): Promise<void> {
  if (!values.length) return;
  const db = await openDB();
  if (!db) return;
  await new Promise<void>((resolve) => {
    try {
      const transaction = db.transaction(storeName, "readwrite");
      const store = transaction.objectStore(storeName);
      for (const value of values) store.put(value);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => resolve();
      transaction.onabort = () => resolve();
    } catch {
      resolve();
    }
  });
}

export async function idbDelete(storeName: string, key: IDBValidKey): Promise<void> {
  await tx(storeName, "readwrite", (store) => store.delete(key));
}

export async function idbClear(storeName: string): Promise<void> {
  await tx(storeName, "readwrite", (store) => store.clear());
}

export async function idbClearAll(): Promise<void> {
  for (const table of [...TABLE_NAMES, OUTBOX_STORE, META_STORE, BLOB_STORE]) {
    await idbClear(table);
  }
}

/* --------------------------- meta (cheie/valoare) ------------------- */

export async function metaGet<T>(key: string): Promise<T | null> {
  return idbGet<T>(META_STORE, key);
}

export async function metaSet(key: string, value: unknown): Promise<void> {
  await idbPut(META_STORE, value, key);
}

/* --------------------------- blob-uri (poze offline) ---------------- */

export async function blobPut(key: string, blob: Blob): Promise<void> {
  await idbPut(BLOB_STORE, blob, key);
}

export async function blobGet(key: string): Promise<Blob | null> {
  return idbGet<Blob>(BLOB_STORE, key);
}

export async function blobDelete(key: string): Promise<void> {
  await idbDelete(BLOB_STORE, key);
}
