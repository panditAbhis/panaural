// SPDX-License-Identifier: MIT
// Copyright (c) 2026 panditAbhis — Panaural Project

import { describe, it, expect } from 'vitest';
import { initCUSUM, updateCUSUM } from '../../src/detector/cusum.js';
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

describe('initCUSUM', () => {
  it('initialises S to all zeros', () => {
    const state = initCUSUM(NUM_BINS);
    expect(state.S.every(v => v === 0)).toBe(true);
    expect(state.alertBins.every(v => v === 0)).toBe(true);
    expect(state.frameCount).toBe(0);
  });

  it('uses default delta=0.5 and threshold=5.0', () => {
    const state = initCUSUM(NUM_BINS);
    expect(state.delta).toBe(0.5);
    expect(state.threshold).toBe(5.0);
  });

  it('accepts custom delta and threshold', () => {
    const state = initCUSUM(NUM_BINS, { delta: 1.0, threshold: 10.0 });
    expect(state.delta).toBe(1.0);
    expect(state.threshold).toBe(10.0);
  });
});

describe('updateCUSUM', () => {
  it('does not modify input state (pure function)', () => {
    const baseline = makeBaseline(-40, 1.0);
    const state = initCUSUM(NUM_BINS);
    const originalS51 = state.S[51];
    const bins = new Float64Array(NUM_BINS).fill(-34);
    updateCUSUM(state, bins, baseline);
    expect(state.S[51]).toBe(originalS51);
  });

  it('increments S[51] when bin 51 is consistently above baseline', () => {
    const baseline = makeBaseline(-40, 1.0);
    let state = initCUSUM(NUM_BINS);
    const bins = new Float64Array(NUM_BINS).fill(-40);
    bins[51] = -39; // z=1.0, increment = 1.0 - 0.5 = 0.5 per frame

    for (let i = 0; i < 5; i++) state = updateCUSUM(state, bins, baseline);
    expect(state.S[51]).toBeCloseTo(2.5, 1);
    expect(state.alertBins[51]).toBe(0);
  });

  it('triggers alert at bin 51 after sustained +2 dB/frame drift', () => {
    // z=2.0, increment = 2.0 - 0.5 = 1.5/frame, threshold=5.0 -> alert after 4 frames
    const baseline = makeBaseline(-40, 1.0);
    let state = initCUSUM(NUM_BINS);
    const bins = new Float64Array(NUM_BINS).fill(-40);
    bins[51] = -38;

    for (let i = 0; i < 5; i++) state = updateCUSUM(state, bins, baseline);
    expect(state.alertBins[51]).toBe(1);
  });

  it('does NOT trigger alert when signal is within normal variation', () => {
    // z oscillates +-0.3 -> increment = max(0, 0.3 - 0.5) = 0 (always clamped)
    const baseline = makeBaseline(-40, 1.0);
    let state = initCUSUM(NUM_BINS);

    for (let i = 0; i < 20; i++) {
      const bins = new Float64Array(NUM_BINS).fill(-40);
      bins[51] = i % 2 === 0 ? -39.7 : -40.3;
      state = updateCUSUM(state, bins, baseline);
    }
    expect(state.alertBins[51]).toBe(0);
    expect(state.S[51]).toBeCloseTo(0, 1);
  });

  it('increments frameCount by 1 each call', () => {
    const baseline = makeBaseline(-40, 1.0);
    let state = initCUSUM(NUM_BINS);
    const bins = new Float64Array(NUM_BINS).fill(-40);
    state = updateCUSUM(state, bins, baseline);
    state = updateCUSUM(state, bins, baseline);
    expect(state.frameCount).toBe(2);
  });
});
