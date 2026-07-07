// SPDX-License-Identifier: MIT
// Copyright (c) 2026 panditAbhis — Panaural Project

import { describe, it, expect } from 'vitest';
import { runSelfTests } from '../../src/validation/selftest.js';

describe('runSelfTests', () => {
  const results = runSelfTests();

  it('returns exactly 4 test results', () => {
    expect(results).toHaveLength(4);
  });

  it('all tests have required fields', () => {
    for (const r of results) {
      expect(typeof r.name).toBe('string');
      expect(typeof r.passed).toBe('boolean');
      expect(typeof r.expected).toBe('string');
      expect(typeof r.actual).toBe('string');
    }
  });

  it('sine_detection passes', () => {
    const t = results.find((r) => r.name === 'sine_detection');
    expect(t).toBeDefined();
    expect(t!.passed).toBe(true);
  });

  it('sine_plus_noise passes', () => {
    const t = results.find((r) => r.name === 'sine_plus_noise');
    expect(t).toBeDefined();
    expect(t!.passed).toBe(true);
  });

  it('silence passes', () => {
    const t = results.find((r) => r.name === 'silence');
    expect(t).toBeDefined();
    expect(t!.passed).toBe(true);
  });

  it('clipping detects saturation', () => {
    const t = results.find((r) => r.name === 'clipping');
    expect(t).toBeDefined();
    expect(t!.passed).toBe(true);
    expect(t!.actual).toContain('WARNING');
  });
});
