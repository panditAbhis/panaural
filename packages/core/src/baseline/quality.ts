// SPDX-License-Identifier: MIT
// Copyright (c) 2026 panditAbhis — Panaural Project

import type { FrameQuality } from '../types.js';

export interface QualityOpts {
  sessionMedianRms?: number;
  noiseFloorDb?: number;
}

/**
 * Score the quality of one STFT frame before including it in a baseline.
 *
 * Bad frames (clipped, silent, transient) inflate sigma values and make
 * the drift detector insensitive. Garbage in -> garbage baseline -> missed faults.
 *
 * @param rawSamples  Time-domain PCM samples (before windowing)
 * @param bins        Frequency-domain dBFS magnitudes
 * @param opts        Optional thresholds
 */
export function scoreFrameQuality(
  rawSamples: Float64Array,
  bins: Float64Array,
  opts: QualityOpts = {},
): FrameQuality {
  const noiseFloorDb = opts.noiseFloorDb ?? -80;
  const flags: string[] = [];
  let score = 1.0;

  // Clipping: ADC saturation causes square-wave harmonics in frequency domain
  // that look like machine faults but aren't. Reject frames > 1% clipped.
  let clipped = 0;
  for (let i = 0; i < rawSamples.length; i++) {
    if (Math.abs(rawSamples[i]!) >= 0.9) clipped++;
  }
  const clippingFraction = clipped / rawSamples.length;
  if (clippingFraction > 0.01) {
    flags.push('clipping');
    score -= 0.5;
  }

  // Silence: mic disconnected, machine off, or gain zero.
  // Including silent frames pulls mu down and inflates sigma everywhere.
  const maxBin = Math.max(...Array.from(bins));
  if (maxBin < noiseFloorDb + 20) {
    flags.push('silence');
    score = 0;
    return { score, snrEstimate: 0, clippingFraction, flags, usable: false };
  }

  // SNR: 20th-percentile bin approximates noise floor (< 20% of bins hold real signal).
  // Less than 15 dB above noise means the spectrum is unreliable.
  const sorted = Float64Array.from(bins).sort();
  const p20 = sorted[Math.floor(sorted.length * 0.2)]!;
  const snrEstimate = maxBin - p20;
  if (snrEstimate < 15) {
    flags.push('low_snr');
    score -= 0.3;
  }

  // Transient: door slam, pressure surge. RMS > 2x session median = +6 dB.
  // Caller must supply sessionMedianRms; omit to skip this check.
  if (opts.sessionMedianRms !== undefined && opts.sessionMedianRms > 0) {
    let sumSq = 0;
    for (let i = 0; i < rawSamples.length; i++) sumSq += rawSamples[i]! ** 2;
    const rms = Math.sqrt(sumSq / rawSamples.length);
    if (rms > opts.sessionMedianRms * 2) {
      flags.push('transient');
      score -= 0.2;
    }
  }

  score = Math.max(0, Math.min(1, score));
  return {
    score,
    snrEstimate,
    clippingFraction,
    flags,
    usable: score >= 0.6,
  };
}
