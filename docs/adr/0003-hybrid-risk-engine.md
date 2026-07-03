# ADR-0003: Hybrid risk engine (rules + machine learning)

- Status: Accepted
- Date: 2026-07-03
- Deciders: POC engineering

## Context

Insider-threat scoring must be both **defensible** (an analyst needs to know *why* an
event scored high) and **able to catch novel/anomalous behaviour** that no rule
anticipated. Pure rules miss unknowns; pure ML is a black box and hard to trust in a
regulated banking context.

## Decision

Blend two layers into a single 0–100 score:

```
final = clamp(0,100, RULE_WEIGHT · rule_score + ML_WEIGHT · ml_score)
```

- **Rule layer** — deterministic, always-explainable points for known-bad patterns
  (off-hours, no-ticket, bulk export, scraping, destructive commands, new device+IP,
  velocity). Every fired rule is recorded.
- **ML layer** — an Isolation Forest anomaly score for behaviour that deviates from
  the user population's norm.

Weights and thresholds are module-level constants in `risk_engine.py` for easy
tuning.

## Consequences

- **+** Explainability (rules) + novelty detection (ML) in one score.
- **+** The rule layer alone keeps the system useful even before/without a trained
  model.
- **+** Analysts see the exact rules that fired alongside the ML contribution.
- **−** Two layers to calibrate; their relative influence needs tuning
  ([ADR-0005](0005-score-blend-and-ml-calibration.md)).

## Alternatives considered

- **Rules only** — no coverage of unknown patterns.
- **ML only** — opaque; hard to justify a block to a banking auditor.
- **Supervised classifier** — needs labelled insider incidents, which are scarce and
  privacy-sensitive.
