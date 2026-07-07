// SPDX-License-Identifier: MIT
// Copyright (c) 2026 panditAbhis — Panaural Project

import { describe, it, expect } from 'vitest';
import { detectReferenceTone } from '../../src/calibration/reference.js';

const NUM_BINS = 4097;
const FREQ_RES = 0.977;

function binsWithTone(freqHz: number, toneDb: number, floorDb: number): Float64Array {
  const bins = new Float64Array(NUM_BINS).fill(floorDb);
  const refBin = Math.round(freqHz / FREQ_RES);
  bins[refBin] = toneDb;
  bins[refBin - 1] = toneDb - 6;
  bins[refBin + 1] = toneDb - 6;
  return bins;
}

describe('detectReferenceTone', () => {
  it('returns valid=true and measuredDb near tone level for a clear 440 Hz tone', () => {
    const bins = binsWithTone(440, -20, -80);
    const result = detectReferenceTone(bins, 440, FREQ_RES);
    expect(result.valid).toBe(true);
    expect(result.measuredDb).toBeLessThan(-19);
    expect(result.measuredDb).toBeGreaterThan(-27);
  });

  it('computes offsetDb = expectedDb - measuredDb', () => {
    const bins = binsWithTone(440, -20, -80);
    const result = detectReferenceTone(bins, 440, FREQ_RES, -18);
    expect(result.offsetDb).toBeCloseTo(-18 - result.measuredDb, 1);
  });

  it('returns valid=false when SNR at reference frequency is below 20 dB', () => {
    const bins = binsWithTone(440, -70, -80);
    const result = detectReferenceTone(bins, 440, FREQ_RES);
    expect(result.valid).toBe(false);
    expect(result.snrAtRefHz).toBeLessThan(20);
  });

  it('snrAtRefHz is large for a clear tone well above floor', () => {
    const bins = binsWithTone(440, -20, -80);
    const result = detectReferenceTone(bins, 440, FREQ_RES);
    expect(result.snrAtRefHz).toBeGreaterThan(40);
  });

  it('works at 100 Hz reference tone', () => {
    const bins = binsWithTone(100, -25, -80);
    const result = detectReferenceTone(bins, 100, FREQ_RES);
    expect(result.valid).toBe(true);
  });
});
