# ADR-0015: Deepen the model — personalization, feature scaling, and evaluation

- Status: Accepted
- Date: 2026-07-03
- Deciders: POC engineering

## Context

The initial model used 17 **absolute** features and a bare Isolation Forest with no
feature scaling and no quantitative evaluation. Three weaknesses followed:

1. **Absolute thresholds are noisy.** "500 records" means very different things for a
   bulk-export analyst vs a teller. The strongest insider signal is deviation from
   *this user's own* normal, which absolute features don't capture.
2. **Unscaled features** let high-magnitude columns (bytes, record counts) dominate
   the isolation splits over small-but-informative ones.
3. **Raw hour** made 23:00 and 01:00 look far apart to the model even though both are
   "late night".
4. **No measurement.** Tuning (weights, `ML_ANCHOR`) was done by eye against a few
   scenarios, with no precision/recall to justify changes.

## Decision

Extend the feature/model pipeline while keeping the rule layer, banding, cause
logic, explanation flow, and API contract unchanged:

1. **Per-user z-score features** (`records_z`, `velocity_z`, `export_z`) —
   standardise key metrics against per-user `activity_stats` (mean/std over that
   user's baseline), stored on the `User` row and computed in a two-pass `seed.py`
   so training data has realistic z variance.
2. **Cyclical time encoding** (`hour_sin`, `hour_cos`) alongside `hour_of_day`.
3. **`StandardScaler`** fitted at training time, persisted in `CalibratedModel`, and
   applied consistently before scoring **and** before SHAP.
4. **`evaluate.py`** — a labelled-injection harness reporting precision/recall/F1 for
   the alert and block decisions, ROC-AUC, and a per-scenario breakdown
   (`make evaluate`).

Feature count grows 17 → **22**; `FEATURE_ORDER` is the single source of truth and
requires retraining (handled automatically by `seed` + `train`).

## Consequences

- **+** Personalization: z-scores let the model flag "abnormal for this user"; SHAP
  now surfaces `records_z` as a top driver on real threats.
- **+** Scaling makes the anomaly score more balanced across features.
- **+** Cyclical time removes the artificial midnight discontinuity.
- **+** Evaluation makes tuning **data-driven** and regressions visible. Baseline
  results: alert F1 ≈ 0.91, block precision 1.00, ROC-AUC ≈ 0.98 (200+200 samples).
- **−** The persisted model artifact changes shape (adds `scaler`); old artifacts
  must be retrained. Loading a bare estimator still falls back gracefully.
- **−** z-score quality depends on having enough per-user baseline; sparse users get
  weak personalization (z ≈ 0) until more history accumulates.

## Alternatives considered

- **Ensemble (Isolation Forest + LOF/OCSVM)** — deferred: LOF/OCSVM aren't tree-based,
  which complicates the SHAP TreeExplainer path. Kept as future work.
- **Autoencoder / sequence model** — higher effort; overkill for 22 tabular features
  at POC scale (future work).
- **Multi-resolution windows (5m/1h/24h/7d)** — valuable but larger change; deferred.

## Follow-ups (future work)

Ensemble scoring, sequence models, multi-window aggregates, peer-group baselines,
drift detection + scheduled retraining, and a supervised cause classifier once
labels exist. See [future-scope.md](../future-scope.md).
