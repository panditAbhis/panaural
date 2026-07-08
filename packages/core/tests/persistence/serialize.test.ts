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
    const bad = JSON.stringify({ id: 'x' });
    expect(() => importFromJSON(bad)).toThrow(/missing required fields/);
  });
});
