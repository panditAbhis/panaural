# Weekend 4 — Cepstrum Analysis + Bearing Order Analysis

Date: 2026-07-08
Author: panditAbhis

## Context

Weekends 1–3 delivered STFT spectrum analysis, statistical drift detection (Mahalanobis + CUSUM), and persistent baseline library. The Investigator Audit flags two open gaps: cepstrum analysis and order tracking. Weekend 4 closes the cepstrum gap and adds an interactive bearing fault frequency calculator that integrates with the existing Mahalanobis z-scores.

Panaural is an open international reference. Every module ships with top-class educational content.

## Scope

- Averaged power spectrum (one line chart from all STFT frames)
- Power cepstrum from averaged spectrum — quefrency plot + dominant peak
- Bearing fault frequency calculator: dropdown of ~20 common bearings + manual geometry fallback
- Bearing fault z-score lookup: colour fault-frequency overlays by Mahalanobis z-score
- Three new UI panels in demo.html
- Three new Guide entries (G-CE, G-BF, G-OA)
- No auto-detection of shaft speed from cepstrum (unreliable without tachometer)

## Architecture — Approach B: integrated z-score lookup

Four new pure modules in `packages/core/src/`:

```
transform/avgspectrum.ts     Average dB spectrum across STFT frames → Float64Array
cepstrum/compute.ts          Power cepstrum + quefrency peak detection
bearing/database.ts          Curated list of ~20 common bearings (geometry constants)
bearing/faults.ts            BPFO/BPFI/BSF/FTF calculator + z-score lookup
```

Data flow:

```
STFT frames
  → avgspectrum.ts  → averaged spectrum (Float64Array, dB per bin)
                    → cepstrum/compute.ts  → CepstrumResult
                    → bearing/faults.ts    → BearingFaultResult[]
                         ↑
              bearing/database.ts + user RPM input + MahalanobisResult.zScores
```

No changes to existing Weekend 1–3 modules. New modules consume `STFTFrame[]` and `Float64Array` (zScores) — both produced by the existing pipeline.

## Data Types

All added to `packages/core/src/types.ts`:

```typescript
// The five numbers that fully specify any rolling-element bearing
export interface BearingGeometry {
  Nb: number;      // number of rolling elements
  Bd: number;      // ball diameter (mm)
  Pd: number;      // pitch diameter (mm)
  alpha: number;   // contact angle (degrees)
}

// Entry in the curated bearing database
export interface BearingEntry {
  partNumber: string;   // e.g. "6205-2RS"
  description: string;  // e.g. "Deep groove, 25mm bore — common pump/motor bearing"
  geometry: BearingGeometry;
}

// Computed fault frequencies for one bearing at one shaft speed
export interface BearingFaultFreqs {
  bpfo: number;    // Hz — outer race (most common early fault)
  bpfi: number;    // Hz — inner race
  bsf:  number;    // Hz — ball spin
  ftf:  number;    // Hz — cage (fundamental train)
  shaftHz: number; // Hz — shaft rotation (RPM / 60)
}

// Per-fault result after z-score lookup
export interface BearingFaultResult {
  label: 'BPFO' | 'BPFI' | 'BSF' | 'FTF' | 'shaft';
  freqHz: number;
  binIndex: number;
  zScore: number;
  alertLevel: 'normal' | 'warning' | 'alert';
}

// Power cepstrum result
export interface CepstrumResult {
  quefrency: Float64Array;   // quefrency axis (seconds)
  power: Float64Array;       // power cepstrum values (dB)
  dominantQuefrency: number; // quefrency of highest peak above noise floor (seconds)
  impliedFreqHz: number;     // 1 / dominantQuefrency — likely shaft or fault fundamental
}
```

## Function Signatures

### transform/avgspectrum.ts

```typescript
// Average dB magnitude across all STFT frames, per bin.
// Returns Float64Array length == frames[0].frequencyBins.length.
// Throws if frames is empty.
computeAvgSpectrum(frames: STFTFrame[]): Float64Array
```

### cepstrum/compute.ts

```typescript
// Power cepstrum: IFFT( log10( avgSpectrum_linear² ) ).
// avgSpectrum is in dB — convert to linear before log10.
// freqRes: Hz/bin — used to build the quefrency axis in seconds.
// Ignores quefrency < minQuefrencyS (default 0.002 s = 500 Hz implied) to skip DC region.
computeCepstrum(
  avgSpectrum: Float64Array,
  freqRes: number,
  opts?: { minQuefrencyS?: number }
): CepstrumResult
```

### bearing/database.ts

```typescript
// Returns full curated bearing list (~20 entries), sorted by partNumber.
getBearingDatabase(): BearingEntry[]
```

Curated list includes:

| Part number | Description |
|-------------|-------------|
| 6200-2RS | Deep groove, 10mm bore |
| 6201-2RS | Deep groove, 12mm bore |
| 6202-2RS | Deep groove, 15mm bore |
| 6203-2RS | Deep groove, 17mm bore |
| 6204-2RS | Deep groove, 20mm bore |
| 6205-2RS | Deep groove, 25mm bore — common pump/motor bearing |
| 6206-2RS | Deep groove, 30mm bore |
| 6207-2RS | Deep groove, 35mm bore |
| 6208-2RS | Deep groove, 40mm bore |
| 6209-2RS | Deep groove, 45mm bore |
| 6210-2RS | Deep groove, 50mm bore |
| 6304-2RS | Deep groove, 20mm bore, heavy duty |
| 6305-2RS | Deep groove, 25mm bore, heavy duty |
| 6306-2RS | Deep groove, 30mm bore, heavy duty |
| 6308-2RS | Deep groove, 40mm bore, heavy duty |
| 22210-E | Spherical roller, 50mm bore — industrial fan/pump |
| 22212-E | Spherical roller, 60mm bore |
| NU205-E | Cylindrical roller, 25mm bore |
| NU206-E | Cylindrical roller, 30mm bore |
| 51206 | Thrust bearing, 30mm bore |

### bearing/faults.ts

```typescript
// Compute BPFO/BPFI/BSF/FTF and shaft frequency from RPM + geometry.
// Formulae per ISO 15243:
//   BPFO = (Nb/2) * shaftHz * (1 - (Bd/Pd)*cos(alpha))
//   BPFI = (Nb/2) * shaftHz * (1 + (Bd/Pd)*cos(alpha))
//   BSF  = (Pd/(2*Bd)) * shaftHz * (1 - ((Bd/Pd)*cos(alpha))^2)
//   FTF  = 0.5 * shaftHz * (1 - (Bd/Pd)*cos(alpha))
computeFaultFreqs(rpm: number, geometry: BearingGeometry): BearingFaultFreqs

// Look up z-score at each fault frequency's bin index.
// binIndex = Math.round(freqHz / freqRes), clamped to [0, zScores.length-1].
// Thresholds: z >= 3.0 -> warning, z >= 4.0 -> alert (same as Mahalanobis).
// zScores is MahalanobisResult.zScores (Float64Array of absolute z-values).
scoreFaultFreqs(
  faultFreqs: BearingFaultFreqs,
  zScores: Float64Array,
  freqRes: number
): BearingFaultResult[]
```

## Demo UI — Three New Panels

### Panel 1 — Averaged Spectrum

Canvas line chart: dB (y-axis) vs Hz (x-axis, 0 to maxFreq). Rendered whenever a WAV is loaded.

When bearing fault frequencies are computed:
- Draw vertical lines at shaft, BPFO, BPFI, BSF, FTF
- Colour by alert level: green (normal), amber (warning), red (alert)
- Label each line with its tag ("BPFO", "BPFI" etc.) and Hz value
- If no detection has been run, lines are drawn grey (frequencies shown, no z-score available)

### Panel 2 — Bearing Calculator

Form fields:
- RPM (number input, required)
- Bearing selector (dropdown: ~20 entries + "Custom bearing" option)
- When "Custom bearing" selected: Nb, Bd (mm), Pd (mm), alpha (degrees) fields appear
- "Compute fault frequencies" button

Results table (after compute):

| Fault | Hz | Bin | z-score | Level |
|-------|----|-----|---------|-------|
| Shaft | 24.2 | 25 | 0.3 | NORMAL |
| BPFO  | 84.2 | 86 | 4.1 | ALERT |
| BPFI  | 112.6 | 115 | 0.9 | NORMAL |
| BSF   | 55.1 | 56 | 1.2 | NORMAL |
| FTF   | 9.6 | 10 | 0.4 | NORMAL |

z-score and level columns show "--" if no detection has been run.

"Compute fault frequencies" also triggers a re-render of the Averaged Spectrum panel with coloured overlays.

### Panel 3 — Cepstrum

Canvas line chart: power (y-axis, dB) vs quefrency (x-axis, ms). Rendered alongside averaged spectrum.

Marks dominant peak with a vertical line. Shows below chart: "Dominant quefrency: X ms → implied fundamental: Y Hz (Z RPM)". This is informational only — does not auto-populate the bearing calculator.

## Educational Requirement — Top-Class Teaching Guide

Teaching section label: "Cepstrum + Order Analysis" (inside existing Learning Guide accordion).

**G-CE — Power cepstrum: the spectrum of the spectrum**
- Why harmonic families in the frequency domain appear as a single spike in the cepstrum
- The math: cepstrum = IFFT(log|X(f)|²), why log before IFFT
- Quefrency domain explained: units, what a peak at 8 ms means (implies 125 Hz fundamental)
- Worked numbers with real bearing fault spectrum
- Analogy: like using a second FFT to find the "rhythm" hidden in the frequency domain
- What failure looks like: missed shaft harmonics, broadband noise masking the cepstrum peak

**G-BF — Bearing fault frequencies: interactive calculator context**
- Expands G11 (manual worked example already in guide) with context on z-score lookup
- Why BPFO appears most often first: outer race is stationary, defect load zone fixed
- How to interpret a coloured overlay: "BPFO red, others green" = outer race fault hypothesis
- When to escalate vs. monitor: one session ALERT vs. three consecutive sessions WARNING
- Common false positives: blade-pass harmonics near BPFO, electrical noise at mains frequency

**G-OA — Order analysis: shaft speed and harmonic structure**
- What "orders" means: 1X = shaft, 2X = misalignment, nX = blade-pass
- Why VFD-controlled motors need a tachometer: speed changes, harmonics shift
- How Panaural's fixed-frequency approach works within its limits
- The relationship between RPM, bearing geometry, and where faults appear
- Industrial context: ISO 13373-3 recommendations for order-based analysis

Standard: a maintenance engineer reading G-CE for the first time should understand what a cepstrum shows and why it is useful for bearing diagnosis, without reading anything else.

## Testing Strategy

All four new modules are pure functions — no IO, no browser APIs, testable in Vitest directly.

Key test cases:
- `computeAvgSpectrum`: empty frames throws; single frame returns its bins; multiple frames averaged correctly
- `computeCepstrum`: sine wave input produces cepstrum peak at correct quefrency; DC region excluded by minQuefrencyS
- `getBearingDatabase`: returns array; all entries have valid geometry (Nb > 0, Bd > 0, Pd > Bd, 0 <= alpha <= 45)
- `computeFaultFreqs`: known bearing geometry produces BPFO within 0.1 Hz of hand-calculated value; all freqs > 0; BPFI > BPFO always
- `scoreFaultFreqs`: z=3.5 at BPFO bin → warning; z=4.5 → alert; z=1.0 → normal; bin clamped correctly at spectrum edges

## Build Sequence

| Unit | Deliverable |
|------|-------------|
| 1 | Types: BearingGeometry, BearingEntry, BearingFaultFreqs, BearingFaultResult, CepstrumResult |
| 2 | `transform/avgspectrum.ts` + tests |
| 3 | `cepstrum/compute.ts` + tests |
| 4 | `bearing/database.ts` + tests |
| 5 | `bearing/faults.ts` + tests |
| 6 | `index.ts` re-exports |
| 7 | demo.html: Averaged Spectrum panel + Bearing Calculator panel + Cepstrum panel + inline JS + Guide entries G-CE, G-BF, G-OA |

Each unit: failing tests first → implement → pnpm test passes → commit. Education ships with code.

## Success Criteria

- `pnpm test` exits 0 across all test files
- `computeFaultFreqs` for 6205-2RS at 1450 RPM produces BPFO within 0.1 Hz of 84.2 Hz
- `scoreFaultFreqs` correctly maps z >= 3.0 → warning, z >= 4.0 → alert
- Averaged spectrum renders without errors on a loaded WAV file
- Bearing calculator: selecting 6205-2RS + 1450 RPM → correct BPFO shown in table
- Coloured overlays appear on averaged spectrum after "Compute fault frequencies"
- Cepstrum panel renders for a loaded WAV with dominant peak marked
- Guide entries G-CE, G-BF, G-OA render inside Learning Guide accordion without console errors
- Audit panel "Cepstrum analysis" row updated from GAP to PARTIAL
