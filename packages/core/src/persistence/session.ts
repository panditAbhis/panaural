// SPDX-License-Identifier: MIT
// Copyright (c) 2026 panditAbhis — Panaural Project

import type { DetectionSession } from '../types.js';

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
 * Save a DetectionSession to IndexedDB. Returns its id.
 */
export async function saveSession(db: IDBDatabase, session: DetectionSession): Promise<string> {
  const tx = db.transaction('sessions', 'readwrite');
  const store = tx.objectStore('sessions');
  await req(store.put(session));
  await txDone(tx);
  return session.id;
}

/**
 * Return all detection sessions for a given baseline, sorted newest first.
 */
export async function listSessions(db: IDBDatabase, baselineId: string): Promise<DetectionSession[]> {
  const tx = db.transaction('sessions', 'readonly');
  const store = tx.objectStore('sessions');
  const idx = store.index('baselineId');
  const all = await req<DetectionSession[]>(idx.getAll(baselineId));
  return all.sort((a, b) => b.detectedAt.localeCompare(a.detectedAt));
}

/**
 * Delete one detection session by id.
 */
export async function deleteSession(db: IDBDatabase, id: string): Promise<void> {
  const tx = db.transaction('sessions', 'readwrite');
  tx.objectStore('sessions').delete(id);
  await txDone(tx);
}
