// SPDX-License-Identifier: MIT
// Copyright (c) 2026 panditAbhis — Panaural Project

import type { CalibrationResult } from '../types.js';

/**
 * Detect a reference tone in a spectrum and compute the session calibration offset.
 *
 * Panaural records in dBFS (relative to ADC full scale). If microphone gain changes
 * between sessions, every bin shifts by the same offset — not because the pump changed,
 * but because the recording setup did. A reference tone played before each session at
 * a known distance anchors the measurement: offsetDb corrects for gain drift.
 *
 * Algorithm:
 *   1. Locate refBin = round(refHz / freqRes)
 *   2. Average 3 bins around refBin in dB to reduce single-bin quantisation noise
 *   3. Estimate noise floor as median of all bins excluding +-10 bin guard zone
 *   4. SNR = measuredDb - noiseFloor. Valid if SNR > 20 dB.
 *   5. offsetDb = expectedDb - measuredDb. Apply to all subsequent frames this session.
 *
 * @param bins        Frequency bins from one STFT frame (dBFS)
 * @param refHz       Frequency of the reference tone in Hz
 * @param freqRes     Hz per bin (STFTFrame.frequencyResolution)
 * @param expectedDb  Expected dBFS of the reference tone. Default: -20 dBFS.
 */
export function detectReferenceTone(
  bins: Float64Array,
  refHz: number,
  freqRes: number,
  expectedDb: number = -20,
): CalibrationResult {
  const refBin = Math.round(refHz / freqRes);

  const b0 = bins[Math.max(0, refBin - 1)]!;
  const b1 = bins[refBin]!;
  const b2 = bins[Math.min(bins.length - 1, refBin + 1)]!;
  const measuredDb = (b0 + b1 + b2) / 3;

  // Noise floor: median of bins outside the +-10 guard zone around refHz.
  // Guard zone prevents the strong tone from inflating the floor estimate.
  const guardLo = Math.max(0, refBin - 10);
  const guardHi = Math.min(bins.length - 1, refBin + 10);
  const noiseBins: number[] = [];
  for (let k = 0; k < bins.length; k++) {
    if (k < guardLo || k > guardHi) noiseBins.push(bins[k]!);
  }
  noiseBins.sort((a, b) => a - b);
  const noiseFloor = noiseBins[Math.floor(noiseBins.length / 2)]!;

  const snrAtRefHz = measuredDb - noiseFloor;
  const valid = snrAtRefHz > 20;
  const offsetDb = expectedDb - measuredDb;

  return { measuredDb, offsetDb, snrAtRefHz, valid };
}
