# Risk methodology

How a raw activity event becomes a 0–100 risk score, a band, a cause, and a
plain-English explanation.

## 1. Feature engineering (`features.py`)

Each event is converted — using the actor's recent activity (a 30-minute rolling
window) and their behavioural baseline — into a fixed **22-dimensional** vector.
`FEATURE_ORDER` is the canonical column order shared by training and inference.

| # | Feature | Meaning |
|---|---------|---------|
| 1 | `hour_of_day` | 0–23 |
| 2–3 | `hour_sin`, `hour_cos` | **cyclical time encoding** so 23:00 ≈ 01:00 to the model |
| 4 | `is_off_hours` | 1 if outside 09:00–18:00 |
| 5 | `is_weekend` | 1 if Sat/Sun |
| 6 | `geo_distance_km` | haversine from the user's baseline location |
| 7 | `is_new_device` | device not in the user's known devices |
| 8 | `is_new_ip` | source IP outside the baseline /24 subnet |
| 9 | `records_accessed_in_window` | total records touched in the window |
| 10 | `distinct_accounts_in_window` | distinct account IDs in the window |
| 11 | `sequential_access_score` | 0–1, fraction of accessed IDs forming a consecutive run (scraping) |
| 12 | `export_count_in_window` | number of data-export actions |
| 13 | `export_volume_mb` | exported bytes → MB |
| 14 | `download_count_in_window` | number of file downloads |
| 15 | `sensitive_resource_access_count` | resources matching PII/core keywords |
| 16 | `risky_command_flag` | destructive/log-clearing command detected |
| 17 | `no_ticket_flag` | high-risk action with no matching case/ticket |
| 18 | `failed_action_ratio` | failed actions ÷ window size |
| 19 | `actions_per_minute` | velocity across the window |
| 20 | `records_z` | **per-user z-score** of records vs the user's own baseline |
| 21 | `velocity_z` | **per-user z-score** of action velocity |
| 22 | `export_z` | **per-user z-score** of export volume |

The **z-score features personalize** detection: "10× *this user's* normal" is a far
stronger signal than an absolute threshold. They are standardised against per-user
`activity_stats` (mean/std of the source feature over that user's baseline), computed
in `seed.py` and stored on the `User` row. See [ADR-0015].

Both the raw event and its computed vector are persisted on the `Event` row.

## 2. Hybrid scoring (`risk_engine.py`)

```
final = clamp(0, 100, RULE_WEIGHT · rule_score + ML_WEIGHT · ml_score)
RULE_WEIGHT = ML_WEIGHT = 0.5
```

### 2.1 Rule layer (deterministic, always explainable)

Starts at 0, adds points, caps at 100. Every fired rule is stored with its points
and a human-readable detail.

| Rule | Points | Trigger |
|------|:------:|---------|
| `off_hours_access` | +15 | `is_off_hours` |
| `no_ticket_high_risk` | +25 | `no_ticket_flag` |
| `bulk_export` | +25 | ≥ 500 records **or** ≥ 50 MB in window |
| `sequential_scraping` | +20 | `sequential_access_score` ≥ 0.6 |
| `destructive_command` | +40 | `risky_command_flag` |
| `new_device_and_ip` | +20 | new device **and** new IP together |
| `high_velocity` | +10 | `actions_per_minute` ≥ 3 |

### 2.2 ML layer (Isolation Forest anomaly score)

The Isolation Forest is trained **only on normal** activity ([ADR-0004]). Feature
vectors are first passed through a **`StandardScaler`** (fitted at training time,
persisted with the model) so no single high-magnitude column (e.g. bytes) dominates
the isolation splits. At inference, `decision_function` (higher = more normal) is
normalised to 0–100:

```
ml = clamp(0, 100, (hi − raw) / (hi − lo) · ML_ANCHOR)
```

where `lo`/`hi` are the 2nd/98th percentiles of `decision_function` over the
(scaled) training data (captured at train time and persisted with the model), and
`ML_ANCHOR = 100`. See [ADR-0005] for why `ML_ANCHOR` exists.

### 2.3 Bands

| Band | Range | Response |
|------|-------|----------|
| low | 0–39 | log only |
| medium | 40–69 | raise alert, flag session |
| high | 70–100 | raise alert, **block session**, require re-auth |

### 2.4 Worked examples (from the shipped scenarios)

| Scenario | rule | ml | final | band | cause |
|----------|:----:|:--:|:-----:|------|-------|
| normal record view | 0 | ~17 | ~8 | low | — |
| no-ticket PII query | 25 | ~90 | ~58 | medium | Negligent User |
| off-hours foreign-device query | 60 | ~83 | ~72 | high | Compromised Account |
| bulk PII export | 50 | ~97 | ~73 | high | Malicious Insider |
| destructive command | 90 | 100 | 95 | high | Malicious Insider |

## 3. Model training & calibration (`train_model.py`)

1. Load baseline feature vectors from the DB (`is_baseline == True`); fall back to a
   synthetic normal set if fewer than 30 exist.
2. Fit a **`StandardScaler`** on the vectors and transform them.
3. Fit `IsolationForest(n_estimators=200, contamination=0.05, random_state=42)` on
   the scaled data.
4. Compute `lo = p2`, `hi = p98` of `decision_function` over the scaled training set.
5. Persist a `CalibratedModel{model, scaler, lo, hi, feature_order}` via joblib.

Because the detector is unsupervised, **no labels are required** — this is why the
Kaggle CERT dataset (train on normal behaviour) drops in cleanly.

## 3a. Evaluation (`evaluate.py`)

`evaluate.py` builds a labelled test set by injecting known normal + threat events
(reusing the simulator's scenario generators), scores each through the real
pipeline, and reports detection quality — so tuning is **measured, not guessed**:

- **Alert decision** (band ≥ medium) and **Block decision** (band = high): precision,
  recall, F1, and a confusion matrix.
- **ROC-AUC** over the continuous risk score.
- A per-scenario band breakdown.

Indicative results on 200 normal + 200 threat samples (22 features, scaled):

| Decision | Precision | Recall | F1 |
|----------|:---------:|:------:|:--:|
| Alert (medium+) | 0.92 | 0.91 | 0.91 |
| Block (high) | 1.00 | 0.54 | 0.70 |

ROC-AUC ≈ **0.98**. Block precision is 1.00 (no false auto-blocks); block recall is
lower because *compromised* events with benign action content are intentionally
scored medium (alert + investigate) rather than hard-blocked. Run with
`make evaluate` (or `python evaluate.py --normal N --threats N`).

## 4. Cause classification (`cause.py`)

Features are grouped into three signal buckets:

- **Identity/context** — `is_new_device`, `is_new_ip`, `geo_distance_km`,
  `hour_of_day`, `is_off_hours`, `is_weekend`.
- **Exfil/evasion** — exports, downloads, `sequential_access_score`,
  `risky_command_flag`, records/accounts touched.
- **Policy** — `no_ticket_flag`, `sensitive_resource_access_count`,
  `failed_action_ratio`, `actions_per_minute`.

Algorithm:

1. **Rule overrides first.** Destructive/exfil/scraping rules ⇒ **Malicious
   Insider**. A pure identity anomaly (new device **and** new IP) with normal action
   content ⇒ **Compromised Account**.
2. **Otherwise weigh buckets.** Sum |SHAP contribution| per bucket, nudge by fired
   rules, pick the dominant bucket → Compromised / Malicious / Negligent.
3. **Default** to Negligent User when no meaningful signal dominates.

Returns the cause plus the top-3 contributing features. See [ADR-0014].

## 5. Explanations (`explain.py`)

1. `shap.TreeExplainer` (fallback `KernelExplainer`) → top-3 features by
   |contribution|.
2. Build a compact JSON payload: user, role, action, score, band, cause, top
   features, fired rules.
3. Send to the LLM (`httpx` → OpenAI-compatible `/chat/completions`) for a 3–4
   sentence narrative + a recommended action.
4. **If `LLM_API_KEY` is empty**, a deterministic template produces an equivalent
   narrative — the demo never depends on an external LLM. The response records
   `explanation_source: "llm" | "template"`. See [ADR-0009].

[ADR-0004]: adr/0004-isolation-forest.md
[ADR-0005]: adr/0005-score-blend-and-ml-calibration.md
[ADR-0009]: adr/0009-shap-llm-explanations.md
[ADR-0014]: adr/0014-cause-classification-strategy.md
[ADR-0015]: adr/0015-model-personalization-and-evaluation.md
