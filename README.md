# Panaural

An acoustic drift-detection instrument for industrial rotating machinery.

## Overview

Panaural listens to a mechanical system through a contact or air microphone, learns the system's healthy spectral signature during a documented calibration period, and reports drift from that baseline in plain language.

**Verdicts issued by Panaural are indicative, not diagnostic.**

## Packages

- `@panaural/core` — zero-dependency TypeScript core: STFT, PSD, audit logging, self-tests
- `packages/demo` — standalone browser spectrogram demo (no bundler required)

## Getting Started

```bash
pnpm install
pnpm test
pnpm demo
```

## License

MIT — see [LICENSE](./LICENSE)
