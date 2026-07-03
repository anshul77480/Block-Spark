# ADR-0004: Isolation Forest for anomaly detection

- Status: Accepted
- Date: 2026-07-03
- Deciders: POC engineering

## Context

Labelled insider-threat data is scarce and sensitive, so the ML layer must be
**unsupervised**. It operates on a modest-dimensional (17) tabular feature vector and
must run cheaply at inference for real-time scoring.

## Decision

Use scikit-learn's **`IsolationForest`** (`n_estimators=200`, `contamination=0.05`,
`random_state=42`), trained only on **normal baseline** feature vectors and persisted
with joblib. PyOD is pinned as an optional fallback detector.

## Consequences

- **+** Unsupervised — trains on normal behaviour; no incident labels needed. This is
  why the Kaggle CERT dataset drops in cleanly (train on normal only).
- **+** Fast fit/inference on tabular data; well-supported by **SHAP TreeExplainer**
  for per-feature attributions ([ADR-0009](0009-shap-llm-explanations.md)).
- **−** `decision_function` output is compressed for a 17-feature space, so raw
  anomaly scores need calibration to be comparable to the rule layer
  ([ADR-0005](0005-score-blend-and-ml-calibration.md)).
- **−** As with any anomaly detector, benign-but-rare behaviour can score elevated
  (mitigated by the rule blend and medium/high banding).

## Alternatives considered

- **One-Class SVM / LOF** — poorer scaling and weaker explainability tooling.
- **Autoencoder** — overkill for 17 tabular features; harder to explain.
- **Supervised model** — no labels available.
