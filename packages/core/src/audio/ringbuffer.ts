// SPDX-License-Identifier: MIT
// Copyright (c) 2026 panditAbhis — Panaural Project

/**
 * Circular buffer for audio frames.
 * When the buffer is full, the oldest frames are overwritten.
 */
export class RingBuffer {
  private readonly buffer: Float64Array;
  private writeHead: number = 0;
  private count: number = 0;

  constructor(private readonly capacity: number) {
    this.buffer = new Float64Array(capacity);
  }

  /** Write samples into the ring buffer. */
  write(samples: Float64Array): void {
    for (let i = 0; i < samples.length; i++) {
      this.buffer[this.writeHead] = samples[i]!;
      this.writeHead = (this.writeHead + 1) % this.capacity;
      if (this.count < this.capacity) {
        this.count++;
      }
    }
  }

  /** Read the most recent `length` samples in chronological order. */
  read(length: number): Float64Array {
    const n = Math.min(length, this.count);
    const result = new Float64Array(n);
    const start = (this.writeHead - n + this.capacity) % this.capacity;
    for (let i = 0; i < n; i++) {
      result[i] = this.buffer[(start + i) % this.capacity]!;
    }
    return result;
  }

  /** Number of samples currently stored. */
  get size(): number {
    return this.count;
  }

  /** Maximum capacity in samples. */
  get maxCapacity(): number {
    return this.capacity;
  }
}
