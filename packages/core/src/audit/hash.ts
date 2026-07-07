// SPDX-License-Identifier: MIT
// Copyright (c) 2026 panditAbhis — Panaural Project

import { createHash } from 'node:crypto';

/**
 * Compute the SHA-256 hash of a Float64Array's raw buffer.
 * Returns a lowercase hex string.
 */
export function sha256Frame(samples: Float64Array): string {
  const hash = createHash('sha256');
  hash.update(Buffer.from(samples.buffer, samples.byteOffset, samples.byteLength));
  return hash.digest('hex');
}
