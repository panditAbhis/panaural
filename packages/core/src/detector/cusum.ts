// SPDX-License-Identifier: MIT
// Copyright (c) 2026 panditAbhis — Panaural Project

import type { Baseline, CUSUMState } from '../types.js';

export interface CUSUMOpts {
  delta?: number;
  threshold?: number;
}

/**
 * Initialise a fresh CUSUM state for numBins frequency bins.
 *
 * CUSUM (Cumulative Sum, Page 1954) detects slow monotonic drift that Mahalanobis
 * misses. A single frame 2 dB above baseline is normal variation. Twenty consecutive
 * frames each 2 dB above baseline is a clear trend — a pump gradually getting noisier.
 * CUSUM accumulates those small increments until the total crosses the threshold.
 *
 * Analogy: the penny jar. Healthy variation = add some, remove some, jar stays level.
 * Developing fault = add slightly more than you remove each day. Jar slowly fills.
 * The threshold is the overflow line. max(0,...) is the jar bottom — it drains to zero
 * if drift stops, but never goes negative.
 *
 * @param numBins  Number of frequency bins (must match Baseline.mu.length)
 * @param opts     delta: slack parameter; threshold: alert trigger level
 */
export function initCUSUM(numBins: number, opts: CUSUMOpts = {}): CUSUMState {
  return {
    S: new Float64Array(numBins),
    alertBins: new Uint8Array(numBins),
    delta: opts.delta ?? 0.5,
    threshold: opts.threshold ?? 5.0,
    frameCount: 0,
  };
}

/**
 * Advance the CUSUM detector by one frame. Pure function — input state is not mutated.
 *
 * Per-bin upper CUSUM update:
 *   z[k]  = (bins[k] - mu[k]) / sigma[k]
 *   S[k]  = max(0, S[k-1] + z[k] - delta)
 *   alert = S[k] > threshold
 *
 * The max(0,...) reset: when z[k] < delta the bin is behaving normally.
 * Subtracting delta allows the accumulator to drain back to zero if drift stops.
 */
export function updateCUSUM(
  state: CUSUMState,
  bins: Float64Array,
  baseline: Baseline,
): CUSUMState {
  const numBins = bins.length;
  const newS = new Float64Array(numBins);
  const newAlerts = new Uint8Array(numBins);

  for (let k = 0; k < numBins; k++) {
    const z = (bins[k]! - baseline.mu[k]!) / baseline.sigma[k]!;
    newS[k] = Math.max(0, state.S[k]! + z - state.delta);
    newAlerts[k] = newS[k]! > state.threshold ? 1 : 0;
  }

  return {
    S: newS,
    alertBins: newAlerts,
    delta: state.delta,
    threshold: state.threshold,
    frameCount: state.frameCount + 1,
  };
}
