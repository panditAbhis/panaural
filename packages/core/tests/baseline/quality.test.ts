// SPDX-License-Identifier: MIT
// Copyright (c) 2026 panditAbhis — Panaural Project

import { describe, it, expect } from 'vitest';
import { scoreFrameQuality } from '../../src/baseline/quality.js';

function sine(n: number, freq: number, sr: number, amp: number): Float64Array {
  const s = new Float64Array(n);
  for (let i = 0; i < n; i++) s[i] = amp * Math.sin(2 * Math.PI * freq * i / sr);
  return s;
}

function binsWithPeak(numBins: number, peakBin: number, peakDb: number, floorDb: number): Float64Array {
  const b = new Float64Array(numBins).fill(floorDb);
  b[peakBin] = peakDb;
  b[peakBin - 1] = peakDb - 6;
  b[peakBin + 1] = peakDb - 6;
  return b;
}

describe('scoreFrameQuality', () => {
  const NUM_BINS = 4097;
  const SR = 8000;
  const N = SR;

  it('returns usable=true and score>=0.6 for a clean sine frame', () => {
    const raw = sine(N, 50, SR, 0.3);
    const bins = binsWithPeak(NUM_BINS, 51, -18, -70);
    const q = scoreFrameQuality(raw, bins);
    expect(q.usable).toBe(true);
    expect(q.score).toBeGreaterThanOrEqual(0.6);
    expect(q.flags).toHaveLength(0);
    expect(q.snrEstimate).toBeGreaterThan(15);
  });

  it('flags clipping when >1% of samples are at +-0.9', () => {
    const raw = new Float64Array(N).fill(0.95);
    const bins = binsWithPeak(NUM_BINS, 51, -18, -70);
    const q = scoreFrameQuality(raw, bins);
    expect(q.flags).toContain('clipping');
    expect(q.clippingFraction).toBeGreaterThan(0.01);
    expect(q.usable).toBe(false);
  });

  it('flags silence when all bins are below -60 dBFS', () => {
    const raw = new Float64Array(N).fill(0);
    const bins = new Float64Array(NUM_BINS).fill(-240);
    const q = scoreFrameQuality(raw, bins);
    expect(q.flags).toContain('silence');
    expect(q.usable).toBe(false);
    expect(q.score).toBe(0);
  });

  it('flags low_snr when peak is <15 dB above noise floor', () => {
    const raw = sine(N, 50, SR, 0.003);
    const bins = new Float64Array(NUM_BINS).fill(-60);
    bins[51] = -50;
    const q = scoreFrameQuality(raw, bins);
    expect(q.flags).toContain('low_snr');
    expect(q.snrEstimate).toBeLessThan(15);
  });

  it('flags transient when RMS is more than 6 dB above sessionMedianRms', () => {
    const raw = sine(N, 50, SR, 0.5);
    const bins = binsWithPeak(NUM_BINS, 51, -18, -70);
    const sessionMedianRms = 0.5 * 0.3 / Math.sqrt(2) / 4;
    const q = scoreFrameQuality(raw, bins, { sessionMedianRms });
    expect(q.flags).toContain('transient');
  });

  it('clippingFraction is 0 for a clean sine at amplitude 0.3', () => {
    const raw = sine(N, 50, SR, 0.3);
    const bins = binsWithPeak(NUM_BINS, 51, -18, -70);
    const q = scoreFrameQuality(raw, bins);
    expect(q.clippingFraction).toBe(0);
  });
});
