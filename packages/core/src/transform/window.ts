// SPDX-License-Identifier: MIT
// Copyright (c) 2026 panditAbhis — Panaural Project

import type { WindowType } from '../types.js';

/**
 * Apply a window function to a sample array.
 *
 * Hann:     w[n] = 0.5 * (1 - cos(2π n / (N-1)))
 * Hamming:  w[n] = 0.54 - 0.46 * cos(2π n / (N-1))
 * Blackman: standard 3-term: 0.42 - 0.5*cos(2πn/(N-1)) + 0.08*cos(4πn/(N-1))
 * rect:     w[n] = 1 (no windowing)
 */
export function applyWindow(samples: Float64Array, type: WindowType): Float64Array {
  const N = samples.length;
  const result = new Float64Array(N);
  const TWO_PI = 2 * Math.PI;

  for (let n = 0; n < N; n++) {
    let w: number;
    switch (type) {
      case 'hann':
        w = 0.5 * (1 - Math.cos((TWO_PI * n) / (N - 1)));
        break;
      case 'hamming':
        w = 0.54 - 0.46 * Math.cos((TWO_PI * n) / (N - 1));
        break;
      case 'blackman':
        w =
          0.42 -
          0.5 * Math.cos((TWO_PI * n) / (N - 1)) +
          0.08 * Math.cos((4 * Math.PI * n) / (N - 1));
        break;
      case 'rect':
        w = 1.0;
        break;
      default: {
        const _exhaustive: never = type;
        throw new Error(`Unknown window type: ${_exhaustive}`);
      }
    }
    result[n] = (samples[n] ?? 0) * w;
  }

  return result;
}
