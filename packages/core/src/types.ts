// SPDX-License-Identifier: MIT
// Copyright (c) 2026 panditAbhis — Panaural Project

export interface ProfileAudioConfig {
  sampleRate: number;                          // Hz
  frequencyResolution: number;                 // Hz, needed to resolve sidebands
  timeResolution: number;                      // s, for STFT hop
  frequencyBandOfInterest: [number, number];   // [low, high] Hz
}

export interface STFTConfig {
  frameSize: number;    // derived: sampleRate / frequencyResolution
  hopSize: number;      // derived: sampleRate * timeResolution
  windowType: 'hann' | 'hamming' | 'blackman' | 'rect';
  sampleRate: number;
}

export interface STFTFrame {
  frequencyBins: Float64Array;  // magnitude spectrum in dB
  frequencyResolution: number;  // Hz per bin
  timestampNs: bigint;          // monotonic clock
  inputHash: string;            // SHA-256 of raw samples
}

export interface AuditLogEntry {
  timestamp: string;          // ISO 8601
  monotonicClockNs: string;   // bigint as string
  inputHash: string;
  frameIndex: number;
  event: string;
}

export interface SelfTestResult {
  name: string;
  passed: boolean;
  expected: string;
  actual: string;
}

export type WindowType = 'hann' | 'hamming' | 'blackman' | 'rect';

export interface AuditLogger {
  log(entry: AuditLogEntry): void;
  close(): void;
}
