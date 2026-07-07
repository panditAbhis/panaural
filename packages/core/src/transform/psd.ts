// SPDX-License-Identifier: MIT
// Copyright (c) 2026 panditAbhis — Panaural Project

import type { STFTFrame, STFTConfig } from '../types.js';

/**
 * Compute the Power Spectral Density by averaging power across STFT frames.
 *
 * Units: dB re 1 (relative). Each bin value is the mean power in dB across
 * all input frames at that frequency bin.
 *
 * The averaging is performed in linear power domain (convert dB→linear,
 * average, convert back to dB) to avoid Jensen's inequality distortion.
 *
 * @param frames  Array of STFTFrames from computeSTFT()
 * @param config  The same STFTConfig used to generate the frames
 * @returns       Float64Array of length numBins (same as frames[0].frequencyBins.length)
 */
export function computePSD(frames: STFTFrame[], _config: STFTConfig): Float64Array {
  if (frames.length === 0) {
    return new Float64Array(0);
  }

  const numBins = frames[0]!.frequencyBins.length;
  const linearSum = new Float64Array(numBins);

  // Sum power in linear domain
  for (const frame of frames) {
    for (let k = 0; k < numBins; k++) {
      // Convert dB back to linear power: p = 10^(dB/20) gives amplitude; power = amplitude^2
      const amplitudeDb = frame.frequencyBins[k]!;
      const linearAmplitude = Math.pow(10, amplitudeDb / 20);
      linearSum[k] += linearAmplitude * linearAmplitude;
    }
  }

  // Average and convert back to dB
  const psd = new Float64Array(numBins);
  const n = frames.length;
  for (let k = 0; k < numBins; k++) {
    const avgPower = linearSum[k]! / n;
    psd[k] = avgPower > 1e-24 ? 10 * Math.log10(avgPower) : -240;
  }

  return psd;
}
