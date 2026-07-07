// SPDX-License-Identifier: MIT
// Copyright (c) 2026 panditAbhis — Panaural Project

import { describe, it, expect, afterEach } from 'vitest';
import { createAuditLogger } from '../../src/audit/logger.js';
import { sha256Frame } from '../../src/audit/hash.js';
import { readFileSync, unlinkSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const tmpLog = join(tmpdir(), `panaural-test-${Date.now()}.jsonl`);

afterEach(() => {
  if (existsSync(tmpLog)) {
    unlinkSync(tmpLog);
  }
});

describe('audit logger', () => {
  it('creates a file and writes valid JSONL', () => {
    const logger = createAuditLogger(tmpLog);
    const samples = new Float64Array([0.1, 0.2, 0.3]);
    const hash = sha256Frame(samples);

    logger.log({
      timestamp: new Date().toISOString(),
      monotonicClockNs: '123456789',
      inputHash: hash,
      frameIndex: 0,
      event: 'frame_processed',
    });
    logger.close();

    const content = readFileSync(tmpLog, 'utf8');
    const lines = content.trim().split('\n');
    expect(lines).toHaveLength(1);

    const parsed = JSON.parse(lines[0]!);
    expect(parsed).toHaveProperty('inputHash');
    expect(parsed.inputHash).toBe(hash);
    expect(parsed.frameIndex).toBe(0);
    expect(parsed.event).toBe('frame_processed');
  });

  it('appends multiple entries, each on its own line', () => {
    const logger = createAuditLogger(tmpLog);

    for (let i = 0; i < 5; i++) {
      logger.log({
        timestamp: new Date().toISOString(),
        monotonicClockNs: String(BigInt(i) * 1000n),
        inputHash: sha256Frame(new Float64Array([i])),
        frameIndex: i,
        event: 'frame_processed',
      });
    }
    logger.close();

    const lines = readFileSync(tmpLog, 'utf8').trim().split('\n');
    expect(lines).toHaveLength(5);

    lines.forEach((line, idx) => {
      const entry = JSON.parse(line);
      expect(entry.frameIndex).toBe(idx);
      expect(typeof entry.inputHash).toBe('string');
      expect(entry.inputHash).toHaveLength(64); // SHA-256 hex = 64 chars
    });
  });

  it('each line is valid JSON with required fields', () => {
    const logger = createAuditLogger(tmpLog);
    logger.log({
      timestamp: '2026-07-07T00:00:00.000Z',
      monotonicClockNs: '9999999',
      inputHash: 'a'.repeat(64),
      frameIndex: 42,
      event: 'test_event',
    });
    logger.close();

    const lines = readFileSync(tmpLog, 'utf8').trim().split('\n');
    const entry = JSON.parse(lines[0]!);
    expect(entry).toMatchObject({
      timestamp: '2026-07-07T00:00:00.000Z',
      monotonicClockNs: '9999999',
      frameIndex: 42,
      event: 'test_event',
    });
  });
});

describe('sha256Frame', () => {
  it('returns a 64-character hex string', () => {
    const samples = new Float64Array([1.0, 2.0, 3.0]);
    const hash = sha256Frame(samples);
    expect(hash).toHaveLength(64);
    expect(/^[0-9a-f]+$/.test(hash)).toBe(true);
  });

  it('same input produces same hash', () => {
    const a = new Float64Array([0.5, 1.5, 2.5]);
    const b = new Float64Array([0.5, 1.5, 2.5]);
    expect(sha256Frame(a)).toBe(sha256Frame(b));
  });

  it('different input produces different hash', () => {
    const a = new Float64Array([0.5]);
    const b = new Float64Array([0.6]);
    expect(sha256Frame(a)).not.toBe(sha256Frame(b));
  });
});
