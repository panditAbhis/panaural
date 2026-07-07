// SPDX-License-Identifier: MIT
// Copyright (c) 2026 panditAbhis — Panaural Project

import type { SelfTestResult, STFTConfig } from '../types.js';
import { computeSTFT } from '../transform/stft.js';

const SAMPLE_RATE = 8000;
const DURATION_S = 1.0;
const N = Math.floor(SAMPLE_RATE * DURATION_S);

/** Generate a pure sine wave of `freq` Hz at `sampleRate`. */
function sine(freq: number, amplitude: number = 1.0): Float64Array {
  const out = new Float64Array(N);
  for (let i = 0; i < N; i++) {
    out[i] = amplitude * Math.sin((2 * Math.PI * freq * i) / SAMPLE_RATE);
  }
  return out;
}

/**
 * Simple Box-Muller Gaussian noise generator (deterministic seed via LCG).
 */
function gaussianNoise(stdDev: number, seed: number = 42): Float64Array {
  const out = new Float64Array(N);
  let s = seed;
  // LCG
  function rand(): number {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    return (s >>> 0) / 0xffffffff;
  }
  for (let i = 0; i < N; i += 2) {
    const u1 = Math.max(rand(), 1e-10);
    const u2 = rand();
    const z0 = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    const z1 = Math.sqrt(-2 * Math.log(u1)) * Math.sin(2 * Math.PI * u2);
    out[i] = z0 * stdDev;
    if (i + 1 < N) out[i + 1] = z1 * stdDev;
  }
  return out;
}

/** Add two Float64Arrays element-wise. */
function addSignals(a: Float64Array, b: Float64Array): Float64Array {
  const out = new Float64Array(a.length);
  for (let i = 0; i < a.length; i++) {
    out[i] = (a[i] ?? 0) + (b[i] ?? 0);
  }
  return out;
}

/** Clip a signal to ±limit. */
function clip(signal: Float64Array, limit: number): Float64Array {
  const out = new Float64Array(signal.length);
  for (let i = 0; i < signal.length; i++) {
    out[i] = Math.max(-limit, Math.min(limit, signal[i] ?? 0));
  }
  return out;
}

/**
 * Find the frequency bin index with maximum magnitude in the STFTFrame.
 * Ignores DC (bin 0).
 */
function peakBin(frequencyBins: Float64Array): number {
  let peak = 1;
  let peakVal = -Infinity;
  for (let k = 1; k < frequencyBins.length; k++) {
    if ((frequencyBins[k] ?? -Infinity) > peakVal) {
      peakVal = frequencyBins[k]!;
      peak = k;
    }
  }
  return peak;
}

/**
 * Convert frequency in Hz to expected bin index for a given STFT config.
 * fftSize is next power of 2 >= frameSize.
 */
function freqToBin(freqHz: number, fftSize: number, sampleRate: number): number {
  return Math.round((freqHz * fftSize) / sampleRate);
}

function nextPow2(n: number): number {
  let p = 1;
  while (p < n) p <<= 1;
  return p;
}

const DEFAULT_CONFIG: STFTConfig = {
  frameSize: N,        // 8000 samples = 1 s at 8 kHz
  hopSize: N,          // non-overlapping
  windowType: 'hann',
  sampleRate: SAMPLE_RATE,
};

const FFT_SIZE = nextPow2(DEFAULT_CONFIG.frameSize);
const TARGET_FREQ = 50; // Hz
const EXPECTED_BIN = freqToBin(TARGET_FREQ, FFT_SIZE, SAMPLE_RATE);
const BIN_TOLERANCE = 3;

/**
 * Run all four self-tests.
 *
 * Tests:
 * 1. sine_detection    — pure 50 Hz sine → peak bin at 50 Hz ± BIN_TOLERANCE
 * 2. sine_plus_noise   — 50 Hz sine + Gaussian noise (SNR ~10 dB) → peak still at 50 Hz
 * 3. silence           — all-zero input → no bin above -80 dB
 * 4. clipping          — clipped signal → warns if >5% samples at ±0.9
 */
export function runSelfTests(): SelfTestResult[] {
  const results: SelfTestResult[] = [];

  // ── Test 1: Sine detection ──────────────────────────────────────────────
  {
    const signal = sine(TARGET_FREQ);
    const frames = computeSTFT(signal, DEFAULT_CONFIG);
    const frame = frames[0]!;
    const peak = peakBin(frame.frequencyBins);
    const passed = Math.abs(peak - EXPECTED_BIN) <= BIN_TOLERANCE;
    results.push({
      name: 'sine_detection',
      passed,
      expected: `peak bin within ${BIN_TOLERANCE} of ${EXPECTED_BIN} (${TARGET_FREQ} Hz)`,
      actual: `peak bin = ${peak} (${(peak * SAMPLE_RATE) / FFT_SIZE} Hz)`,
    });
  }

  // ── Test 2: Sine + Gaussian noise (SNR ~10 dB) ─────────────────────────
  {
    // Sine amplitude 1.0 → power 0.5. For SNR=10 dB: noise power = 0.5 / 10 ≈ 0.05
    // noise std = sqrt(0.05) ≈ 0.224
    const sineSignal = sine(TARGET_FREQ, 1.0);
    const noise = gaussianNoise(0.224);
    const noisy = addSignals(sineSignal, noise);
    const frames = computeSTFT(noisy, DEFAULT_CONFIG);
    const frame = frames[0]!;
    const peak = peakBin(frame.frequencyBins);
    const passed = Math.abs(peak - EXPECTED_BIN) <= BIN_TOLERANCE;
    results.push({
      name: 'sine_plus_noise',
      passed,
      expected: `peak bin within ${BIN_TOLERANCE} of ${EXPECTED_BIN} despite noise`,
      actual: `peak bin = ${peak} (${(peak * SAMPLE_RATE) / FFT_SIZE} Hz)`,
    });
  }

  // ── Test 3: Silence ─────────────────────────────────────────────────────
  {
    const silence = new Float64Array(N).fill(0);
    const frames = computeSTFT(silence, DEFAULT_CONFIG);
    const frame = frames[0]!;
    const maxDb = Math.max(...Array.from(frame.frequencyBins));
    const passed = maxDb < -80;
    results.push({
      name: 'silence',
      passed,
      expected: 'max bin < -80 dB',
      actual: `max bin = ${maxDb.toFixed(2)} dB`,
    });
  }

  // ── Test 4: Clipping ─────────────────────────────────────────────────────
  {
    // Clip a high-amplitude sine to ±0.9 (simulate ADC saturation)
    const bigSine = sine(TARGET_FREQ, 2.0);
    const clipped = clip(bigSine, 0.9);

    // Check if >5% of samples are at ±0.9
    let atLimit = 0;
    for (let i = 0; i < clipped.length; i++) {
      if (Math.abs(clipped[i]!) >= 0.9) atLimit++;
    }
    const clippingFraction = atLimit / clipped.length;
    const clippingDetected = clippingFraction > 0.05;

    results.push({
      name: 'clipping',
      passed: clippingDetected, // "passing" means we correctly detected the clipping
      expected: '>5% of samples at ±0.9 (clipping detected)',
      actual: `${(clippingFraction * 100).toFixed(1)}% samples at ±0.9${
        clippingDetected
          ? ' — WARNING: ADC saturation detected, spectrum is distorted'
          : ' — no clipping detected'
      }`,
    });
  }

  return results;
}
