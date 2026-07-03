"""Train the Isolation Forest on baseline (normal) activity and persist it with
calibration bounds via joblib.

Training data source priority:
  1. Baseline events in the DB (created by seed.py) — is_baseline == True.
  2. If none exist, a synthetic normal set so the model always trains.

Run:  python train_model.py
"""
from __future__ import annotations

import math

import numpy as np
from sklearn.ensemble import IsolationForest
from sklearn.preprocessing import StandardScaler

from app.config import settings
from app.db import SessionLocal, init_db
from app.features import FEATURE_ORDER, features_to_vector
from app.models import Event
from app.risk_engine import CalibratedModel
import joblib


def _load_baseline_vectors() -> np.ndarray:
    db = SessionLocal()
    try:
        rows = db.query(Event).filter(Event.is_baseline == True).all()  # noqa: E712
        vecs = [features_to_vector(r.features) for r in rows if r.features]
    finally:
        db.close()
    return np.array(vecs, dtype=float) if vecs else np.empty((0, len(FEATURE_ORDER)))


def _synthetic_normal(n: int = 400) -> np.ndarray:
    """Generate plausible NORMAL feature vectors. Built as name->value dicts and
    vectorised via features_to_vector, so it stays correct if FEATURE_ORDER grows."""
    rng = np.random.default_rng(42)
    rows = []
    for _ in range(n):
        hour = int(rng.integers(9, 18))  # business hours
        f = {
            "hour_of_day": float(hour),
            "hour_sin": math.sin(2 * math.pi * hour / 24.0),
            "hour_cos": math.cos(2 * math.pi * hour / 24.0),
            "is_off_hours": 0.0,
            "is_weekend": 0.0,
            "geo_distance_km": float(rng.uniform(0, 15)),
            "is_new_device": 0.0,
            "is_new_ip": 0.0,
            "records_accessed_in_window": float(rng.integers(0, 20)),
            "distinct_accounts_in_window": float(rng.integers(1, 5)),
            "sequential_access_score": float(rng.uniform(0, 0.3)),
            "export_count_in_window": float(rng.integers(0, 1)),
            "export_volume_mb": float(rng.uniform(0, 2)),
            "download_count_in_window": float(rng.integers(0, 2)),
            "sensitive_resource_access_count": float(rng.integers(0, 3)),
            "risky_command_flag": 0.0,
            "no_ticket_flag": 0.0,
            "failed_action_ratio": float(rng.uniform(0, 0.05)),
            "actions_per_minute": float(rng.uniform(0.03, 0.6)),
            # normal behaviour ~ N(0,1) around the user's own baseline
            "records_z": float(rng.normal(0, 1)),
            "velocity_z": float(rng.normal(0, 1)),
            "export_z": float(rng.normal(0, 1)),
        }
        rows.append(features_to_vector(f))
    return np.array(rows, dtype=float)


def train_and_save(path: str | None = None) -> CalibratedModel:
    init_db()
    X = _load_baseline_vectors()
    source = "db-baseline"
    if X.shape[0] < 30:
        synth = _synthetic_normal()
        X = np.vstack([X, synth]) if X.shape[0] else synth
        source = "synthetic" if X.shape[0] == synth.shape[0] else "db+synthetic"

    # Standardise features so no single high-magnitude column (e.g. bytes) dominates
    # the isolation splits; the scaler is persisted and applied at inference.
    scaler = StandardScaler()
    Xs = scaler.fit_transform(X)

    model = IsolationForest(
        n_estimators=200,
        contamination=0.05,
        max_samples="auto",
        random_state=42,
    )
    model.fit(Xs)

    scores = model.decision_function(Xs)
    lo = float(np.percentile(scores, 2))
    hi = float(np.percentile(scores, 98))
    # guard against degenerate span
    if hi - lo < 1e-3:
        hi, lo = hi + 0.1, lo - 0.1

    calibrated = CalibratedModel(model=model, lo=lo, hi=hi,
                                 feature_order=FEATURE_ORDER, scaler=scaler)
    path = path or settings.MODEL_PATH
    joblib.dump(calibrated, path)
    print(f"[train] trained on {X.shape[0]} vectors x {X.shape[1]} features ({source}); "
          f"scaled; calibration lo={lo:.4f} hi={hi:.4f}; saved -> {path}")
    return calibrated


if __name__ == "__main__":
    train_and_save()
