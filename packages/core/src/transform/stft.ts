// SPDX-License-Identifier: MIT
// Copyright (c) 2026 panditAbhis — Panaural Project

import type { STFTConfig, STFTFrame } from '../types.js';
import { applyWindow } from './window.js';
import { sha256Frame } from '../audit/hash.js';
import { monotonicNs } from '../audio/clock.js';

/**
 * Cooley-Tukey radix-2 DIT FFT (in-place, complex interleaved).
 * Input: Float64Array of length 2*N where even indices are real, odd are imaginary.
 * The array is modified in place.
 *
 * N must be a power of 2.
 */
function fftInPlace(re: Float64Array, im: Float64Array): void {
  const N = re.length;
  if (N === 0 || (N & (N - 1)) !== 0) {
    throw new Error(`FFT size must be a power of 2, got ${N}`);
  }

  // Bit-reversal permutation
  let j = 0;
  for (let i = 1; i < N; i++) {
    let bit = N >> 1;
    for (; j & bit; bit >>= 1) {
      j ^= bit;
    }
    j ^= bit;
    if (i < j) {
      [re[i], re[j]] = [re[j]!, re[i]!];
      [im[i], im[j]] = [im[j]!, im[i]!];
    }
  }

  // Cooley-Tukey butterfly
  for (let len = 2; len <= N; len <<= 1) {
    const ang = (-2 * Math.PI) / len;
    const wRe = Math.cos(ang);
    const wIm = Math.sin(ang);
    for (let i = 0; i < N; i += len) {
      let curRe = 1.0;
      let curIm = 0.0;
      for (let k = 0; k < len / 2; k++) {
        const uRe = re[i + k]!;
        const uIm = im[i + k]!;
        const vRe = re[i + k + len / 2]! * curRe - im[i + k + len / 2]! * curIm;
        const vIm = re[i + k + len / 2]! * curIm + im[i + k + len / 2]! * curRe;
        re[i + k] = uRe + vRe;
        im[i + k] = uIm + vIm;
        re[i + k + len / 2] = uRe - vRe;
        im[i + k + len / 2] = uIm - vIm;
        const nextRe = curRe * wRe - curIm * wIm;
        curIm = curRe * wIm + curIm * wRe;
        curRe = nextRe;
      }
    }
  }
}

/**
 * Find the nearest power of 2 >= n.
 */
function nextPow2(n: number): number {
  if (n <= 1) return 1;
  let p = 1;
  while (p < n) p <<= 1;
  return p;
}

/**
 * Compute STFT of a signal.
 *
 * Parameters are derived from STFTConfig (which should be built via deriveSTFTConfig).
 * Returns one STFTFrame per hop position where a full frame can be extracted.
 *
 * Each STFTFrame contains:
 * - frequencyBins: magnitude in dB (20 * log10(|X[k]| / frameSize)), half-spectrum (0..N/2)
 * - frequencyResolution: Hz per bin
 * - timestampNs: monotonic clock at frame extraction time
 * - inputHash: SHA-256 of the raw frame samples before windowing
 */
export function computeSTFT(samples: Float64Array, config: STFTConfig): STFTFrame[] {
  const { frameSize, hopSize, windowType, sampleRate } = config;

  // FFT size: next power of 2 >= frameSize for efficiency
  const fftSize = nextPow2(frameSize);
  const frames: STFTFrame[] = [];
  const freqResolution = sampleRate / fftSize;

  let offset = 0;
  while (offset + frameSize <= samples.length) {
    const rawFrame = samples.slice(offset, offset + frameSize);
    const inputHash = sha256Frame(rawFrame);
    const timestampNs = monotonicNs();

    // Apply window to the frame
    const windowed = applyWindow(rawFrame, windowType);

    // Zero-pad to fftSize if needed
    const re = new Float64Array(fftSize);
    const im = new Float64Array(fftSize);
    re.set(windowed);

    // Run FFT in-place
    fftInPlace(re, im);

    // Compute magnitude spectrum in dB for positive frequencies only (0..fftSize/2)
    const numBins = fftSize / 2 + 1;
    const frequencyBins = new Float64Array(numBins);
    for (let k = 0; k < numBins; k++) {
      const magnitude = Math.sqrt(re[k]! * re[k]! + im[k]! * im[k]!);
      // Normalize by window length (frameSize), not zero-padded FFT size.
      // Per FMP Erlangen standard: |X| / N where N = window length.
      // Dividing by fftSize introduces a constant -0.2 dB offset when fftSize > frameSize.
      const normalized = magnitude / frameSize;
      frequencyBins[k] = normalized > 1e-12 ? 20 * Math.log10(normalized) : -240;
    }

    frames.push({
      frequencyBins,
      frequencyResolution: freqResolution,
      timestampNs,
      inputHash,
    });

    offset += hopSize;
  }

  return frames;
}
