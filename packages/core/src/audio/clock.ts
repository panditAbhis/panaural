// SPDX-License-Identifier: MIT
// Copyright (c) 2026 panditAbhis — Panaural Project

/**
 * Returns a monotonic timestamp in nanoseconds using process.hrtime.bigint().
 * Never use Date.now() for timing — it is not monotonic.
 */
export function monotonicNs(): bigint {
  return process.hrtime.bigint();
}

/**
 * Returns the current time as an ISO 8601 string.
 * Used for human-readable audit log timestamps only, not for timing.
 */
export function isoNow(): string {
  return new Date().toISOString();
}
