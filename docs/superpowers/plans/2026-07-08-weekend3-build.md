# Weekend 3 — Baseline Persistence + Detection Log Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add IndexedDB persistence so named baselines and detection sessions survive page refresh, with JSON export/import and a top-class teaching guide.

**Architecture:** Pure TypeScript functions in `packages/core/src/persistence/` take `IDBFactory` as a parameter for testability with `fake-indexeddb`. Demo.html mirrors the same logic as inline JS (no module imports — same standalone pattern as Weekend 2). All commits by `panditAbhis <panditabhishek24@gmail.com>`, no co-author lines.

**Tech Stack:** TypeScript strict, Vitest, fake-indexeddb, IndexedDB (browser built-in), zero runtime dependencies.

---

## File Map

**New — packages/core/src/**
```
persistence/serialize.ts   serializeBaseline, deserializeBaseline, exportToJSON, importFromJSON
persistence/db.ts          openDB, saveBaseline, listBaselines, loadBaseline, deleteBaseline
persistence/session.ts     saveSession, listSessions, deleteSession
```

**New — packages/core/tests/**
```
persistence/serialize.test.ts
persistence/db.test.ts
persistence/session.test.ts
```

**Modified**
```
packages/core/src/types.ts      Add SavedBaseline, SerializedBaseline, DetectionSession
packages/core/src/index.ts      Re-export persistence modules
packages/core/package.json      Add fake-indexeddb devDependency
packages/demo/demo.html         Guide entries G-S, G-P, G-L + Weekend 3 Teaching Block
                                + Save form + Baseline Library + Detection Log panels
                                + inline JS for all persistence operations
```

---

## Task 1: Add Weekend 3 types to types.ts

**Files:**
- Modify: `packages/core/src/types.ts`

- [ ] **Step 1: Append the three new types**

Open `packages/core/src/types.ts` and append after the last line (`valid: boolean;`):

```typescript
// ── Weekend 3 types ──────────────────────────────────────────────────────────

/**
 * Baseline fields stored as plain number[] so they survive JSON.stringify
 * and IndexedDB structured-clone without loss.
 * deserializeBaseline() converts back to Float64Array for computation.
 */
export interface SerializedBaseline {
  mu: number[];
  sigma: number[];
  numFrames: number;
  frequencyResolution: number;
  builtAt: string;
}

/**
 * A named baseline saved to IndexedDB.
 * Carries asset metadata for maintenance record-keeping.
 */
export interface SavedBaseline {
  id: string;               // crypto.randomUUID()
  name: string;             // e.g. "Pump A — summer 2026"
  machineId: string;        // asset tag e.g. "Pump A"
  notes: string;            // free-text maintenance notes
  sourceFile: string;       // WAV filename used to build this baseline
  baseline: SerializedBaseline;
  savedAt: string;          // ISO 8601
}

/**
 * One drift detection run saved to IndexedDB.
 * Links to its baseline via baselineId.
 */
export interface DetectionSession {
  id: string;               // crypto.randomUUID()
  baselineId: string;       // FK -> SavedBaseline.id
  sourceFile: string;       // WAV filename compared
  alertLevel: 'normal' | 'warning' | 'alert';
  maxAbsZ: number;
  numBinsAlerting: number;
  cusumAlertBins: number;
  topBins: Array<{ freq: number; z: number }>;
  detectedAt: string;       // ISO 8601
}
```

- [ ] **Step 2: Run existing tests — must still pass**

```bash
cd /Users/abhishekpandit/projects/panaural/packages/core && pnpm test
```

Expected: 10 test files, 63 tests, all pass.

- [ ] **Step 3: Commit**

```bash
git add packages/core/src/types.ts
git -c user.name="panditAbhis" -c user.email="panditabhishek24@gmail.com" \
  commit -m "feat(core): add Weekend 3 types — SavedBaseline, SerializedBaseline, DetectionSession"
```

---

## Task 2: Add fake-indexeddb dev dependency

**Files:**
- Modify: `packages/core/package.json`

- [ ] **Step 1: Install fake-indexeddb**

```bash
cd /Users/abhishekpandit/projects/panaural/packages/core && pnpm add -D fake-indexeddb
```

- [ ] **Step 2: Verify it installed**

```bash
cat package.json | grep fake-indexeddb
```

Expected output: `"fake-indexeddb": "^x.x.x"` in devDependencies.

- [ ] **Step 3: Verify existing tests still pass**

```bash
pnpm test
```

Expected: 10 test files, 63 tests, all pass.

- [ ] **Step 4: Commit**

```bash
git add packages/core/package.json packages/core/pnpm-lock.yaml 2>/dev/null; \
git add packages/core/package.json
git -c user.name="panditAbhis" -c user.email="panditabhishek24@gmail.com" \
  commit -m "chore(core): add fake-indexeddb dev dependency for persistence tests"
```

---

## Task 3: persistence/serialize.ts + tests

**Files:**
- Create: `packages/core/src/persistence/serialize.ts`
- Create: `packages/core/tests/persistence/serialize.test.ts`

- [ ] **Step 1: Create directories**

```bash
mkdir -p /Users/abhishekpandit/projects/panaural/packages/core/src/persistence
mkdir -p /Users/abhishekpandit/projects/panaural/packages/core/tests/persistence
```

- [ ] **Step 2: Write failing tests**

Create `packages/core/tests/persistence/serialize.test.ts`:

```typescript
// SPDX-License-Identifier: MIT
// Copyright (c) 2026 panditAbhis — Panaural Project

import { describe, it, expect } from 'vitest';
import {
  serializeBaseline,
  deserializeBaseline,
  exportToJSON,
  importFromJSON,
} from '../../src/persistence/serialize.js';
import type { Baseline, SavedBaseline } from '../../src/types.js';

function makeBaseline(numBins = 10): Baseline {
  const mu = new Float64Array(numBins);
  const sigma = new Float64Array(numBins);
  for (let k = 0; k < numBins; k++) { mu[k] = -40 - k * 0.1; sigma[k] = 0.5 + k * 0.01; }
  return { mu, sigma, numFrames: 30, frequencyResolution: 0.977, builtAt: '2026-07-08T10:00:00.000Z' };
}

function makeSaved(): SavedBaseline {
  return {
    id: 'test-id-123',
    name: 'Pump A test',
    machineId: 'Pump A',
    notes: 'post-overhaul',
    sourceFile: 'pump_a.wav',
    baseline: serializeBaseline(makeBaseline()),
    savedAt: '2026-07-08T10:00:00.000Z',
  };
}

describe('serializeBaseline', () => {
  it('converts Float64Arrays to plain number arrays', () => {
    const b = makeBaseline();
    const s = serializeBaseline(b);
    expect(Array.isArray(s.mu)).toBe(true);
    expect(Array.isArray(s.sigma)).toBe(true);
    expect(s.mu).toHaveLength(10);
    expect(s.sigma).toHaveLength(10);
  });

  it('preserves mu and sigma values exactly', () => {
    const b = makeBaseline();
    const s = serializeBaseline(b);
    for (let k = 0; k < 10; k++) {
      expect(s.mu[k]).toBe(b.mu[k]);
      expect(s.sigma[k]).toBe(b.sigma[k]);
    }
  });

  it('preserves scalar fields', () => {
    const b = makeBaseline();
    const s = serializeBaseline(b);
    expect(s.numFrames).toBe(30);
    expect(s.frequencyResolution).toBe(0.977);
    expect(s.builtAt).toBe('2026-07-08T10:00:00.000Z');
  });
});

describe('deserializeBaseline', () => {
  it('converts number arrays back to Float64Arrays', () => {
    const b = makeBaseline();
    const s = serializeBaseline(b);
    const restored = deserializeBaseline(s);
    expect(restored.mu).toBeInstanceOf(Float64Array);
    expect(restored.sigma).toBeInstanceOf(Float64Array);
  });

  it('round-trips values exactly', () => {
    const b = makeBaseline();
    const restored = deserializeBaseline(serializeBaseline(b));
    for (let k = 0; k < 10; k++) {
      expect(restored.mu[k]).toBe(b.mu[k]);
      expect(restored.sigma[k]).toBe(b.sigma[k]);
    }
    expect(restored.numFrames).toBe(b.numFrames);
    expect(restored.frequencyResolution).toBe(b.frequencyResolution);
    expect(restored.builtAt).toBe(b.builtAt);
  });
});

describe('exportToJSON', () => {
  it('returns a valid JSON string', () => {
    const saved = makeSaved();
    const json = exportToJSON(saved);
    expect(() => JSON.parse(json)).not.toThrow();
  });

  it('round-trips id, name, machineId, notes, sourceFile', () => {
    const saved = makeSaved();
    const parsed = JSON.parse(exportToJSON(saved)) as SavedBaseline;
    expect(parsed.id).toBe('test-id-123');
    expect(parsed.name).toBe('Pump A test');
    expect(parsed.machineId).toBe('Pump A');
    expect(parsed.notes).toBe('post-overhaul');
    expect(parsed.sourceFile).toBe('pump_a.wav');
  });
});

describe('importFromJSON', () => {
  it('parses valid JSON and returns a SavedBaseline', () => {
    const saved = makeSaved();
    const imported = importFromJSON(exportToJSON(saved));
    expect(imported.id).toBe(saved.id);
    expect(imported.name).toBe(saved.name);
    expect(imported.baseline.mu).toHaveLength(10);
  });

  it('throws on invalid JSON', () => {
    expect(() => importFromJSON('not json')).toThrow();
  });

  it('throws when required fields are missing', () => {
    const bad = JSON.stringify({ id: 'x' }); // missing name, baseline, etc.
    expect(() => importFromJSON(bad)).toThrow(/missing required fields/);
  });
});
```

- [ ] **Step 3: Run tests to confirm they fail**

```bash
cd /Users/abhishekpandit/projects/panaural/packages/core && pnpm test tests/persistence/serialize.test.ts 2>&1 | tail -5
```

Expected: FAIL — cannot find module.

- [ ] **Step 4: Implement serialize.ts**

Create `packages/core/src/persistence/serialize.ts`:

```typescript
// SPDX-License-Identifier: MIT
// Copyright (c) 2026 panditAbhis — Panaural Project

import type { Baseline, SerializedBaseline, SavedBaseline } from '../types.js';

/**
 * Convert a live Baseline (Float64Arrays) to a storage-safe form (number[]).
 *
 * Why: Float64Array is not reliably JSON-serialisable (JSON.stringify produces {})
 * and structured-clone behaviour varies across browsers for typed arrays in IDB.
 * Converting to number[] is safe, universal, and lossless at float64 precision.
 */
export function serializeBaseline(b: Baseline): SerializedBaseline {
  return {
    mu: Array.from(b.mu),
    sigma: Array.from(b.sigma),
    numFrames: b.numFrames,
    frequencyResolution: b.frequencyResolution,
    builtAt: b.builtAt,
  };
}

/**
 * Convert stored SerializedBaseline back to a live Baseline for computation.
 * The detector modules (Mahalanobis, CUSUM) require Float64Array inputs.
 */
export function deserializeBaseline(s: SerializedBaseline): Baseline {
  return {
    mu: new Float64Array(s.mu),
    sigma: new Float64Array(s.sigma),
    numFrames: s.numFrames,
    frequencyResolution: s.frequencyResolution,
    builtAt: s.builtAt,
  };
}

/**
 * Serialise a SavedBaseline to a JSON string for file download.
 * The baseline.mu and baseline.sigma are already number[] at this point.
 */
export function exportToJSON(saved: SavedBaseline): string {
  return JSON.stringify(saved, null, 2);
}

/**
 * Parse a JSON string from file upload into a SavedBaseline.
 * Validates that the minimum required fields are present.
 *
 * @throws SyntaxError if json is not valid JSON
 * @throws Error if required fields are missing
 */
export function importFromJSON(json: string): SavedBaseline {
  const parsed = JSON.parse(json) as Record<string, unknown>;
  const required = ['id', 'name', 'machineId', 'notes', 'sourceFile', 'baseline', 'savedAt'];
  const missing = required.filter(k => !(k in parsed));
  if (missing.length > 0) {
    throw new Error(`importFromJSON: missing required fields: ${missing.join(', ')}`);
  }
  const b = parsed['baseline'] as Record<string, unknown>;
  const baselineRequired = ['mu', 'sigma', 'numFrames', 'frequencyResolution', 'builtAt'];
  const missingB = baselineRequired.filter(k => !(k in b));
  if (missingB.length > 0) {
    throw new Error(`importFromJSON: missing required fields in baseline: ${missingB.join(', ')}`);
  }
  return parsed as unknown as SavedBaseline;
}
```

- [ ] **Step 5: Run tests — all must pass**

```bash
pnpm test tests/persistence/serialize.test.ts
```

Expected: 10 passing tests.

- [ ] **Step 6: Full suite**

```bash
pnpm test
```

Expected: 11 test files, 73 tests, all pass.

- [ ] **Step 7: Commit**

```bash
git add packages/core/src/persistence/serialize.ts packages/core/tests/persistence/serialize.test.ts
git -c user.name="panditAbhis" -c user.email="panditabhishek24@gmail.com" \
  commit -m "feat(core): add baseline serialization — Float64Array to/from JSON-safe number[]"
```

---

## Task 4: persistence/db.ts + tests

**Files:**
- Create: `packages/core/src/persistence/db.ts`
- Create: `packages/core/tests/persistence/db.test.ts`

- [ ] **Step 1: Write failing tests**

Create `packages/core/tests/persistence/db.test.ts`:

```typescript
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
    expect(list[0]!.name).toBe('Second'); // newest first
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
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd /Users/abhishekpandit/projects/panaural/packages/core && pnpm test tests/persistence/db.test.ts 2>&1 | tail -5
```

Expected: FAIL — cannot find module.

- [ ] **Step 3: Implement db.ts**

Create `packages/core/src/persistence/db.ts`:

```typescript
// SPDX-License-Identifier: MIT
// Copyright (c) 2026 panditAbhis — Panaural Project

import type { SavedBaseline } from '../types.js';

const DB_NAME = 'panaural-db';
const DB_VERSION = 1;

/** Wrap an IDBRequest in a Promise. */
function req<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/** Wrap an IDBTransaction completion in a Promise. */
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
 * Why take IDBFactory as a parameter: the global `indexedDB` does not exist
 * in Node.js. Passing the factory makes this function testable with
 * fake-indexeddb in Vitest without touching globalThis.
 *
 * @param factory  IDBFactory to use. Defaults to globalThis.indexedDB in browsers.
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
 * Save a SavedBaseline to IndexedDB. Returns its id.
 * Uses put (upsert) so re-saving an existing id updates it.
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
 * Delete a baseline and all its associated detection sessions.
 * Cascade is important: orphaned sessions waste space and confuse the log view.
 */
export async function deleteBaseline(db: IDBDatabase, id: string): Promise<void> {
  // Delete all sessions for this baseline first
  const sessionTx = db.transaction('sessions', 'readwrite');
  const sessionStore = sessionTx.objectStore('sessions');
  const idx = sessionStore.index('baselineId');
  const sessions = await req<DetectionSessionRecord[]>(idx.getAll(id));
  for (const s of sessions) {
    sessionStore.delete(s.id);
  }
  await txDone(sessionTx);

  // Delete the baseline itself
  const tx = db.transaction('baselines', 'readwrite');
  tx.objectStore('baselines').delete(id);
  await txDone(tx);
}

// Internal type for cascade delete — only needs id
interface DetectionSessionRecord { id: string; }
```

- [ ] **Step 4: Run tests — all must pass**

```bash
pnpm test tests/persistence/db.test.ts
```

Expected: 9 passing tests.

- [ ] **Step 5: Full suite**

```bash
pnpm test
```

Expected: 12 test files, 82 tests, all pass.

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/persistence/db.ts packages/core/tests/persistence/db.test.ts
git -c user.name="panditAbhis" -c user.email="panditabhishek24@gmail.com" \
  commit -m "feat(core): add IndexedDB persistence — openDB, saveBaseline, listBaselines, loadBaseline, deleteBaseline"
```

---

## Task 5: persistence/session.ts + tests

**Files:**
- Create: `packages/core/src/persistence/session.ts`
- Create: `packages/core/tests/persistence/session.test.ts`

- [ ] **Step 1: Write failing tests**

Create `packages/core/tests/persistence/session.test.ts`:

```typescript
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
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd /Users/abhishekpandit/projects/panaural/packages/core && pnpm test tests/persistence/session.test.ts 2>&1 | tail -5
```

Expected: FAIL — cannot find module.

- [ ] **Step 3: Implement session.ts**

Create `packages/core/src/persistence/session.ts`:

```typescript
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
```

- [ ] **Step 4: Run tests — all must pass**

```bash
pnpm test tests/persistence/session.test.ts
```

Expected: 7 passing tests.

- [ ] **Step 5: Full suite**

```bash
pnpm test
```

Expected: 13 test files, 89 tests, all pass.

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/persistence/session.ts packages/core/tests/persistence/session.test.ts
git -c user.name="panditAbhis" -c user.email="panditabhishek24@gmail.com" \
  commit -m "feat(core): add session persistence — saveSession, listSessions, deleteSession"
```

---

## Task 6: Wire index.ts re-exports

**Files:**
- Modify: `packages/core/src/index.ts`

- [ ] **Step 1: Add persistence re-exports**

Append to the end of `packages/core/src/index.ts`:

```typescript
// Weekend 3
export * from './persistence/serialize.js';
export * from './persistence/db.js';
export * from './persistence/session.js';
```

- [ ] **Step 2: Final full test run**

```bash
cd /Users/abhishekpandit/projects/panaural/packages/core && pnpm test
```

Expected: 13 test files, 89 tests, all pass.

- [ ] **Step 3: Commit**

```bash
git add packages/core/src/index.ts
git -c user.name="panditAbhis" -c user.email="panditabhishek24@gmail.com" \
  commit -m "feat(core): export Weekend 3 persistence modules from index"
```

---

## Task 7: demo.html — Teaching Block + Guide entries + UI panels + inline JS

**Files:**
- Modify: `packages/demo/demo.html`

This is the largest task. Three sub-steps: (A) Guide entries + Teaching Block, (B) HTML panels, (C) inline JS.

### 7A: Insert Weekend 3 Teaching Block + Guide entries G-S, G-P, G-L

- [ ] **Step 1: Insert after G-R (line ~1556) and before LOAD AUDIO**

Find this exact string in demo.html:

```html
<!-- ================================================================== -->
<!--  LOAD AUDIO                                                         -->
<!-- ================================================================== -->
<div class="section-label" style="margin-top:20px">Instrument</div>
```

Insert the following block immediately before it:

```html
<!-- ================================================================== -->
<!--  WEEKEND 3 TEACHING BLOCK                                          -->
<!-- ================================================================== -->
<div class="section-label" style="margin-top:20px">Weekend 3 — Persistent Baseline Library</div>

<div class="card">
  <h2>What Weekend 3 Adds</h2>
  <p>Weekends 1 and 2 built the measurement engine. But every time you refreshed the page, your
  baseline disappeared. This is the core limitation of in-memory storage: it is fast, but it
  has no memory across sessions.</p>
  <p>Weekend 3 adds <strong>persistence</strong>: your baselines are now saved to
  <strong>IndexedDB</strong> — a structured database built into every modern browser. No server.
  No account. Data survives tab close, page refresh, and machine restart. You can name each
  baseline, tag it to a machine, add notes, and compare new recordings against baselines from
  months ago.</p>
  <p>This transforms Panaural from a one-shot analysis tool into a
  <strong>longitudinal condition monitoring program</strong> — the kind that ISO 13373-2 requires
  for serious predictive maintenance.</p>

  <h3>What IndexedDB is (in two minutes)</h3>
  <div class="mono-block">IndexedDB is a key-value store with indexes, built into every browser.
Think of it as a small SQLite database that lives in your browser profile.

Key properties:
  Persistent:   data survives page refresh and browser restart
  Structured:   you can store objects, not just strings
  Indexed:      you can query by machineId, savedAt, baselineId
  Private:      no data leaves your machine (no server involved)
  Capacity:     50 MB+ per origin on most browsers (our baselines are ~65 KB each)
  Async:        all operations return Promises (no blocking the UI)

How Panaural uses it:
  Object store "baselines"  -- one record per SavedBaseline (name + mu + sigma + metadata)
  Object store "sessions"   -- one record per DetectionSession (results + FK to baseline)
  deleteBaseline cascades:  deleting a baseline also deletes all its sessions</div>

  <h3>The longitudinal monitoring workflow</h3>
  <div class="mono-block">Week 0  (machine commissioned):
  Load healthy WAV -> Record Baseline -> name "Pump A — commissioning" -> Save to Library

Week 4  (first check):
  Load new WAV -> Load baseline from Library -> Run Detection -> NORMAL (maxAbsZ 0.3)
  Session auto-saved to Detection Log.

Week 12 (quarterly check):
  Load new WAV -> Load baseline -> Run Detection -> WARNING (maxAbsZ 3.4, bin at 84 Hz)
  Cross-reference with BPFO = 84 Hz (Guide G11). Schedule bearing inspection.

Week 16 (post-inspection):
  Bearing replaced. New healthy recording.
  Save new baseline: "Pump A — post-bearing-replacement".
  Old baseline kept for historical reference.

The detection log tells the story of a machine's health over time.
A single alert means little. Three escalating warnings mean act now.</div>
</div>

<!-- G-S: Named baseline library -->
<details>
  <summary>
    G-S &mdash; Named baseline library &mdash; why one baseline is never enough
    <span class="badge b-edu" style="margin-left:6px">Weekend 3</span>
    <span class="toggle"></span>
  </summary>
  <div class="acc-body">
    <p>A single baseline captures the machine's spectrum at one moment in time, under one
    set of conditions. Real machines are not that simple. Load changes. Temperature changes.
    Operating speed changes. A baseline taken at 50% load will flag normal full-load operation
    as an anomaly. A named baseline library lets you maintain separate references for each
    operating condition.</p>

    <h3>What to name your baselines</h3>
    <div class="mono-block">Machine ID: the asset tag or pump number (e.g. "Pump A")
Name:       condition + date (e.g. "Pump A — full load — 2026-07")
Notes:      anything that would help you interpret an alert later:
            "Ambient temp 28 C. Flow rate 120 L/min. Just serviced."

Good baseline library for one pump:
  "Pump A — commissioning"         (the gold standard: new bearings, clean shaft)
  "Pump A — summer full load"      (high ambient temp, maximum flow)
  "Pump A — winter low load"       (cold start, 40% capacity)
  "Pump A — post-bearing-rpl"      (after first bearing replacement, new reference)

Compare new recordings to the most appropriate baseline for the current conditions.</div>

    <h3>Export/import for team sharing</h3>
    <div class="mono-block">Export: downloads a JSON file containing the full baseline
  (name, metadata, all 4097 mu values, all 4097 sigma values).
  File size: ~130 KB uncompressed.

Import: upload that JSON file on any machine running Panaural.
  The baseline appears in the library immediately.
  Use case: a lab technician builds the baseline in a controlled environment,
  emails the JSON to the field engineer, who imports it on a laptop at the site.</div>

    <div class="callout">
      <strong>Analogy &mdash; the patient's medical record:</strong> A doctor does not rely on
      a single blood test. They compare today's result to the same patient's results from 6 months
      ago, 1 year ago, after each treatment. The baseline library is the machine's medical record.
      Without it, every reading is interpreted in a vacuum.
    </div>
  </div>
</details>

<!-- G-P: Persistence and longitudinal monitoring -->
<details>
  <summary>
    G-P &mdash; Persistence and longitudinal monitoring &mdash; how memory changes the tool
    <span class="badge b-edu" style="margin-left:6px">Weekend 3</span>
    <span class="toggle"></span>
  </summary>
  <div class="acc-body">
    <p>Without persistence, every Panaural session is independent. You build a baseline, detect
    drift, close the tab — everything is gone. The next session starts from scratch. This is fine
    for a demo. It is useless for a maintenance program.</p>

    <p>With persistence, Panaural gains <strong>institutional memory</strong>. The database
    accumulates evidence over weeks and months. Patterns emerge that no single session could reveal.</p>

    <h3>What IndexedDB stores for each baseline</h3>
    <div class="mono-block">SavedBaseline record:
  id:                  "a3f7c2d1-..."       (UUID, primary key)
  name:                "Pump A — summer"
  machineId:           "Pump A"
  notes:               "Flow 120 L/min, temp 28 C"
  sourceFile:          "pump_a_2026_07.wav"
  savedAt:             "2026-07-08T10:00:00Z"
  baseline.mu:         [-18.5, -70.2, ..., -116.0]   (4097 values)
  baseline.sigma:      [0.5, 0.5, ..., 1.2]           (4097 values)
  baseline.numFrames:  30
  baseline.freqRes:    0.977   (Hz/bin)

Total record size: ~130 KB. Browser IndexedDB limit: 50 MB+.
You can store ~400 baselines per machine before hitting limits.</div>

    <h3>What IndexedDB stores for each detection session</h3>
    <div class="mono-block">DetectionSession record:
  id:              "b9e4a1f2-..."
  baselineId:      "a3f7c2d1-..."    (links to the baseline used)
  sourceFile:      "pump_a_2026_10.wav"
  alertLevel:      "warning"
  maxAbsZ:         3.7
  numBinsAlerting: 2
  cusumAlertBins:  1
  topBins:         [{ freq: 84.2, z: 3.7 }, { freq: 168.4, z: 2.1 }]
  detectedAt:      "2026-10-14T09:30:00Z"

Size: ~1 KB. You can store 50,000 sessions per machine.</div>

    <div class="callout">
      <strong>Analogy &mdash; the pilot's logbook:</strong> A pilot is required to log every
      flight: date, duration, aircraft, conditions. A single flight tells you nothing. The logbook
      tells you total hours, recent experience, and trends. Panaural's detection log is the
      machine's flight logbook — every inspection recorded, evidence accumulating.
    </div>
  </div>
</details>

<!-- G-L: Reading a detection history -->
<details>
  <summary>
    G-L &mdash; Reading a detection history &mdash; spotting degradation trends over time
    <span class="badge b-edu" style="margin-left:6px">Weekend 3</span>
    <span class="toggle"></span>
  </summary>
  <div class="acc-body">
    <p>A detection log is only useful if you know how to read it. A single alert can be a
    microphone bump, a door slam during recording, or a genuine fault. Multiple sessions tell
    a different story.</p>

    <h3>The escalation pattern</h3>
    <div class="mono-block">Date         Alert    maxAbsZ   Top frequency   Interpretation
2026-07-08   NORMAL   0.3       49.8 Hz         Healthy. No action.
2026-08-12   NORMAL   0.7       49.8 Hz         Healthy. Small increase — monitor.
2026-09-09   WARNING  3.4       84.2 Hz         New energy at 84 Hz. Cross-ref BPFO.
2026-10-14   WARNING  4.1       84.2 Hz         BPFO growing. Schedule inspection.
2026-11-11   ALERT    6.8       84.2 Hz         Bearing deterioration confirmed. Act now.

The 84.2 Hz frequency is BPFO for a 6205-2RS bearing at 1450 RPM (see Guide G11).
The escalating z-score at that frequency over 5 months is a textbook bearing fault curve.</div>

    <h3>What to look for in the log</h3>
    <div class="mono-block">MONOTONICALLY INCREASING maxAbsZ at the same frequency:
  Almost certainly a developing mechanical fault at that frequency.
  Action: schedule inspection, cross-reference with bearing fault formulas.

SINGLE ISOLATED ALERT, then normal:
  Likely environmental: mic bumped, door slam, pressure surge during recording.
  Action: record again under identical conditions. If normal, discard the alert.

BROADBAND INCREASE (many bins alerting):
  Could be increased load, speed change, or loose mounting vibration.
  Action: verify operating conditions match the baseline conditions.
  If conditions match, inspect for structural looseness.

CUSUM ALERT BINS INCREASING OVER TIME:
  The CUSUM accumulator is filling — slow monotonic drift.
  Even if maxAbsZ looks OK each session individually, the trend is real.
  Action: treat like a WARNING even if alertLevel shows NORMAL.</div>

    <div class="callout amber">
      <strong>Remember:</strong> Panaural is indicative only. A detection log showing escalating
      warnings at a bearing frequency is strong evidence worth acting on — but a qualified
      engineer must make the final maintenance decision. Never shut down machinery based solely
      on Panaural output without qualified sign-off.
    </div>
  </div>
</details>
```

### 7B: Insert Baseline Library and Detection Log HTML panels

- [ ] **Step 2: Insert new panels after the existing drift card and before SELF-TEST**

Find this exact string in demo.html:

```html
<!-- ================================================================== -->
<!--  SELF-TEST                                                          -->
<!-- ================================================================== -->
<div class="card" id="selfTestCard">
```

Insert before it:

```html
<!-- ================================================================== -->
<!--  SAVE BASELINE FORM (appears after baseline is recorded)           -->
<!-- ================================================================== -->
<div class="card" id="saveBaselineCard" style="display:none">
  <h2>Save Baseline to Library</h2>
  <p style="font-size:13px;color:var(--muted);margin-bottom:14px">
    Give this baseline a name so you can load it in future sessions. The name and machine ID
    will appear in your Baseline Library. Notes are optional but recommended: record operating
    conditions (load, temperature, flow rate) so you can match conditions when comparing later.
  </p>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px">
    <div>
      <label style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--muted);display:block;margin-bottom:4px">Baseline name (required)</label>
      <input id="blName" type="text" placeholder="e.g. Pump A — full load — 2026-07"
        style="width:100%;box-sizing:border-box;background:var(--s3);border:1px solid var(--bd);color:#e4e4e7;border-radius:4px;padding:7px 10px;font-size:13px;font-family:monospace" />
    </div>
    <div>
      <label style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--muted);display:block;margin-bottom:4px">Machine / Asset ID (required)</label>
      <input id="blMachineId" type="text" placeholder="e.g. Pump A"
        style="width:100%;box-sizing:border-box;background:var(--s3);border:1px solid var(--bd);color:#e4e4e7;border-radius:4px;padding:7px 10px;font-size:13px;font-family:monospace" />
    </div>
  </div>
  <div style="margin-bottom:10px">
    <label style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--muted);display:block;margin-bottom:4px">Notes (optional)</label>
    <textarea id="blNotes" placeholder="Operating conditions: load, temperature, flow rate, recent maintenance..."
      style="width:100%;box-sizing:border-box;background:var(--s3);border:1px solid var(--bd);color:#e4e4e7;border-radius:4px;padding:7px 10px;font-size:13px;font-family:monospace;height:60px;resize:vertical"></textarea>
  </div>
  <div style="display:flex;align-items:center;gap:14px">
    <button id="btnSaveBaseline" style="background:var(--blue);color:#000;border:none;border-radius:4px;padding:8px 18px;font-weight:700;font-size:13px;cursor:pointer">
      Save to Library
    </button>
    <span id="saveBaselineStatus" style="font-size:12px;color:var(--muted);font-family:monospace"></span>
  </div>
</div>

<!-- ================================================================== -->
<!--  BASELINE LIBRARY                                                  -->
<!-- ================================================================== -->
<div class="section-label" style="margin-top:20px">Baseline Library</div>

<div class="card" id="libraryCard">
  <h2>Baseline Library</h2>
  <p style="font-size:13px;color:var(--muted);margin-bottom:14px">
    All baselines saved in this browser. Click <strong>Load</strong> to set a baseline as active
    for detection. <strong>Export JSON</strong> downloads the baseline as a file you can share
    or import on another machine. <strong>Delete</strong> removes the baseline and all its
    detection sessions permanently.
  </p>
  <div style="display:flex;gap:8px;margin-bottom:12px">
    <label style="background:var(--s3);border:1px solid var(--bd);border-radius:4px;padding:6px 14px;font-size:12px;font-weight:700;color:#e4e4e7;cursor:pointer">
      Import JSON
      <input type="file" id="importInput" accept=".json" style="display:none" />
    </label>
    <span id="importStatus" style="font-size:12px;color:var(--muted);font-family:monospace;align-self:center"></span>
  </div>
  <div id="libraryEmpty" style="font-size:13px;color:var(--muted);padding:12px 0">
    No baselines saved yet. Record a baseline above and click "Save to Library".
  </div>
  <table id="libraryTable" style="display:none">
    <thead>
      <tr>
        <th>Name</th>
        <th>Machine</th>
        <th>Frames</th>
        <th>Hz/bin</th>
        <th>Saved</th>
        <th>Actions</th>
      </tr>
    </thead>
    <tbody id="libraryBody"></tbody>
  </table>
</div>

<!-- ================================================================== -->
<!--  DETECTION LOG                                                     -->
<!-- ================================================================== -->
<div class="section-label" style="margin-top:20px">Detection Log</div>

<div class="card" id="logCard">
  <h2>Detection Log</h2>
  <p style="font-size:13px;color:var(--muted);margin-bottom:14px">
    All detection sessions run against the currently active baseline.
    Each row is one "Run Detection" call — the WAV file compared, the alert level,
    the worst single-bin z-score (maxAbsZ), and the top alerting frequency.
    A single alert may be noise. A trend of escalating values is a fault developing.
    See Guide G-L for how to read this table.
  </p>
  <div id="logEmpty" style="font-size:13px;color:var(--muted);padding:12px 0">
    No active baseline loaded from library. Load a baseline above to see its detection history.
  </div>
  <div id="logContent" style="display:none">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
      <span id="logBaselineName" style="font-size:12px;font-family:monospace;color:var(--blue)"></span>
      <button id="btnClearLog" style="background:transparent;border:1px solid var(--bd);color:var(--muted);border-radius:4px;padding:4px 10px;font-size:11px;cursor:pointer">
        Clear log
      </button>
    </div>
    <table id="logTable">
      <thead>
        <tr>
          <th>Date</th>
          <th>Source file</th>
          <th>Alert</th>
          <th>maxAbsZ</th>
          <th>CUSUM bins</th>
          <th>Top frequency</th>
        </tr>
      </thead>
      <tbody id="logBody"></tbody>
    </table>
  </div>
</div>
```

### 7C: Add inline JavaScript for all persistence operations

- [ ] **Step 3: Insert Weekend 3 JS before `</script>`**

Find this exact string:

```javascript
// ── Weekend 2: Baseline + Drift detection ────────────────────────────────────
```

Insert BEFORE it:

```javascript
// ── Weekend 3: IndexedDB Persistence ─────────────────────────────────────────

const W3_DB_NAME = 'panaural-db';
const W3_DB_VERSION = 1;
let W3_db = null;                  // IDBDatabase, set on DOMContentLoaded
let W3_activeBaselineId = null;    // id of the baseline currently loaded from library
let W3_activeLoadedFile = 'unknown.wav'; // track current filename for session saving

// ── IDB helpers ──────────────────────────────────────────────────────────────
function w3_req(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
function w3_txDone(tx) {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

// ── openDB ───────────────────────────────────────────────────────────────────
function w3_openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(W3_DB_NAME, W3_DB_VERSION);
    request.onupgradeneeded = function(event) {
      const db = event.target.result;
      if (!db.objectStoreNames.contains('baselines')) {
        const s = db.createObjectStore('baselines', { keyPath: 'id' });
        s.createIndex('machineId', 'machineId', { unique: false });
        s.createIndex('savedAt', 'savedAt', { unique: false });
      }
      if (!db.objectStoreNames.contains('sessions')) {
        const s = db.createObjectStore('sessions', { keyPath: 'id' });
        s.createIndex('baselineId', 'baselineId', { unique: false });
        s.createIndex('detectedAt', 'detectedAt', { unique: false });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// ── Serialize / deserialize (mirrors persistence/serialize.ts) ───────────────
function w3_serializeBaseline(baseline) {
  return {
    mu: Array.from(baseline.mu),
    sigma: Array.from(baseline.sigma),
    numFrames: baseline.numFrames,
    frequencyResolution: baseline.freqRes || 0,
    builtAt: baseline.builtAt,
  };
}
function w3_deserializeBaseline(s) {
  return {
    mu: new Float64Array(s.mu),
    sigma: new Float64Array(s.sigma),
    numFrames: s.numFrames,
    frequencyResolution: s.frequencyResolution,
    builtAt: s.builtAt,
    freqRes: s.frequencyResolution,
  };
}
function w3_exportToJSON(saved) { return JSON.stringify(saved, null, 2); }
function w3_importFromJSON(json) {
  const p = JSON.parse(json);
  const req = ['id','name','machineId','notes','sourceFile','baseline','savedAt'];
  const missing = req.filter(k => !(k in p));
  if (missing.length) throw new Error('Missing required fields: ' + missing.join(', '));
  return p;
}

// ── Baseline CRUD ─────────────────────────────────────────────────────────────
async function w3_saveBaseline(saved) {
  const tx = W3_db.transaction('baselines', 'readwrite');
  await w3_req(tx.objectStore('baselines').put(saved));
  await w3_txDone(tx);
  return saved.id;
}
async function w3_listBaselines() {
  const tx = W3_db.transaction('baselines', 'readonly');
  const all = await w3_req(tx.objectStore('baselines').getAll());
  return all.sort((a, b) => b.savedAt.localeCompare(a.savedAt));
}
async function w3_loadBaseline(id) {
  const tx = W3_db.transaction('baselines', 'readonly');
  const result = await w3_req(tx.objectStore('baselines').get(id));
  return result || null;
}
async function w3_deleteBaseline(id) {
  // Cascade: delete sessions first
  const stx = W3_db.transaction('sessions', 'readwrite');
  const sessions = await w3_req(stx.objectStore('sessions').index('baselineId').getAll(id));
  for (const s of sessions) stx.objectStore('sessions').delete(s.id);
  await w3_txDone(stx);
  // Delete baseline
  const tx = W3_db.transaction('baselines', 'readwrite');
  tx.objectStore('baselines').delete(id);
  await w3_txDone(tx);
}

// ── Session CRUD ──────────────────────────────────────────────────────────────
async function w3_saveSession(session) {
  const tx = W3_db.transaction('sessions', 'readwrite');
  await w3_req(tx.objectStore('sessions').put(session));
  await w3_txDone(tx);
  return session.id;
}
async function w3_listSessions(baselineId) {
  const tx = W3_db.transaction('sessions', 'readonly');
  const all = await w3_req(tx.objectStore('sessions').index('baselineId').getAll(baselineId));
  return all.sort((a, b) => b.detectedAt.localeCompare(a.detectedAt));
}
async function w3_clearSessions(baselineId) {
  const tx = W3_db.transaction('sessions', 'readwrite');
  const store = tx.objectStore('sessions');
  const sessions = await w3_req(store.index('baselineId').getAll(baselineId));
  for (const s of sessions) store.delete(s.id);
  await w3_txDone(tx);
}

// ── UUID helper (crypto.randomUUID not available in all file:// contexts) ─────
function w3_uuid() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  });
}

// ── Library render ────────────────────────────────────────────────────────────
async function w3_renderLibrary() {
  const list = await w3_listBaselines();
  const empty = document.getElementById('libraryEmpty');
  const table = document.getElementById('libraryTable');
  const tbody = document.getElementById('libraryBody');
  if (list.length === 0) {
    empty.style.display = ''; table.style.display = 'none'; return;
  }
  empty.style.display = 'none'; table.style.display = '';
  tbody.innerHTML = '';
  for (const saved of list) {
    const tr = document.createElement('tr');
    if (saved.id === W3_activeBaselineId) tr.style.borderLeft = '3px solid var(--green)';
    const date = saved.savedAt.slice(0, 10);
    const freqRes = saved.baseline.frequencyResolution
      ? saved.baseline.frequencyResolution.toFixed(3) : '—';
    tr.innerHTML = `
      <td style="font-weight:600">${saved.name}</td>
      <td style="color:var(--muted)">${saved.machineId}</td>
      <td style="font-family:monospace">${saved.baseline.numFrames}</td>
      <td style="font-family:monospace">${freqRes}</td>
      <td style="font-family:monospace;color:var(--muted)">${date}</td>
      <td>
        <button class="w3-btn-load" data-id="${saved.id}"
          style="background:var(--blue);color:#000;border:none;border-radius:3px;padding:3px 8px;font-size:11px;font-weight:700;cursor:pointer;margin-right:4px">Load</button>
        <button class="w3-btn-export" data-id="${saved.id}"
          style="background:var(--s3);color:#e4e4e7;border:1px solid var(--bd);border-radius:3px;padding:3px 8px;font-size:11px;cursor:pointer;margin-right:4px">Export JSON</button>
        <button class="w3-btn-delete" data-id="${saved.id}" data-name="${saved.name}"
          style="background:transparent;color:var(--red);border:1px solid var(--red);border-radius:3px;padding:3px 8px;font-size:11px;cursor:pointer">Delete</button>
      </td>`;
    tbody.appendChild(tr);
  }
}

// ── Detection log render ──────────────────────────────────────────────────────
async function w3_renderLog() {
  const empty = document.getElementById('logEmpty');
  const content = document.getElementById('logContent');
  if (!W3_activeBaselineId) {
    empty.style.display = ''; content.style.display = 'none'; return;
  }
  const saved = await w3_loadBaseline(W3_activeBaselineId);
  if (!saved) {
    empty.style.display = ''; content.style.display = 'none'; return;
  }
  document.getElementById('logBaselineName').textContent =
    'Active baseline: ' + saved.name + ' (' + saved.machineId + ')';
  const sessions = await w3_listSessions(W3_activeBaselineId);
  empty.style.display = 'none'; content.style.display = '';
  const tbody = document.getElementById('logBody');
  tbody.innerHTML = '';
  if (sessions.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" style="color:var(--muted);font-size:12px">No detection sessions yet for this baseline.</td></tr>';
    return;
  }
  const alrtClr = { normal: 'var(--green)', warning: 'var(--amber)', alert: 'var(--red)' };
  for (const s of sessions) {
    const tr = document.createElement('tr');
    const top = s.topBins && s.topBins[0]
      ? (s.topBins[0].freq < 10 ? s.topBins[0].freq.toFixed(2)
         : s.topBins[0].freq < 100 ? s.topBins[0].freq.toFixed(1)
         : Math.round(s.topBins[0].freq)) + ' Hz  z=' + s.topBins[0].z.toFixed(1)
      : '—';
    tr.innerHTML = `
      <td style="font-family:monospace;font-size:11px">${s.detectedAt.slice(0,16).replace('T',' ')}</td>
      <td style="font-family:monospace;font-size:11px;color:var(--muted)">${s.sourceFile}</td>
      <td style="font-weight:700;color:${alrtClr[s.alertLevel]}">${s.alertLevel.toUpperCase()}</td>
      <td style="font-family:monospace">${s.maxAbsZ.toFixed(2)}</td>
      <td style="font-family:monospace">${s.cusumAlertBins}</td>
      <td style="font-family:monospace;font-size:11px">${top}</td>`;
    tbody.appendChild(tr);
  }
}

// ── Event: Save Baseline button ───────────────────────────────────────────────
document.getElementById('btnSaveBaseline').addEventListener('click', async function() {
  const name = document.getElementById('blName').value.trim();
  const machineId = document.getElementById('blMachineId').value.trim();
  const notes = document.getElementById('blNotes').value.trim();
  const status = document.getElementById('saveBaselineStatus');
  if (!name) { status.textContent = 'Name is required.'; status.style.color = 'var(--red)'; return; }
  if (!machineId) { status.textContent = 'Machine ID is required.'; status.style.color = 'var(--red)'; return; }
  if (!W2_baseline) { status.textContent = 'No baseline recorded yet.'; status.style.color = 'var(--red)'; return; }

  const saved = {
    id: w3_uuid(),
    name,
    machineId,
    notes,
    sourceFile: W3_activeLoadedFile,
    baseline: w3_serializeBaseline(W2_baseline),
    savedAt: new Date().toISOString(),
  };
  await w3_saveBaseline(saved);
  status.textContent = 'Saved to library.';
  status.style.color = 'var(--green)';
  document.getElementById('blName').value = '';
  document.getElementById('blMachineId').value = '';
  document.getElementById('blNotes').value = '';
  await w3_renderLibrary();
});

// ── Event: Library button clicks (load / export / delete) ────────────────────
document.getElementById('libraryBody').addEventListener('click', async function(e) {
  const btn = e.target.closest('button');
  if (!btn) return;
  const id = btn.dataset.id;

  if (btn.classList.contains('w3-btn-load')) {
    const saved = await w3_loadBaseline(id);
    if (!saved) return;
    // Deserialize and set as active baseline for W2 detection
    W2_baseline = w3_deserializeBaseline(saved.baseline);
    W3_activeBaselineId = id;
    document.getElementById('baselineStatus').textContent =
      'Loaded from library: ' + saved.name + ' | ' + saved.baseline.numFrames + ' frames | ' + saved.savedAt.slice(0,10);
    const btnDetect = document.getElementById('btnDetect');
    btnDetect.disabled = false;
    btnDetect.style.background = 'var(--blue)';
    btnDetect.style.color = '#000';
    btnDetect.style.cursor = 'pointer';
    await w3_renderLibrary();
    await w3_renderLog();
    return;
  }

  if (btn.classList.contains('w3-btn-export')) {
    const saved = await w3_loadBaseline(id);
    if (!saved) return;
    const json = w3_exportToJSON(saved);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = saved.name.replace(/[^a-z0-9]/gi, '_') + '.json';
    a.click(); URL.revokeObjectURL(url);
    return;
  }

  if (btn.classList.contains('w3-btn-delete')) {
    if (!confirm('Delete baseline "' + btn.dataset.name + '" and all its detection sessions?')) return;
    if (W3_activeBaselineId === id) {
      W3_activeBaselineId = null;
      W2_baseline = null;
      document.getElementById('baselineStatus').textContent = 'No baseline recorded.';
      document.getElementById('btnDetect').disabled = true;
      document.getElementById('btnDetect').style.background = 'var(--s3)';
      document.getElementById('btnDetect').style.color = 'var(--muted)';
      document.getElementById('btnDetect').style.cursor = 'not-allowed';
    }
    await w3_deleteBaseline(id);
    await w3_renderLibrary();
    await w3_renderLog();
    return;
  }
});

// ── Event: Import JSON ────────────────────────────────────────────────────────
document.getElementById('importInput').addEventListener('change', async function(e) {
  const file = e.target.files[0]; if (!file) return;
  const status = document.getElementById('importStatus');
  try {
    const text = await file.text();
    const saved = w3_importFromJSON(text);
    await w3_saveBaseline(saved);
    status.textContent = 'Imported: ' + saved.name;
    status.style.color = 'var(--green)';
    await w3_renderLibrary();
  } catch (err) {
    status.textContent = 'Import failed: ' + err.message;
    status.style.color = 'var(--red)';
  }
  e.target.value = '';
});

// ── Event: Clear detection log ────────────────────────────────────────────────
document.getElementById('btnClearLog').addEventListener('click', async function() {
  if (!W3_activeBaselineId) return;
  if (!confirm('Clear all detection sessions for this baseline?')) return;
  await w3_clearSessions(W3_activeBaselineId);
  await w3_renderLog();
});

// ── Track loaded filename for session metadata ─────────────────────────────────
// Patch into the existing fileInput change handler by listening capture=true
document.getElementById('fileInput').addEventListener('change', function(e) {
  if (e.target.files[0]) W3_activeLoadedFile = e.target.files[0].name;
}, true);

// ── Show Save Baseline form when baseline is recorded ─────────────────────────
// We patch the existing btnBaseline handler by adding a second listener.
document.getElementById('btnBaseline').addEventListener('click', function() {
  // The primary listener (Weekend 2) runs first, sets W2_baseline.
  // We check after a tick so W2_baseline is already set.
  setTimeout(function() {
    if (W2_baseline) {
      document.getElementById('saveBaselineCard').style.display = '';
      // Pre-fill source file
    }
  }, 0);
});

// ── Hook Run Detection to auto-save the session ───────────────────────────────
// Patch btnDetect: add second listener that reads the result after W2 sets the DOM.
document.getElementById('btnDetect').addEventListener('click', async function() {
  // W2 listener runs first synchronously, updates the DOM.
  // We read from DOM and W3_activeBaselineId to save the session.
  await new Promise(r => setTimeout(r, 0)); // yield to let W2 handler complete
  if (!W3_activeBaselineId && !W2_baseline) return;

  const mAlertEl = document.getElementById('mAlert');
  const mDetailEl = document.getElementById('mDetail');
  const cAlertEl = document.getElementById('cAlert');
  if (!mAlertEl.textContent || mAlertEl.textContent === '--') return;

  const alertLevel = mAlertEl.textContent.toLowerCase();
  const detailParts = mDetailEl.textContent.split('|');
  const maxAbsZ = parseFloat(detailParts[0].replace('maxAbsZ =', '').trim()) || 0;
  const numBinsAlerting = parseInt(detailParts[1]) || 0;
  const cusumAlertBins = parseInt(cAlertEl.textContent) || 0;

  // Collect top bins from DOM
  const topBins = [];
  document.querySelectorAll('#topBinsRow .peak-chip').forEach(chip => {
    const txt = chip.textContent; // "49.8 Hz  z=2.1"
    const fMatch = txt.match(/([\d.]+)\s*Hz/);
    const zMatch = txt.match(/z=([\d.]+)/);
    if (fMatch && zMatch) topBins.push({ freq: parseFloat(fMatch[1]), z: parseFloat(zMatch[1]) });
  });

  const session = {
    id: w3_uuid(),
    baselineId: W3_activeBaselineId || 'unsaved',
    sourceFile: W3_activeLoadedFile,
    alertLevel: (alertLevel === 'alert' || alertLevel === 'warning' || alertLevel === 'normal')
      ? alertLevel : 'normal',
    maxAbsZ,
    numBinsAlerting,
    cusumAlertBins,
    topBins,
    detectedAt: new Date().toISOString(),
  };

  if (W3_activeBaselineId && W3_db) {
    await w3_saveSession(session);
    await w3_renderLog();
  }
});

// ── Init on page load ─────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async function() {
  try {
    W3_db = await w3_openDB();
    await w3_renderLibrary();
    await w3_renderLog();
  } catch (err) {
    console.error('Panaural: IndexedDB unavailable:', err);
  }
});
```

- [ ] **Step 4: Run full test suite (core only — demo is browser-tested)**

```bash
cd /Users/abhishekpandit/projects/panaural/packages/core && pnpm test
```

Expected: 13 test files, 89 tests, all pass.

- [ ] **Step 5: Open demo in browser and verify**

Navigate to `file:///Users/abhishekpandit/projects/panaural/packages/demo/demo.html`.

Check:
- Weekend 3 Teaching Block visible with Working Block
- Guide entries G-S, G-P, G-L visible and expandable
- "Baseline Library" section shows "No baselines saved yet"
- "Detection Log" section shows "No active baseline loaded"
- No console errors

- [ ] **Step 6: Test save → library → load → detect → log flow**

In browser DevTools console:

```javascript
// Simulate a WAV load (same as Weekend 2 test)
const SR = 8000, N = SR * 3, smp = new Float64Array(N);
for (let i = 0; i < N; i++) smp[i] = 0.3 * Math.sin(2 * Math.PI * 50 * i / SR);
const frames = computeSTFT(smp, 8000, 2000, 'hann');
renderSpectrogram(frames, SR, 8000, 2000, -80, -10, 500);
document.getElementById('btnBaseline').click();
// Save baseline form should appear.
// Fill name="Test baseline", machineId="Test pump", click Save to Library.
// Then click Run Detection. Check detection log appears.
```

Expected:
- Save form appears after Record Baseline click
- After Save to Library: baseline visible in library table
- After Run Detection: row appears in Detection Log

- [ ] **Step 7: Test export → import round-trip**

```javascript
// In console — click Export on the saved baseline
// Then delete it from the library
// Then import the downloaded JSON
// Baseline should reappear in library
```

Expected: baseline reappears after import, can be loaded and used for detection.

- [ ] **Step 8: Commit**

```bash
git add packages/demo/demo.html
git -c user.name="panditAbhis" -c user.email="panditabhishek24@gmail.com" \
  commit -m "feat(demo): Weekend 3 persistence UI — save form, baseline library, detection log, Guide entries G-S G-P G-L, Weekend 3 teaching block"
```

---

## Final verification

- [ ] **Run complete test suite**

```bash
cd /Users/abhishekpandit/projects/panaural/packages/core && pnpm test
```

Expected:
```
✓ tests/audit/logger.test.ts             (6)
✓ tests/transform/window.test.ts        (10)
✓ tests/transform/validate.test.ts       (7)
✓ tests/transform/stft.test.ts           (4)
✓ tests/validation/selftest.test.ts      (6)
✓ tests/baseline/quality.test.ts         (6)
✓ tests/baseline/build.test.ts           (5)
✓ tests/detector/mahalanobis.test.ts     (6)
✓ tests/detector/cusum.test.ts           (8)
✓ tests/calibration/reference.test.ts    (5)
✓ tests/persistence/serialize.test.ts   (10)
✓ tests/persistence/db.test.ts           (9)
✓ tests/persistence/session.test.ts      (7)
Test Files  13 passed (13)
Tests       89 passed (89)
```

- [ ] **Push to GitHub**

```bash
unset GITHUB_TOKEN && git push origin main
```
