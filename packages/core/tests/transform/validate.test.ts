// SPDX-License-Identifier: MIT
// Copyright (c) 2026 panditAbhis — Panaural Project

import { describe, it, expect } from 'vitest';
import { validateProfileConfig, deriveSTFTConfig } from '../../src/transform/validate.js';
import type { ProfileAudioConfig } from '../../src/types.js';

const validConfig: ProfileAudioConfig = {
  sampleRate: 8000,
  frequencyResolution: 1,       // frameSize = 8000 / 1 = 8000 ≥ 64 ✓
  timeResolution: 0.5,          // hopSize = 8000 * 0.5 = 4000 < 8000 ✓
  frequencyBandOfInterest: [20, 3000], // Nyquist = 8000 ≥ 6000 ✓
};

describe('validateProfileConfig', () => {
  it('passes for a valid config', () => {
    expect(() => validateProfileConfig(validConfig)).not.toThrow();
  });

  it('throws on Nyquist violation', () => {
    const bad: ProfileAudioConfig = {
      ...validConfig,
      sampleRate: 4000,
      frequencyBandOfInterest: [20, 3000], // requires ≥ 6000 Hz sample rate
    };
    expect(() => validateProfileConfig(bad)).toThrow(/Nyquist/i);
  });

  it('throws when frame size is below 64', () => {
    const bad: ProfileAudioConfig = {
      ...validConfig,
      sampleRate: 8000,
      frequencyResolution: 200, // frameSize = 8000/200 = 40 < 64
    };
    expect(() => validateProfileConfig(bad)).toThrow(/Frame size too small/i);
  });

  it('throws when hop size >= frame size', () => {
    const bad: ProfileAudioConfig = {
      ...validConfig,
      sampleRate: 8000,
      frequencyResolution: 1,  // frameSize = 8000
      timeResolution: 1.5,     // hopSize = 8000 * 1.5 = 12000 >= 8000
    };
    expect(() => validateProfileConfig(bad)).toThrow(/Hop size/i);
  });

  it('throws when hop size equals frame size', () => {
    const bad: ProfileAudioConfig = {
      ...validConfig,
      sampleRate: 8000,
      frequencyResolution: 1,  // frameSize = 8000
      timeResolution: 1.0,     // hopSize = 8000 == 8000 (not strictly less)
    };
    expect(() => validateProfileConfig(bad)).toThrow(/Hop size/i);
  });
});

describe('deriveSTFTConfig', () => {
  it('derives correct frame and hop size', () => {
    const cfg = deriveSTFTConfig(validConfig);
    expect(cfg.frameSize).toBe(8000); // 8000 / 1
    expect(cfg.hopSize).toBe(4000);   // 8000 * 0.5
    expect(cfg.sampleRate).toBe(8000);
    expect(cfg.windowType).toBe('hann'); // default
  });

  it('respects explicit window type', () => {
    const cfg = deriveSTFTConfig(validConfig, 'blackman');
    expect(cfg.windowType).toBe('blackman');
  });
});
