// SPDX-License-Identifier: MIT
// Copyright (c) 2026 panditAbhis — Panaural Project

import { describe, it, expect } from 'vitest';
import { buildBaseline } from '../../src/baseline/build.js';
import type { FrameRecord } from '../../src/types.js';

const SR = 8000;
const N = SR;
const NUM_BINS = 4097;
const FFT_SIZE = 8192;

function makeSineRecord(freq: number, amp: number): FrameRecord {
  const rawSamples = new Float64Array(N);
  for (let i = 0; i < N; i++) rawSamples[i] = amp * Math.sin(2 * Math.PI * freq * i / SR);

  const peakBin = Math.round(freq * FFT_SIZE / SR);
  const bins = new Float64Array(NUM_BINS).fill(-80);
  const peakDb = 20 * Math.log10(amp / 2);
  bins[peakBin] = peakDb;
  bins[peakBin - 1] = peakDb - 6;
  bins[peakBin + 1] = peakDb - 6;
  return { rawSamples, bins };
}

describe('buildBaseline', () => {
  it('computes mu close to expected peak for stable signal (within 1 dB)', () => {
    const records = Array.from({ length: 30 }, () => makeSineRecord(50, 0.3));
    const baseline = buildBaseline(records);
    expect(baseline.numFrames).toBe(30);
    const peakBin = Math.round(50 * FFT_SIZE / SR);
    const expectedPeakDb = 20 * Math.log10(0.3 / 2);
    expect(Math.abs(baseline.mu[peakBin]! - expectedPeakDb)).toBeLessThan(1.0);
  });

  it('sigma at stable bin is floored to 0.5 for identical frames', () => {
    const records = Array.from({ length: 30 }, () => makeSineRecord(50, 0.3));
    const baseline = buildBaseline(records);
    const peakBin = Math.round(50 * FFT_SIZE / SR);
    expect(baseline.sigma[peakBin]!).toBeCloseTo(0.5, 1);
  });

  it('throws when fewer than minFrames pass quality filter', () => {
    const clippedRecords: FrameRecord[] = Array.from({ length: 5 }, () => ({
      rawSamples: new Float64Array(N).fill(0.99),
      bins: new Float64Array(NUM_BINS).fill(-20),
    }));
    expect(() => buildBaseline(clippedRecords, { minFrames: 10 })).toThrow(
      /fewer than 10 usable frames/,
    );
  });

  it('stores the frequencyResolution option on the baseline', () => {
    const records = Array.from({ length: 15 }, () => makeSineRecord(50, 0.3));
    const baseline = buildBaseline(records, { frequencyResolution: 0.977 });
    expect(baseline.frequencyResolution).toBe(0.977);
  });

  it('sigma floor is 0.5 dB for every bin', () => {
    const records = Array.from({ length: 15 }, () => makeSineRecord(50, 0.3));
    const baseline = buildBaseline(records);
    for (let k = 0; k < NUM_BINS; k++) {
      expect(baseline.sigma[k]!).toBeGreaterThanOrEqual(0.5);
    }
  });
});
