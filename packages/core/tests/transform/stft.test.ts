// SPDX-License-Identifier: MIT
// Copyright (c) 2026 panditAbhis — Panaural Project

import { describe, it, expect } from 'vitest';
import { computeSTFT } from '../../src/transform/stft.js';
import type { STFTConfig } from '../../src/types.js';

/**
 * Generate a pure sine wave.
 * @param freq      Frequency in Hz
 * @param sampleRate  Samples per second
 * @param durationS   Duration in seconds
 */
function generateSine(freq: number, sampleRate: number, durationS: number): Float64Array {
  const N = Math.floor(sampleRate * durationS);
  const out = new Float64Array(N);
  for (let i = 0; i < N; i++) {
    out[i] = Math.sin((2 * Math.PI * freq * i) / sampleRate);
  }
  return out;
}

describe('computeSTFT', () => {
  const sampleRate = 8000;
  const frameSize = 8000; // 1 second frame → freq resolution = 1 Hz, so bin k ≈ freq
  const config: STFTConfig = {
    frameSize,
    hopSize: frameSize, // non-overlapping for simplicity
    windowType: 'rect',
    sampleRate,
  };

  it('50 Hz sine at 8kHz → peak bin near index 50', () => {
    // With frameSize=8000 and sampleRate=8000, next pow2 = 8192
    // bin k corresponds to freq = k * (sampleRate / fftSize) = k * (8000/8192) ≈ k * 0.977 Hz
    // 50 Hz → k ≈ 50 / 0.977 ≈ 51.2 → bin 51
    const signal = generateSine(50, sampleRate, 1.0);
    const frames = computeSTFT(signal, config);
    expect(frames.length).toBeGreaterThanOrEqual(1);

    const frame = frames[0]!;
    // Find the peak bin
    let peakBin = 0;
    let peakDb = -Infinity;
    for (let k = 1; k < frame.frequencyBins.length; k++) {
      if (frame.frequencyBins[k]! > peakDb) {
        peakDb = frame.frequencyBins[k]!;
        peakBin = k;
      }
    }

    // Expected bin for 50 Hz with fftSize=8192, sampleRate=8000:
    // k = round(50 * 8192 / 8000) = round(51.2) = 51
    // Allow ±3 bins tolerance
    expect(Math.abs(peakBin - 51)).toBeLessThanOrEqual(3);
  });

  it('returns STFTFrames with correct shape', () => {
    const signal = generateSine(100, sampleRate, 1.0);
    const frames = computeSTFT(signal, config);
    expect(frames.length).toBeGreaterThanOrEqual(1);

    const frame = frames[0]!;
    expect(frame.frequencyBins).toBeInstanceOf(Float64Array);
    expect(frame.frequencyBins.length).toBeGreaterThan(0);
    expect(typeof frame.timestampNs).toBe('bigint');
    expect(typeof frame.inputHash).toBe('string');
    expect(frame.inputHash).toHaveLength(64);
    expect(frame.frequencyResolution).toBeGreaterThan(0);
  });

  it('silence produces all bins below -60 dB', () => {
    const silence = new Float64Array(frameSize).fill(0);
    const frames = computeSTFT(silence, config);
    expect(frames.length).toBeGreaterThanOrEqual(1);
    for (const bin of frames[0]!.frequencyBins) {
      expect(bin).toBeLessThan(-60);
    }
  });

  it('each frame has a unique input hash when frames differ', () => {
    const signal = new Float64Array(frameSize * 2);
    for (let i = 0; i < frameSize; i++) {
      signal[i] = Math.sin((2 * Math.PI * 100 * i) / sampleRate);
      signal[frameSize + i] = Math.sin((2 * Math.PI * 200 * i) / sampleRate);
    }
    const frames = computeSTFT(signal, config);
    expect(frames.length).toBe(2);
    expect(frames[0]!.inputHash).not.toBe(frames[1]!.inputHash);
  });
});
