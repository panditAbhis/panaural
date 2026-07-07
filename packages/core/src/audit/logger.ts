// SPDX-License-Identifier: MIT
// Copyright (c) 2026 panditAbhis — Panaural Project

import { appendFileSync, openSync, closeSync } from 'node:fs';
import type { AuditLogEntry, AuditLogger } from '../types.js';

/**
 * Create an append-only JSONL audit logger.
 * Each call to log() writes one JSON object as a single line.
 * The file descriptor is kept open for efficient appends and closed by close().
 */
export function createAuditLogger(logPath: string): AuditLogger {
  // Open (or create) the file in append mode to validate access early.
  const fd = openSync(logPath, 'a');

  return {
    log(entry: AuditLogEntry): void {
      const line = JSON.stringify(entry) + '\n';
      appendFileSync(logPath, line, { encoding: 'utf8' });
    },

    close(): void {
      closeSync(fd);
    },
  };
}
