"""Evaluation harness for the risk engine.

Builds a labelled test set by injecting known NORMAL and THREAT events (reusing the
simulator's scenario generators), scores each through the real feature + scoring
pipeline, and reports detection quality:

  - Precision / recall / F1 for the "alert" decision   (band >= medium, score >= 40)
  - Precision / recall / F1 for the "block" decision    (band == high,   score >= 70)
  - ROC-AUC over the continuous risk score
  - Confusion matrix and per-scenario band breakdown

This lets tuning decisions (weights, ML_ANCHOR, features) be measured, not guessed.

Run:  python evaluate.py [--normal 150] [--threats 150] [--seed 7]
"""
from __future__ import annotations

import argparse
from collections import Counter, defaultdict

import numpy as np
from sklearn.metrics import (
    confusion_matrix,
    precision_recall_fscore_support,
    roc_auc_score,
)

from app import risk_engine
from app.db import SessionLocal, init_db
from app.features import compute_features
from app.models import Event, User
from app.simulator import Simulator

THREAT_SCENARIOS = ["malicious_exfil", "malicious_destruction", "compromised", "negligent"]


def _baseline_for(user: User) -> dict:
    return {
        "baseline_lat": user.baseline_lat,
        "baseline_lon": user.baseline_lon,
        "home_ip": user.home_ip,
        "known_devices": user.known_devices or [],
        "activity_stats": user.activity_stats or {},
    }


def _score_raw(raw: dict, user: User, model) -> dict:
    # point evaluation: no rolling window context (recent=[])
    feats = compute_features({**raw}, [], _baseline_for(user))
    return risk_engine.score_event(feats, model=model)


def build_dataset(n_normal: int, n_threat: int, rng: np.random.Generator):
    db = SessionLocal()
    try:
        users = db.query(User).filter(User.is_simulated == True).all()  # noqa: E712
        if not users:
            raise SystemExit("No simulated users — run `python -m app.seed` first.")
        sim = Simulator()
        samples = []  # (raw, user, label, scenario)
        for _ in range(n_normal):
            u = users[int(rng.integers(0, len(users)))]
            samples.append((sim._normal_event(u), u, 0, "normal"))
        for _ in range(n_threat):
            u = users[int(rng.integers(0, len(users)))]
            scenario = THREAT_SCENARIOS[int(rng.integers(0, len(THREAT_SCENARIOS)))]
            raw = getattr(sim, f"_{scenario}")(u)
            samples.append((raw, u, 1, scenario))
        return samples
    finally:
        db.close()


def evaluate(n_normal: int, n_threat: int, seed: int):
    init_db()
    model = risk_engine.load_model()
    if model is None:
        raise SystemExit("No trained model — run `python train_model.py` first.")

    rng = np.random.default_rng(seed)
    samples = build_dataset(n_normal, n_threat, rng)

    y_true, scores = [], []
    pred_alert, pred_block = [], []
    per_scenario = defaultdict(Counter)

    for raw, user, label, scenario in samples:
        s = _score_raw(raw, user, model)
        y_true.append(label)
        scores.append(s["risk_score"])
        pred_alert.append(1 if s["band"] in ("medium", "high") else 0)
        pred_block.append(1 if s["band"] == "high" else 0)
        per_scenario[scenario][s["band"]] += 1

    y_true = np.array(y_true)
    scores = np.array(scores)

    def report(name, y_pred, positive_label_desc):
        p, r, f1, _ = precision_recall_fscore_support(
            y_true, y_pred, average="binary", zero_division=0
        )
        cm = confusion_matrix(y_true, y_pred, labels=[0, 1])
        tn, fp, fn, tp = cm.ravel()
        print(f"\n== {name}  ({positive_label_desc}) ==")
        print(f"  precision={p:.3f}  recall={r:.3f}  f1={f1:.3f}")
        print(f"  confusion: TP={tp} FP={fp} FN={fn} TN={tn}")

    print(f"[evaluate] {n_normal} normal + {n_threat} threat samples "
          f"({len(risk_engine.FEATURE_ORDER)} features, scaled={model.scaler is not None})")

    report("Alert decision", pred_alert, "threat detected as medium+ risk")
    report("Block decision", pred_block, "threat detected as high risk")

    try:
        auc = roc_auc_score(y_true, scores)
        print(f"\n== ROC-AUC over risk score == {auc:.3f}")
    except ValueError:
        print("\n== ROC-AUC == n/a (need both classes)")

    print("\n== Per-scenario band breakdown ==")
    for scenario in ["normal", *THREAT_SCENARIOS]:
        c = per_scenario.get(scenario, Counter())
        total = sum(c.values())
        if total:
            print(f"  {scenario:22} low={c['low']:3} medium={c['medium']:3} high={c['high']:3}")

    print("\n[evaluate] done.")


if __name__ == "__main__":
    ap = argparse.ArgumentParser(description="Evaluate the risk engine")
    ap.add_argument("--normal", type=int, default=150)
    ap.add_argument("--threats", type=int, default=150)
    ap.add_argument("--seed", type=int, default=7)
    args = ap.parse_args()
    evaluate(args.normal, args.threats, args.seed)
