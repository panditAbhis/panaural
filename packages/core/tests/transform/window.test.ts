// SPDX-License-Identifier: MIT
// Copyright (c) 2026 panditAbhis — Panaural Project

import { describe, it, expect } from 'vitest';
import { applyWindow } from '../../src/transform/window.js';

describe('window functions', () => {
  const N = 64;
  const ones = new Float64Array(N).fill(1.0);

  describe('hann', () => {
    it('first sample is 0', () => {
      const out = applyWindow(ones, 'hann');
      expect(out[0]).toBeCloseTo(0, 10);
    });

    it('last sample is 0', () => {
      const out = applyWindow(ones, 'hann');
      expect(out[N - 1]).toBeCloseTo(0, 10);
    });

    it('center sample is approximately 1', () => {
      // For even N, the max is near N/2. We check both N/2-1 and N/2.
      const out = applyWindow(ones, 'hann');
      const mid = N / 2;
      // The peak value for Hann on even-length array: check it's close to 1
      expect(Math.max(out[mid - 1]!, out[mid]!)).toBeGreaterThan(0.99);
    });

    it('all values are in [0, 1]', () => {
      const out = applyWindow(ones, 'hann');
      for (let i = 0; i < N; i++) {
        expect(out[i]).toBeGreaterThanOrEqual(0);
        expect(out[i]).toBeLessThanOrEqual(1 + 1e-10);
      }
    });
  });

  describe('hamming', () => {
    it('first sample is approximately 0.08 (non-zero)', () => {
      const out = applyWindow(ones, 'hamming');
      // Hamming w[0] = 0.54 - 0.46 * cos(0) = 0.54 - 0.46 = 0.08
      expect(out[0]).toBeCloseTo(0.08, 5);
    });

    it('center sample is close to 1', () => {
      const out = applyWindow(ones, 'hamming');
      const mid = N / 2;
      expect(Math.max(out[mid - 1]!, out[mid]!)).toBeGreaterThan(0.99);
    });
  });

  describe('blackman', () => {
    it('first sample is approximately 0 (within floating point)', () => {
      const out = applyWindow(ones, 'blackman');
      // Blackman w[0] = 0.42 - 0.5 + 0.08 = 0
      expect(out[0]).toBeCloseTo(0, 5);
    });

    it('center sample is close to 1', () => {
      const out = applyWindow(ones, 'blackman');
      const mid = N / 2;
      expect(Math.max(out[mid - 1]!, out[mid]!)).toBeGreaterThan(0.99);
    });
  });

  describe('rect', () => {
    it('all samples are 1 when input is 1', () => {
      const out = applyWindow(ones, 'rect');
      for (let i = 0; i < N; i++) {
        expect(out[i]).toBe(1.0);
      }
    });
  });

  describe('scaling', () => {
    it('scales input samples correctly', () => {
      const samples = new Float64Array(N).fill(2.0);
      const out = applyWindow(samples, 'rect');
      expect(out[0]).toBe(2.0);
    });
  });
});
