// SPDX-License-Identifier: MIT
// Copyright (c) 2026 panditAbhis — Panaural Project

import type { Baseline, SerializedBaseline, SavedBaseline } from '../types.js';

/**
 * Convert a live Baseline (Float64Arrays) to a storage-safe form (number[]).
 *
 * Float64Array is not reliably JSON-serialisable (JSON.stringify produces {})
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
