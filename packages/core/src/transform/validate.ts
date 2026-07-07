// SPDX-License-Identifier: MIT
// Copyright (c) 2026 panditAbhis — Panaural Project

import type { ProfileAudioConfig } from '../types.js';

/**
 * Validate a ProfileAudioConfig for acoustic correctness.
 *
 * Throws a descriptive error if:
 * 1. Nyquist criterion violated: sampleRate < 2 * frequencyBandOfInterest[1]
 * 2. Derived frameSize (sampleRate / frequencyResolution) is less than 64
 *    (minimum sensible FFT frame for acoustic analysis)
 * 3. Derived hopSize (sampleRate * timeResolution) >= frameSize
 *    (hop must be smaller than frame for meaningful overlap)
 */
export function validateProfileConfig(profile: ProfileAudioConfig): void {
  const { sampleRate, frequencyResolution, timeResolution, frequencyBandOfInterest } = profile;
  const [bandLow, bandHigh] = frequencyBandOfInterest;

  // 1. Nyquist check
  if (sampleRate < 2 * bandHigh) {
    throw new Error(
      `Nyquist violation: sampleRate ${sampleRate} Hz is less than 2 × upper band limit ` +
        `${bandHigh} Hz (${2 * bandHigh} Hz required). ` +
        `Increase sample rate or lower frequencyBandOfInterest[1].`,
    );
  }

  // 2. Frame size check
  const frameSize = Math.round(sampleRate / frequencyResolution);
  if (frameSize < 64) {
    throw new Error(
      `Frame size too small: sampleRate / frequencyResolution = ${sampleRate} / ${frequencyResolution} = ${frameSize}. ` +
        `Minimum frame size is 64 samples. ` +
        `Decrease frequencyResolution or increase sampleRate.`,
    );
  }

  // 3. Hop size vs frame size check
  const hopSize = sampleRate * timeResolution;
  if (hopSize >= frameSize) {
    throw new Error(
      `Hop size (${hopSize}) must be less than frame size (${frameSize}). ` +
        `Current timeResolution=${timeResolution}s yields hopSize=${hopSize} samples. ` +
        `Decrease timeResolution or increase frequencyResolution.`,
    );
  }
}

/**
 * Derive STFTConfig parameters from a validated ProfileAudioConfig.
 * Call validateProfileConfig() before this function.
 */
export function deriveSTFTConfig(
  profile: ProfileAudioConfig,
  windowType: 'hann' | 'hamming' | 'blackman' | 'rect' = 'hann',
) {
  return {
    frameSize: Math.round(profile.sampleRate / profile.frequencyResolution),
    hopSize: Math.round(profile.sampleRate * profile.timeResolution),
    windowType,
    sampleRate: profile.sampleRate,
  };
}
