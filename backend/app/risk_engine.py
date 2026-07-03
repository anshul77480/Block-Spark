"""Core deliverable: hybrid risk score (0-100) = blend of a deterministic rule
layer and an Isolation Forest anomaly layer.

Weights and thresholds are module-level constants so they are easy to tune.
"""
from __future__ import annotations

import os
from dataclasses import dataclass
from typing import Optional

import joblib
import numpy as np

from .config import settings
from .features import (
    BULK_EXPORT_MB,
    BULK_EXPORT_RECORDS,
    FEATURE_ORDER,
    features_to_vector,
)

# ---- tunable weights ----
RULE_WEIGHT = 0.5
ML_WEIGHT = 0.5

BAND_MEDIUM = 40
BAND_HIGH = 70

# ---- rule point values ----
RULE_POINTS = {
    "off_hours_access": 15,
    "no_ticket_high_risk": 25,
    "bulk_export": 25,
    "sequential_scraping": 20,
    "destructive_command": 40,
    "new_device_and_ip": 20,
    "high_velocity": 10,
}

SEQUENTIAL_SCRAPING_THRESHOLD = 0.6
HIGH_VELOCITY_THRESHOLD = 3.0  # actions per minute

# ML normalisation: linearly map the IsolationForest decision_function so the
# most-normal training points (raw ~= `hi`) -> 0 and the most-anomalous training
# points (raw ~= `lo`) -> ML_ANCHOR, clamped to 100. Tuned (see README "Tuning")
# so real threats reach the high band under the 50/50 blend while normal activity
# stays low.
ML_ANCHOR = 100.0


@dataclass
class CalibratedModel:
    """Wraps a trained IsolationForest plus the fitted feature scaler and the
    calibration bounds from training.

    Persisted with joblib. `scaler` is a StandardScaler fitted on the training
    vectors (so no single high-magnitude feature dominates the trees). `lo`/`hi` are
    percentiles of decision_function over the (scaled) training data — higher
    decision_function == more normal.
    """
    model: object
    lo: float
    hi: float
    feature_order: list
    scaler: object = None

    def transform(self, vec):
        """Apply the fitted scaler (identity if none was persisted)."""
        return self.scaler.transform(vec) if self.scaler is not None else vec


_model: Optional[CalibratedModel] = None  # lazy-loaded


def _resolve_model_path() -> str:
    for p in (
        settings.MODEL_PATH,
        os.path.join(os.path.dirname(os.path.dirname(__file__)), settings.MODEL_PATH),
    ):
        if os.path.exists(p):
            return p
    return settings.MODEL_PATH


def load_model(path: Optional[str] = None) -> Optional[CalibratedModel]:
    """Load the persisted CalibratedModel (cached). None if not trained yet."""
    global _model
    if _model is not None:
        return _model
    path = path or _resolve_model_path()
    if path and os.path.exists(path):
        obj = joblib.load(path)
        _model = obj if isinstance(obj, CalibratedModel) else CalibratedModel(
            model=obj, lo=-0.15, hi=0.15, feature_order=FEATURE_ORDER
        )
    return _model


def set_model(model: Optional[CalibratedModel]):
    global _model
    _model = model


def sklearn_model(m: Optional[CalibratedModel] = None):
    """Return the underlying sklearn estimator (for SHAP)."""
    m = m or load_model()
    return m.model if isinstance(m, CalibratedModel) else m


# ---------- rule layer ----------
def rule_score(features: dict) -> tuple[float, list[dict]]:
    """Deterministic, always-explainable. Returns (0-100 score, fired rules)."""
    score = 0.0
    fired: list[dict] = []

    def fire(rule: str, detail: str):
        nonlocal score
        pts = RULE_POINTS[rule]
        score += pts
        fired.append({"rule": rule, "points": pts, "detail": detail})

    if features.get("is_off_hours", 0) >= 1:
        fire("off_hours_access", "Activity outside 09:00-18:00 business hours")
    if features.get("no_ticket_flag", 0) >= 1:
        fire("no_ticket_high_risk", "High-risk action performed with no matching change/case ticket")
    if (features.get("records_accessed_in_window", 0) >= BULK_EXPORT_RECORDS
            or features.get("export_volume_mb", 0) >= BULK_EXPORT_MB):
        fire("bulk_export", f"Bulk data movement (>= {BULK_EXPORT_RECORDS} records or {BULK_EXPORT_MB} MB)")
    if features.get("sequential_access_score", 0) >= SEQUENTIAL_SCRAPING_THRESHOLD:
        fire("sequential_scraping", "Sequential account paging pattern consistent with scraping")
    if features.get("risky_command_flag", 0) >= 1:
        fire("destructive_command", "Destructive or log-clearing command executed")
    if features.get("is_new_device", 0) >= 1 and features.get("is_new_ip", 0) >= 1:
        fire("new_device_and_ip", "New device AND new network location in the same session")
    if features.get("actions_per_minute", 0) >= HIGH_VELOCITY_THRESHOLD:
        fire("high_velocity", "Unusually high action velocity")

    return float(min(100.0, score)), fired


# ---------- ML layer ----------
def ml_score(features: dict, model: Optional[CalibratedModel] = None) -> float:
    """Normalise the Isolation Forest anomaly score to 0-100 (higher = more anomalous)."""
    model = model or load_model()
    if model is None:
        return 0.0
    est = sklearn_model(model)
    lo = getattr(model, "lo", -0.15)
    hi = getattr(model, "hi", 0.15)
    vec = np.array([features_to_vector(features)], dtype=float)
    if isinstance(model, CalibratedModel):
        vec = model.transform(vec)
    raw = float(est.decision_function(vec)[0])
    span = max(1e-6, (hi - lo))
    normalised = (hi - raw) / span * ML_ANCHOR
    return float(max(0.0, min(100.0, normalised)))


def band_for(score: float) -> str:
    if score >= BAND_HIGH:
        return "high"
    if score >= BAND_MEDIUM:
        return "medium"
    return "low"


def score_event(features: dict, model: Optional[CalibratedModel] = None) -> dict:
    """Full blended scoring for one feature vector."""
    r_score, fired = rule_score(features)
    m_score = ml_score(features, model=model)
    final = RULE_WEIGHT * r_score + ML_WEIGHT * m_score
    final = float(max(0.0, min(100.0, final)))
    return {
        "rule_score": round(r_score, 2),
        "ml_score": round(m_score, 2),
        "risk_score": round(final, 2),
        "band": band_for(final),
        "rules_fired": fired,
    }
