# ADR-0005: Score blend weights and `ML_ANCHOR` calibration

- Status: Accepted
- Date: 2026-07-03
- Deciders: POC engineering

## Context

The blended score is `0.5·rule + 0.5·ml` with bands at 40 (medium) and 70 (high).
Isolation Forest's `decision_function` over a 17-feature space is **compressed** —
even strongly anomalous events only reach a raw value modestly below the normal
range. With a naive normalisation, real threats topped out around the mid-60s, so the
50/50 blend could never push them into the high band, and sessions would never
auto-block. The blend weights had to stay simple/explainable while still letting
genuine threats reach `high`.

## Decision

1. **Keep the 50/50 blend** (`RULE_WEIGHT = ML_WEIGHT = 0.5`) — simple and balanced.
2. **Calibrate the ML normalisation** at training time: record `lo = p2`,
   `hi = p98` of `decision_function` over the training data, and map
   `ml = clamp(0,100, (hi − raw)/(hi − lo) · ML_ANCHOR)` with **`ML_ANCHOR = 100`**.
   Most-normal points → ~0; the most-anomalous training points → ~100; true outliers
   clamp at 100.

`ML_ANCHOR` and the weights are constants at the top of `risk_engine.py`. The value
was chosen empirically by sweeping candidates against generated threat/normal events:
`ML_ANCHOR = 100` maps destruction/exfil/compromised → high, negligent → medium, and
keeps ~94% of baseline events in the low band.

## Consequences

- **+** Real threats reliably reach the high band and trigger the block response,
  under an unchanged, easy-to-explain 50/50 blend.
- **+** Calibration is data-driven (percentiles of the actual training scores), not a
  hand-picked magic range.
- **−** `ML_ANCHOR` is a tuned constant; retraining on very different data may warrant
  re-sweeping it. Documented as the primary tuning knob.
- **−** A small fraction of unusual-but-benign baseline events land in `medium`
  (alert only, no block) — an acceptable false-positive rate for a POC.

## Alternatives considered

- **Shift blend weights** (e.g. 0.7/0.3) — made the blend less balanced and still
  didn't fix the compressed ML range for exfil/compromised cases.
- **Escalate band directly from rules** — breaks the "band derives from score"
  contract in the spec.
