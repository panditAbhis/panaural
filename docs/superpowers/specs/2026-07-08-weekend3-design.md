# Weekend 3 — Baseline Persistence + Detection Log

Date: 2026-07-08
Author: panditAbhis

## Context

Weekend 2 delivered in-memory baseline learning and drift detection. Baselines disappear on page refresh. Weekend 3 adds persistence: named baselines stored in IndexedDB, detection sessions logged, JSON export/import for cross-machine sharing.

Panaural is an open international reference. Every module ships with educational content.

## Scope

- Multiple named baselines in IndexedDB (browser built-in, no server)
- Detection session log per baseline
- JSON export (download) and import (upload) for cross-machine sharing
- Three new UI panels in demo.html
- Three new Guide entries (G-S, G-P, G-L)
- No server, no accounts, no sync — local browser storage only

## Architecture — approach A: thin DB wrapper + serialization layer

All persistence logic lives in `packages/core/src/persistence/`. Pure functions. All DB functions take `IDBDatabase` as a parameter (injected by caller) so they are testable with `fake-indexeddb` in Vitest without touching a real browser.

```
packages/core/src/persistence/
  serialize.ts   Float64Array <-> number[] conversion; JSON export/import
  db.ts          openDB(); baseline CRUD (saveBaseline, listBaselines, loadBaseline, deleteBaseline)
  session.ts     saveSession, listSessions, deleteSession

packages/core/tests/persistence/
  serialize.test.ts
  db.test.ts
  session.test.ts
```

## Data Model

New types added to `packages/core/src/types.ts`:

```typescript
/**
 * A named baseline saved to IndexedDB.
 * mu and sigma are stored as number[] (plain array) because Float64Array
 * is not consistently structured-clone-safe across all browsers.
 * deserializeBaseline() converts them back to Float64Array on load.
 */
export interface SavedBaseline {
  id: string;                      // crypto.randomUUID()
  name: string;                    // user-supplied e.g. "Pump A — summer 2026"
  machineId: string;               // asset tag e.g. "Pump A"
  notes: string;                   // free-text maintenance notes
  sourceFile: string;              // WAV filename used to build this baseline
  baseline: SerializedBaseline;    // see below
  savedAt: string;                 // ISO 8601
}

/**
 * Baseline with Float64Arrays converted to plain arrays for JSON/IDB storage.
 */
export interface SerializedBaseline {
  mu: number[];
  sigma: number[];
  numFrames: number;
  frequencyResolution: number;
  builtAt: string;
}

/**
 * One drift detection run saved to IndexedDB.
 */
export interface DetectionSession {
  id: string;                      // crypto.randomUUID()
  baselineId: string;              // FK -> SavedBaseline.id
  sourceFile: string;              // WAV filename compared
  alertLevel: 'normal' | 'warning' | 'alert';
  maxAbsZ: number;
  numBinsAlerting: number;
  cusumAlertBins: number;
  topBins: Array<{ freq: number; z: number }>;
  detectedAt: string;              // ISO 8601
}
```

## IndexedDB Schema

Database: `panaural-db`, version 1

```
Object store: baselines
  keyPath: "id"
  index: machineId  (for filtering by asset tag)
  index: savedAt    (for sorting newest-first)

Object store: sessions
  keyPath: "id"
  index: baselineId (to fetch all sessions for a given baseline)
  index: detectedAt (for sorting)
```

`deleteBaseline` cascades: deletes all sessions with matching `baselineId` before deleting the baseline record.

## Function Signatures

### serialize.ts

```typescript
// Convert live Baseline to storage-safe form (Float64Array -> number[])
serializeBaseline(b: Baseline): SerializedBaseline

// Convert stored form back to live Baseline (number[] -> Float64Array)
deserializeBaseline(s: SerializedBaseline): Baseline

// Produce a JSON string suitable for file download
exportToJSON(saved: SavedBaseline): string

// Parse a JSON string from file upload; throws on invalid structure
importFromJSON(json: string): SavedBaseline
```

### db.ts

```typescript
// Open (or create) the panaural-db IndexedDB database
openDB(): Promise<IDBDatabase>

// Save a SavedBaseline; returns its id
saveBaseline(db: IDBDatabase, saved: SavedBaseline): Promise<string>

// Return all baselines sorted by savedAt descending
listBaselines(db: IDBDatabase): Promise<SavedBaseline[]>

// Return one baseline by id, or null if not found
loadBaseline(db: IDBDatabase, id: string): Promise<SavedBaseline | null>

// Delete baseline and all its sessions
deleteBaseline(db: IDBDatabase, id: string): Promise<void>
```

### session.ts

```typescript
// Save a DetectionSession; returns its id
saveSession(db: IDBDatabase, session: DetectionSession): Promise<string>

// Return all sessions for a baseline, sorted by detectedAt descending
listSessions(db: IDBDatabase, baselineId: string): Promise<DetectionSession[]>

// Delete one session by id
deleteSession(db: IDBDatabase, id: string): Promise<void>
```

## Demo UI Additions

### Panel 1 — Save Baseline form

Appears after "Record Baseline" succeeds (currently shows status text only).

Fields:
- Name (required)
- Machine ID (required)
- Notes (optional textarea)
- Source file (auto-filled from loaded WAV filename, read-only)

"Save to Library" button writes to IndexedDB and refreshes the Baseline Library panel.

Guide entry: G-S — why named baseline libraries matter for maintenance programs.

### Panel 2 — Baseline Library

Always visible on page load. Reads from IndexedDB on DOMContentLoaded.

Table columns: Name | Machine ID | Frames | Hz/bin | Saved | Actions

Per-row actions: Load (sets as active baseline for detection) | Export JSON (triggers file download) | Delete (with confirmation)

"Import JSON" button at top of panel: file picker → parse → validate → save to DB → refresh list.

Active baseline row highlighted with left border in green.

Guide entry: G-P — how persistence changes drift detection from a one-shot tool to a longitudinal monitoring program.

### Panel 3 — Detection Log

Visible when a baseline is loaded from the library. Shows detection history for the active baseline.

Table columns: Date | Source file | Alert | maxAbsZ | CUSUM bins | Top frequency

"Clear log" button deletes all sessions for the active baseline.

Guide entry: G-L — reading a detection history and spotting degradation trends across multiple sessions.

## Testing Strategy

`fake-indexeddb` added as dev dependency to `packages/core/package.json`. Provides a Node.js-compatible IndexedDB implementation for Vitest.

`serialize.ts` is pure — no DB dependency — tested directly.

`db.ts` and `session.ts` tests use `fake-indexeddb` to create a real (in-memory) IDBDatabase for each test. No mocking needed.

## Build Sequence

| Unit | Deliverable |
|------|-------------|
| 1 | `SavedBaseline`, `SerializedBaseline`, `DetectionSession` added to types.ts |
| 2 | `persistence/serialize.ts` + `tests/persistence/serialize.test.ts` |
| 3 | `persistence/db.ts` + `tests/persistence/db.test.ts` |
| 4 | `persistence/session.ts` + `tests/persistence/session.test.ts` |
| 5 | index.ts re-exports |
| 6 | demo.html: Save form + Baseline Library + Detection Log + Guide entries G-S, G-P, G-L |

Each unit: TDD (write failing tests first) → implement → pnpm test passes → commit → Guide entry ships with code.

## Success Criteria

- `pnpm test` exits 0 across all test files
- Round-trip: serializeBaseline → deserializeBaseline preserves mu/sigma values to float precision
- Save baseline → refresh page → baseline appears in library
- Load baseline from library → Run Detection → session appears in Detection Log
- Export JSON → import JSON on fresh page → baseline loads, detection works
- deleteBaseline cascades: no orphaned sessions remain
- All three Guide entries render without console errors in Chrome
