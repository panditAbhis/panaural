// SPDX-License-Identifier: MIT
// Copyright (c) 2026 panditAbhis — Panaural Project

import type { Baseline, MahalanobisResult } from '../types.js';

/**
 * Score one STFT frame against a Baseline using the Mahalanobis distance.
 *
 * Full Mahalanobis uses the inverse covariance matrix C^-1 (4097x4097, impractical).
 * Diagonal approximation (bins treated as independent):
 *   D^2 = sum_k z[k]^2   where z[k] = (bins[k] - mu[k]) / sigma[k]
 *
 * Primary alert trigger is maxAbsZ, not D^2. Reason: bearing fault = one new tone
 * at one bin. That adds z^2 at one bin to a sum of 4097 terms — negligible.
 * But maxAbsZ catches the single large outlier directly.
 *
 * Alert levels:
 *   alert:   maxAbsZ > 4.0  (> 4 sigma at any single bin)
 *   warning: maxAbsZ > 3.0
 *   normal:  otherwise
 */
export function scoreFrame(bins: Float64Array, baseline: Baseline): MahalanobisResult {
  const numBins = bins.length;
  const zScores = new Float64Array(numBins);
  let distance = 0;
  let maxAbsZ = 0;
  let numBinsAlerting = 0;

  for (let k = 0; k < numBins; k++) {
    const z = (bins[k]! - baseline.mu[k]!) / baseline.sigma[k]!;
    zScores[k] = z;
    distance += z * z;
    const absZ = Math.abs(z);
    if (absZ > maxAbsZ) maxAbsZ = absZ;
    if (absZ > 2.0) numBinsAlerting++;
  }

  let alertLevel: 'normal' | 'warning' | 'alert';
  if (maxAbsZ >= 4.0) alertLevel = 'alert';
  else if (maxAbsZ >= 3.0) alertLevel = 'warning';
  else alertLevel = 'normal';

  return { distance, zScores, maxAbsZ, alertLevel, numBinsAlerting };
}
