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

// ── Weekend 2 types ──────────────────────────────────────────────────────────

export interface FrameRecord {
  rawSamples: Float64Array;
  bins: Float64Array;
}

export interface Baseline {
  mu: Float64Array;
  sigma: Float64Array;
  numFrames: number;
  frequencyResolution: number;
  builtAt: string;
}

export interface FrameQuality {
  score: number;
  snrEstimate: number;
  clippingFraction: number;
  flags: string[];
  usable: boolean;
}

export interface MahalanobisResult {
  distance: number;
  zScores: Float64Array;
  maxAbsZ: number;
  alertLevel: 'normal' | 'warning' | 'alert';
  numBinsAlerting: number;
}

export interface CUSUMState {
  S: Float64Array;
  alertBins: Uint8Array;
  delta: number;
  threshold: number;
  frameCount: number;
}

export interface CalibrationResult {
  measuredDb: number;
  offsetDb: number;
  snrAtRefHz: number;
  valid: boolean;
}

// ── Weekend 3 types ──────────────────────────────────────────────────────────

export interface SerializedBaseline {
  mu: number[];
  sigma: number[];
  numFrames: number;
  frequencyResolution: number;
  builtAt: string;
}

export interface SavedBaseline {
  id: string;
  name: string;
  machineId: string;
  notes: string;
  sourceFile: string;
  baseline: SerializedBaseline;
  savedAt: string;
}

export interface DetectionSession {
  id: string;
  baselineId: string;
  sourceFile: string;
  alertLevel: 'normal' | 'warning' | 'alert';
  maxAbsZ: number;
  numBinsAlerting: number;
  cusumAlertBins: number;
  topBins: Array<{ freq: number; z: number }>;
  detectedAt: string;
}
