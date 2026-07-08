// SPDX-License-Identifier: MIT
// Copyright (c) 2026 panditAbhis — Panaural Project

import { describe, it, expect, beforeEach } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import { openDB, saveBaseline } from '../../src/persistence/db.js';
import { saveSession, listSessions, deleteSession } from '../../src/persistence/session.js';
import { serializeBaseline } from '../../src/persistence/serialize.js';
import type { DetectionSession, SavedBaseline, Baseline } from '../../src/types.js';

function makeBaseline(): Baseline {
  return {
    mu: new Float64Array(10).fill(-40),
    sigma: new Float64Array(10).fill(0.5),
    numFrames: 30,
    frequencyResolution: 0.977,
    builtAt: '2026-07-08T10:00:00.000Z',
  };
}

function makeSavedBaseline(name = 'Pump A'): SavedBaseline {
  return {
    id: crypto.randomUUID(),
    name,
    machineId: 'Pump A',
    notes: '',
    sourceFile: 'test.wav',
    baseline: serializeBaseline(makeBaseline()),
    savedAt: new Date().toISOString(),
  };
}

function makeSession(baselineId: string, alertLevel: DetectionSession['alertLevel'] = 'normal'): DetectionSession {
  return {
    id: crypto.randomUUID(),
    baselineId,
    sourceFile: 'compare.wav',
    alertLevel,
    maxAbsZ: alertLevel === 'alert' ? 5.2 : alertLevel === 'warning' ? 3.5 : 0.8,
    numBinsAlerting: alertLevel === 'alert' ? 3 : 0,
    cusumAlertBins: 0,
    topBins: [{ freq: 49.8, z: 2.1 }],
    detectedAt: new Date().toISOString(),
  };
}

describe('saveSession + listSessions', () => {
  let db: IDBDatabase;
  let baselineId: string;

  beforeEach(async () => {
    db = await openDB(new IDBFactory());
    const saved = makeSavedBaseline();
    await saveBaseline(db, saved);
    baselineId = saved.id;
  });

  it('saves a session and returns its id', async () => {
    const session = makeSession(baselineId);
    const id = await saveSession(db, session);
    expect(id).toBe(session.id);
  });

  it('listSessions returns sessions for the given baselineId', async () => {
    const s1 = makeSession(baselineId, 'normal');
    const s2 = makeSession(baselineId, 'alert');
    await saveSession(db, s1);
    await saveSession(db, s2);
    const list = await listSessions(db, baselineId);
    expect(list).toHaveLength(2);
  });

  it('listSessions returns empty array for unknown baselineId', async () => {
    const list = await listSessions(db, 'nonexistent');
    expect(list).toHaveLength(0);
  });

  it('listSessions does not return sessions for a different baseline', async () => {
    const other = makeSavedBaseline('Pump B');
    await saveBaseline(db, other);
    await saveSession(db, makeSession(other.id, 'alert'));
    const list = await listSessions(db, baselineId);
    expect(list).toHaveLength(0);
  });

  it('listSessions sorted newest first', async () => {
    const s1 = { ...makeSession(baselineId), detectedAt: '2026-07-01T00:00:00.000Z' };
    const s2 = { ...makeSession(baselineId), detectedAt: '2026-07-08T00:00:00.000Z' };
    await saveSession(db, s1);
    await saveSession(db, s2);
    const list = await listSessions(db, baselineId);
    expect(list[0]!.detectedAt).toBe('2026-07-08T00:00:00.000Z');
  });
});

describe('deleteSession', () => {
  let db: IDBDatabase;
  let baselineId: string;

  beforeEach(async () => {
    db = await openDB(new IDBFactory());
    const saved = makeSavedBaseline();
    await saveBaseline(db, saved);
    baselineId = saved.id;
  });

  it('removes a session by id', async () => {
    const session = makeSession(baselineId);
    await saveSession(db, session);
    await deleteSession(db, session.id);
    const list = await listSessions(db, baselineId);
    expect(list).toHaveLength(0);
  });

  it('does not throw when deleting a non-existent id', async () => {
    await expect(deleteSession(db, 'nonexistent')).resolves.not.toThrow();
  });
});
