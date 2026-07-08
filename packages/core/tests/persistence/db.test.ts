// SPDX-License-Identifier: MIT
// Copyright (c) 2026 panditAbhis — Panaural Project

import { describe, it, expect, beforeEach } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import {
  openDB,
  saveBaseline,
  listBaselines,
  loadBaseline,
  deleteBaseline,
} from '../../src/persistence/db.js';
import { serializeBaseline } from '../../src/persistence/serialize.js';
import type { SavedBaseline, Baseline } from '../../src/types.js';

function makeBaseline(): Baseline {
  return {
    mu: new Float64Array(10).fill(-40),
    sigma: new Float64Array(10).fill(0.5),
    numFrames: 30,
    frequencyResolution: 0.977,
    builtAt: '2026-07-08T10:00:00.000Z',
  };
}

function makeSaved(name: string, machineId = 'Pump A'): SavedBaseline {
  return {
    id: crypto.randomUUID(),
    name,
    machineId,
    notes: '',
    sourceFile: 'test.wav',
    baseline: serializeBaseline(makeBaseline()),
    savedAt: new Date().toISOString(),
  };
}

describe('openDB', () => {
  it('returns an IDBDatabase instance', async () => {
    const db = await openDB(new IDBFactory());
    expect(db).toBeDefined();
    expect(db.name).toBe('panaural-db');
    db.close();
  });

  it('creates baselines and sessions object stores', async () => {
    const db = await openDB(new IDBFactory());
    expect(db.objectStoreNames.contains('baselines')).toBe(true);
    expect(db.objectStoreNames.contains('sessions')).toBe(true);
    db.close();
  });
});

describe('saveBaseline + listBaselines', () => {
  let db: IDBDatabase;
  beforeEach(async () => { db = await openDB(new IDBFactory()); });

  it('saves a baseline and returns its id', async () => {
    const saved = makeSaved('Pump A baseline');
    const id = await saveBaseline(db, saved);
    expect(id).toBe(saved.id);
  });

  it('listBaselines returns saved baselines sorted newest first', async () => {
    const a = { ...makeSaved('First'), savedAt: '2026-07-01T00:00:00.000Z' };
    const b = { ...makeSaved('Second'), savedAt: '2026-07-08T00:00:00.000Z' };
    await saveBaseline(db, a);
    await saveBaseline(db, b);
    const list = await listBaselines(db);
    expect(list).toHaveLength(2);
    expect(list[0]!.name).toBe('Second');
    expect(list[1]!.name).toBe('First');
  });

  it('empty database returns empty list', async () => {
    const list = await listBaselines(db);
    expect(list).toHaveLength(0);
  });
});

describe('loadBaseline', () => {
  let db: IDBDatabase;
  beforeEach(async () => { db = await openDB(new IDBFactory()); });

  it('loads a saved baseline by id', async () => {
    const saved = makeSaved('Pump A');
    await saveBaseline(db, saved);
    const loaded = await loadBaseline(db, saved.id);
    expect(loaded).not.toBeNull();
    expect(loaded!.name).toBe('Pump A');
    expect(loaded!.baseline.mu).toHaveLength(10);
  });

  it('returns null for unknown id', async () => {
    const result = await loadBaseline(db, 'nonexistent-id');
    expect(result).toBeNull();
  });
});

describe('deleteBaseline', () => {
  let db: IDBDatabase;
  beforeEach(async () => { db = await openDB(new IDBFactory()); });

  it('removes the baseline from the store', async () => {
    const saved = makeSaved('To delete');
    await saveBaseline(db, saved);
    await deleteBaseline(db, saved.id);
    const result = await loadBaseline(db, saved.id);
    expect(result).toBeNull();
  });

  it('does not throw when deleting a non-existent id', async () => {
    await expect(deleteBaseline(db, 'nonexistent')).resolves.not.toThrow();
  });
});
