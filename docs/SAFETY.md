# Safety and Failure Modes

Panaural is a Class B non-safety-critical monitoring aid. Understanding its failure modes is essential for responsible use.

---

## Failure Mode 1: Unhealthy Baseline (Calibration During Fault)

**Description:** If the pump or machinery is already degraded or faulty during the calibration period, Panaural will learn the unhealthy spectral signature as "normal." All subsequent measurements will be compared to the faulty baseline, making the tool unable to detect drift from a healthy state.

**What Panaural does:** Panaural has no way to independently verify whether the machine is healthy during calibration. It learns whatever it hears.

**What the user must do:** Only perform calibration on machinery that has been independently verified as healthy by a qualified inspector. Document the calibration date, machine condition, and who performed the verification. Recalibrate after any maintenance or repair.

---

## Failure Mode 2: Aliasing (Sample Rate Too Low for Target Frequency Band)

**Description:** If the sample rate is less than twice the highest frequency of interest (Nyquist criterion), high-frequency components fold back into the spectrum as false low-frequency content, distorting all measurements.

**What Panaural does:** `validateProfileConfig()` checks that `sampleRate >= 2 * frequencyBandOfInterest[1]` and throws a descriptive error if the Nyquist criterion is violated. The self-test suite (`runSelfTests()`) also exercises this path.

**What the user must do:** Choose a sample rate at least 2× the highest frequency you wish to monitor. For typical rotating machinery (0–10 kHz), use at least 22 050 Hz. Verify your audio hardware's supported sample rates before deployment.

---

## Failure Mode 3: Microphone Saturation (Clipping)

**Description:** When input signal amplitude exceeds the ADC's range, samples are clipped to ±1.0 (or the hardware maximum). Clipping introduces broadband harmonic distortion that corrupts the entire spectrum and can mask real faults or trigger false alarms.

**What Panaural does:** The self-test `clipping` case checks whether more than 5% of samples are at ±0.9, flags this condition, and emits a warning in `SelfTestResult.actual`. The audit logger records `inputHash` per frame so clipping events can be traced post-hoc.

**What the user must do:** Adjust microphone gain or positioning so peak levels remain below −6 dBFS during normal operation. Monitor the clipping warning in self-test output. Replace or re-position the microphone if clipping persists.

---

## Failure Mode 4: External Noise (Nearby Machinery Interference)

**Description:** Acoustic energy from adjacent machines, HVAC systems, or impulsive events (impact tools, valves) can appear in the monitored spectrum and trigger false drift alarms unrelated to the target machine.

**What Panaural does:** Panaural does not distinguish between sound sources. It reports all spectral content at its microphone position without source separation.

**What the user must do:** Use a contact accelerometer or close-coupled microphone to maximize signal-to-noise ratio. During calibration, operate only the target machine. Document any known noise sources in the measurement environment. Treat sudden broadband drift alerts with suspicion if nearby activity has changed.

---

## Failure Mode 5: Missing Failure Modes (Fault Outside Monitored Bands)

**Description:** Many machinery faults have acoustic signatures at specific frequencies determined by bearing geometry, gear mesh frequency, or rotor dynamics. If the monitored frequency band does not include these fault frequencies, Panaural will not detect the fault.

**What Panaural does:** Panaural monitors only the `frequencyBandOfInterest` defined in `ProfileAudioConfig`. Faults with signatures outside this band are invisible to the system. No warning is emitted for unmonitored frequency content.

**What the user must do:** Calculate the expected fault frequencies for all monitored machines (bearing defect frequencies, gear mesh frequencies, sub-synchronous frequencies) before configuring `frequencyBandOfInterest`. Consult the machine manufacturer's documentation and ISO 13373-3 for guidance. Verify coverage with a broadband spectrum review before deploying continuous monitoring.

---

## General User Responsibilities

- Keep calibration records with date, operator, and machine condition
- Re-validate after any maintenance that changes machine dynamics
- Do not use Panaural as the sole basis for safety-critical decisions
- All maintenance decisions shall be validated by qualified personnel per applicable standards (ISO 13373, ISO 20816)
