// SPDX-License-Identifier: MIT
// Copyright (c) 2026 panditAbhis — Panaural Project

import { describe, it, expect } from 'vitest';
import { scoreFrame } from '../../src/detector/mahalanobis.js';
import type { Baseline } from '../../src/types.js';

const NUM_BINS = 4097;

function makeBaseline(muVal: number, sigmaVal: number): Baseline {
  return {
    mu: new Float64Array(NUM_BINS).fill(muVal),
    sigma: new Float64Array(NUM_BINS).fill(sigmaVal),
    numFrames: 30,
    frequencyResolution: 0.977,
    builtAt: new Date().toISOString(),
  };
}

describe('scoreFrame (Mahalanobis)', () => {
  it('returns normal for a frame that exactly matches the baseline', () => {
    const baseline = makeBaseline(-40, 1.0);
    const bins = new Float64Array(NUM_BINS).fill(-40);
    const result = scoreFrame(bins, baseline);
    expect(result.alertLevel).toBe('normal');
    expect(result.distance).toBeCloseTo(0, 0);
    expect(result.maxAbsZ).toBeCloseTo(0, 3);
    expect(result.numBinsAlerting).toBe(0);
  });

  it('returns alert when +6 dB injected at one bin (sigma=1 dB -> z=6 > 4)', () => {
    const baseline = makeBaseline(-40, 1.0);
    const bins = new Float64Array(NUM_BINS).fill(-40);
    bins[51] = -34;
    const result = scoreFrame(bins, baseline);
    expect(result.alertLevel).toBe('alert');
    expect(result.zScores[51]).toBeCloseTo(6.0, 1);
    expect(result.maxAbsZ).toBeCloseTo(6.0, 1);
    expect(result.numBinsAlerting).toBeGreaterThanOrEqual(1);
  });

  it('returns warning when +3 dB injected at one bin (z=3, between 3 and 4)', () => {
    const baseline = makeBaseline(-40, 1.0);
    const bins = new Float64Array(NUM_BINS).fill(-40);
    bins[51] = -37;
    const result = scoreFrame(bins, baseline);
    expect(result.alertLevel).toBe('warning');
    expect(result.zScores[51]).toBeCloseTo(3.0, 1);
  });

  it('z-scores are zero when frame matches baseline exactly', () => {
    const baseline = makeBaseline(-50, 2.0);
    const bins = new Float64Array(NUM_BINS).fill(-50);
    const result = scoreFrame(bins, baseline);
    for (const z of result.zScores) expect(z).toBeCloseTo(0, 6);
  });

  it('numBinsAlerting counts bins where |z| > 2', () => {
    const baseline = makeBaseline(-40, 1.0);
    const bins = new Float64Array(NUM_BINS).fill(-40);
    bins[10] = -37; bins[20] = -37; bins[30] = -37;
    const result = scoreFrame(bins, baseline);
    expect(result.numBinsAlerting).toBe(3);
  });

  it('distance equals sum of squared z-scores', () => {
    const baseline = makeBaseline(-40, 2.0);
    const bins = new Float64Array(NUM_BINS).fill(-40);
    bins[51] = -36;
    const result = scoreFrame(bins, baseline);
    const expectedD2 = Array.from(result.zScores).reduce((s, z) => s + z * z, 0);
    expect(result.distance).toBeCloseTo(expectedD2, 1);
  });
});
