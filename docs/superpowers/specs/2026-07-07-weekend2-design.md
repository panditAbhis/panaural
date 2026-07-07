# Weekend 2 — Baseline Learner + Drift Detectors

Date: 2026-07-07
Author: panditAbhis

## Context

Weekend 1 delivered: STFT engine, inferno spectrogram, self-tests, market audit, 12-entry Module Guide.
Weekend 2 adds statistical memory: what does "normal" look like, and is now different?

Panaural is an open international reference. Every module ships with educational content.

## Scope

Pure TypeScript modules in `packages/core/src/`. No persistence (localStorage, files) in Weekend 2 —
baseline lives in memory for the session. Demo gets a new UI panel to record baseline + show drift score.
Weekend 3 will add persistence.

## Architecture — pure functions + explicit state

All Weekend 2 code follows the existing pattern: pure functions, explicit state objects, zero side effects.
State is a plain serializable object so Weekend 3 persistence is a trivial add.

```
packages/core/src/
  baseline/
    quality.ts      scoreFrameQuality(frame, config) -> FrameQuality
    build.ts        buildBaseline(frames, opts?)   -> Baseline
  detector/
    mahalanobis.ts  scoreFrame(frame, baseline)    -> MahalanobisResult
    cusum.ts        initCUSUM(opts?)               -> CUSUMState
                    updateCUSUM(state, frame, baseline) -> CUSUMState
  calibration/
    reference.ts    detectReferenceTone(frame, refHz, sr) -> CalibrationResult

packages/core/tests/
  baseline/quality.test.ts
  baseline/build.test.ts
  detector/mahalanobis.test.ts
  detector/cusum.test.ts
  calibration/reference.test.ts
```

## Types (additions to types.ts)

```typescript
Baseline {
  mu: Float64Array          // mean dBFS per bin
  sigma: Float64Array       // std deviation per bin
  numFrames: number         // frames used (must be >= 10 for use)
  frequencyResolution: number // Hz/bin (must match live frames)
  builtAt: string           // ISO 8601
}

FrameQuality {
  score: number             // 0.0 (unusable) to 1.0 (perfect)
  snrEstimate: number       // dB: peak - noise floor
  clippingFraction: number  // fraction of samples at +/-0.9
  flags: string[]           // 'clipping' | 'silence' | 'low_snr' | 'transient'
  usable: boolean           // score >= 0.6
}

MahalanobisResult {
  distance: number          // D^2 = sum((x[k]-mu[k])^2 / sigma[k]^2)
  zScores: Float64Array     // per-bin z-score
  alertLevel: 'normal' | 'warning' | 'alert'
  numBinsAlerting: number   // bins above 2-sigma
}

CUSUMState {
  S: Float64Array           // per-bin cumulative sums (the "jar level")
  alertBins: Uint8Array     // 1 if bin is in alert
  delta: number             // slack = half of minimum drift to detect (dB)
  threshold: number         // h = alert trigger level (dB, default 5*sigma)
  frameCount: number
}

CalibrationResult {
  measuredDb: number        // dBFS measured at refHz
  offsetDb: number          // correction = expectedDb - measuredDb
  valid: boolean            // SNR at refHz > 20 dB
  snrAtRefHz: number        // how cleanly the tone was detected
}
```

## Module specs

### baseline/quality.ts

Inputs: `STFTFrame`, `STFTConfig`
Output: `FrameQuality`

Criteria (in order of severity):
1. Clipping: fraction of raw samples at +-0.9 > 0.01 -> flag 'clipping', score -= 0.5
2. Silence: max bin < noise_floor + 20 dB -> flag 'silence', score = 0, usable = false
3. Low SNR: (peak bin) - (20th percentile bin) < 15 dB -> flag 'low_snr', score -= 0.3
4. Transient: RMS of frame > session_median_rms * 2 (i.e., +6 dB) -> flag 'transient', score -= 0.2

Final score clipped to [0, 1]. usable = score >= 0.6.

Note: quality.ts receives a single frame only. It has no session memory — the caller tracks
session_median_rms and passes it in via opts. This keeps the function pure.

### baseline/build.ts

Inputs: `STFTFrame[]`, `opts?: { minFrames?: number, qualityThreshold?: number }`
Output: `Baseline`

Algorithm:
1. Score each frame with scoreFrameQuality
2. Keep only frames where quality.usable == true
3. Reject if fewer than minFrames (default 10) usable frames remain
4. For each bin k: compute weighted mean and sigma (weight = quality.score)
5. Sigma floor: max(sigma[k], 0.5) — prevents division by zero and pathological sensitivity
   on bins that have no natural variation in the baseline sample

### detector/mahalanobis.ts

Inputs: `STFTFrame`, `Baseline`
Output: `MahalanobisResult`

Algorithm (diagonal covariance approximation):
  z[k] = (frame.frequencyBins[k] - baseline.mu[k]) / baseline.sigma[k]
  D^2 = sum(z[k]^2) for all k

Alert levels:
  normal:  D^2 < chi2_99_approx  (approximated as numBins + 3*sqrt(2*numBins))
  warning: D^2 >= chi2_99_approx (p=0.01)
  alert:   D^2 >= chi2_999_approx (p=0.001, approximated as numBins + 5*sqrt(2*numBins))

numBinsAlerting = count of bins where |z[k]| > 2.0

### detector/cusum.ts

Inputs (initCUSUM): `opts?: { delta?: number, threshold?: number }`
Inputs (updateCUSUM): `CUSUMState`, `STFTFrame`, `Baseline`
Output: `CUSUMState`

Algorithm (per bin k, upper CUSUM):
  z[k] = (frame.frequencyBins[k] - baseline.mu[k]) / baseline.sigma[k]
  S[k] = max(0, S[k] + z[k] - delta)
  alertBins[k] = S[k] > threshold ? 1 : 0

Default delta = 0.5 (detect 1-sigma drift), threshold = 5.0

updateCUSUM returns a NEW CUSUMState (pure — input state is not mutated).

### calibration/reference.ts

Inputs: `STFTFrame`, `refHz: number`, `sampleRate: number`, `expectedDb?: number`
Output: `CalibrationResult`

Algorithm:
1. Find bin nearest to refHz: refBin = round(refHz * fftSize / sampleRate)
2. measuredDb = average of frame.frequencyBins[refBin-1..refBin+1] (3-bin average)
3. Noise floor: median of all bins excluding +/-10 bins around refBin
4. snrAtRefHz = measuredDb - noiseFloor
5. valid = snrAtRefHz > 20 dB
6. offsetDb = (expectedDb ?? -20) - measuredDb

## Build sequence

Unit 1: types.ts + quality.ts + quality.test.ts + Guide entry G-Q in demo.html
Unit 2: build.ts + build.test.ts + Guide entry G-B
Unit 3: mahalanobis.ts + mahalanobis.test.ts + Guide entry G-M
Unit 4: cusum.ts + cusum.test.ts + Guide entry G-C
Unit 5: reference.ts + reference.test.ts + Guide entry G-R
Unit 6: demo.html Baseline + Drift panel (UI panel, no new core code)

Each unit: implement -> test (pnpm test must pass) -> commit -> show -> next.

## Educational requirement

Every unit ships with a corresponding Guide entry in demo.html:
- Concept in plain English
- The algorithm written out as pseudocode with real numbers from Panaural's defaults
- One strong analogy
- What failure looks like and why it matters

No unit is complete without its Guide entry.

## Success criteria

- pnpm test exits 0 on all 5 test files
- Mahalanobis correctly flags a synthetic +6 dB injection at a single bin as 'alert'
- CUSUM correctly detects a +1 dB/frame monotonic drift after ~10 frames (delta=0.5, threshold=5.0)
- Quality scorer correctly rejects a clipped frame (clippingFraction > 0.01)
- Baseline built from 30 clean frames of a 50 Hz sine has mu[51] within 1 dB of expected, sigma[51] < 2 dB
- All Guide entries in demo.html render without errors in Chrome
