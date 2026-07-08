// SPDX-License-Identifier: MIT
// Copyright (c) 2026 panditAbhis — Panaural Project

import type { SavedBaseline } from '../types.js';

const DB_NAME = 'panaural-db';
const DB_VERSION = 1;

function req<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function txDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

/**
 * Open (or create) the panaural-db IndexedDB database.
 *
 * Takes IDBFactory as a parameter so this function is testable with
 * fake-indexeddb in Vitest — the global `indexedDB` does not exist in Node.js.
 * Demo.html passes globalThis.indexedDB (browser built-in) implicitly via default.
 */
export function openDB(factory: IDBFactory = globalThis.indexedDB): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = factory.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      if (!db.objectStoreNames.contains('baselines')) {
        const store = db.createObjectStore('baselines', { keyPath: 'id' });
        store.createIndex('machineId', 'machineId', { unique: false });
        store.createIndex('savedAt', 'savedAt', { unique: false });
      }

      if (!db.objectStoreNames.contains('sessions')) {
        const store = db.createObjectStore('sessions', { keyPath: 'id' });
        store.createIndex('baselineId', 'baselineId', { unique: false });
        store.createIndex('detectedAt', 'detectedAt', { unique: false });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Save a SavedBaseline to IndexedDB. Uses put (upsert) so re-saving an existing id updates it.
 * Returns the saved baseline's id.
 */
export async function saveBaseline(db: IDBDatabase, saved: SavedBaseline): Promise<string> {
  const tx = db.transaction('baselines', 'readwrite');
  const store = tx.objectStore('baselines');
  await req(store.put(saved));
  await txDone(tx);
  return saved.id;
}

/**
 * Return all baselines sorted by savedAt descending (newest first).
 */
export async function listBaselines(db: IDBDatabase): Promise<SavedBaseline[]> {
  const tx = db.transaction('baselines', 'readonly');
  const store = tx.objectStore('baselines');
  const all = await req<SavedBaseline[]>(store.getAll());
  return all.sort((a, b) => b.savedAt.localeCompare(a.savedAt));
}

/**
 * Load one baseline by id. Returns null if not found.
 */
export async function loadBaseline(db: IDBDatabase, id: string): Promise<SavedBaseline | null> {
  const tx = db.transaction('baselines', 'readonly');
  const store = tx.objectStore('baselines');
  const result = await req<SavedBaseline | undefined>(store.get(id));
  return result ?? null;
}

/**
 * Delete a baseline and all its associated detection sessions (cascade).
 * Cascade prevents orphaned sessions from accumulating in the sessions store.
 */
export async function deleteBaseline(db: IDBDatabase, id: string): Promise<void> {
  const sessionTx = db.transaction('sessions', 'readwrite');
  const sessionStore = sessionTx.objectStore('sessions');
  const idx = sessionStore.index('baselineId');
  const sessions = await req<Array<{ id: string }>>(idx.getAll(id));
  for (const s of sessions) {
    sessionStore.delete(s.id);
  }
  await txDone(sessionTx);

  const tx = db.transaction('baselines', 'readwrite');
  tx.objectStore('baselines').delete(id);
  await txDone(tx);
}
