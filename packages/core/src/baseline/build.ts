// SPDX-License-Identifier: MIT
// Copyright (c) 2026 panditAbhis — Panaural Project

import type { Baseline, FrameRecord } from '../types.js';
import { scoreFrameQuality } from './quality.js';

export interface BuildBaselineOpts {
  minFrames?: number;
  frequencyResolution?: number;
  noiseFloorDb?: number;
}

/**
 * Build a statistical baseline from an array of FrameRecords.
 *
 * 1. Quality-filter each frame (discard clipped, silent, low-SNR frames).
 * 2. Reject if fewer than minFrames survive.
 * 3. Per bin k: compute mean (mu) and std deviation (sigma) across usable frames.
 * 4. Apply sigma floor of 0.5 dB — prevents division-by-zero in detectors and
 *    limits false alarms on bins that were unrealistically stable in this sample.
 *
 * @throws Error if fewer than minFrames frames pass quality filtering
 */
export function buildBaseline(
  records: FrameRecord[],
  opts: BuildBaselineOpts = {},
): Baseline {
  const minFrames = opts.minFrames ?? 10;
  const frequencyResolution = opts.frequencyResolution ?? 0;

  const usable = records.filter(r =>
    scoreFrameQuality(r.rawSamples, r.bins, { noiseFloorDb: opts.noiseFloorDb }).usable,
  );

  if (usable.length < minFrames) {
    throw new Error(
      `buildBaseline: fewer than ${minFrames} usable frames (got ${usable.length} of ${records.length} after quality filter)`,
    );
  }

  const numBins = usable[0]!.bins.length;
  const n = usable.length;

  // Mean in dB-space. Acceptable here because healthy frames are similar;
  // Jensen's inequality bias is < 0.1 dB for the variations we expect.
  const mu = new Float64Array(numBins);
  for (const rec of usable) {
    for (let k = 0; k < numBins; k++) mu[k] += rec.bins[k]!;
  }
  for (let k = 0; k < numBins; k++) mu[k] /= n;

  const sigma = new Float64Array(numBins);
  for (const rec of usable) {
    for (let k = 0; k < numBins; k++) sigma[k] += (rec.bins[k]! - mu[k]!) ** 2;
  }
  for (let k = 0; k < numBins; k++) {
    sigma[k] = Math.sqrt(sigma[k]! / n);
    sigma[k] = Math.max(sigma[k]!, 0.5);
  }

  return {
    mu,
    sigma,
    numFrames: n,
    frequencyResolution,
    builtAt: new Date().toISOString(),
  };
}
