"""Import + end-to-end sanity smoke test for the backend stack.

Proves the (version-sensitive) ML stack imports and works together, seeds a tiny
dataset, trains the model, and scores one normal + one malicious event WITHOUT
needing the blockchain or the LLM. Run:  python smoke_test.py
"""
from __future__ import annotations

import sys


def check_imports():
    import fastapi          # noqa: F401
    import uvicorn          # noqa: F401
    import numpy            # noqa: F401
    import pandas           # noqa: F401
    import scipy            # noqa: F401
    import sklearn          # noqa: F401
    import shap             # noqa: F401
    import joblib           # noqa: F401
    import sqlalchemy       # noqa: F401
    import jwt              # noqa: F401
    import passlib          # noqa: F401
    import web3             # noqa: F401
    import httpx            # noqa: F401
    print(f"[smoke] imports OK "
          f"(numpy={numpy.__version__}, sklearn={sklearn.__version__}, shap={shap.__version__})")


def check_pipeline():
    import os
    # use a throwaway sqlite DB and disable chain for the smoke test
    os.environ.setdefault("DATABASE_URL", "sqlite:///./smoke_test.db")
    os.environ["CHAIN_ENABLED"] = "false"

    from app.db import SessionLocal, init_db
    from app.seed import seed_admin, seed_actors, seed_baseline_activity
    from train_model import train_and_save
    from app import risk_engine
    from app.ingest import ingest_event

    init_db()
    db = SessionLocal()
    try:
        seed_admin(db)
        seed_actors(db)
        seed_baseline_activity(db, per_user=15)
    finally:
        db.close()

    model = train_and_save()
    risk_engine.set_model(model)

    db = SessionLocal()
    try:
        normal = ingest_event(db, {
            "username": "dbadmin_priya", "role": "database_admin",
            "action_type": "record_view", "resource": "dashboard/home",
            "record_count": 2, "bytes_transferred": 1000,
            "source_ip": "10.0.1.5", "geo": "New York, US",
            "device_id": "dev-priya-01", "matched_case_id": "CASE-1234",
        })
        malicious = ingest_event(db, {
            "username": "dbadmin_priya", "role": "database_admin",
            "action_type": "data_export",
            "resource": "core/customer_pii/account/100001",
            "record_count": 3000, "bytes_transferred": 400_000_000,
            "source_ip": "10.0.1.5", "geo": "New York, US",
            "device_id": "dev-priya-01", "matched_case_id": None,
            "command_text": "shred -u /data/ledger.db",
        })
        # capture values while the session is still open
        n = (normal.risk_score, normal.band)
        m = (malicious.risk_score, malicious.band, malicious.cause,
             [r["rule"] for r in (malicious.rules_fired or [])], malicious.explanation)
    finally:
        db.close()

    print(f"[smoke] normal    -> score={n[0]} band={n[1]}")
    print(f"[smoke] malicious -> score={m[0]} band={m[1]} cause={m[2]}")
    print(f"[smoke] rules_fired: {m[3]}")
    print(f"[smoke] explanation: {m[4]}")

    assert n[1] == "low", f"expected normal->low, got {n[1]}"
    assert m[1] == "high", f"expected malicious->high, got {m[1]}"
    assert m[2], "expected a cause classification for the malicious event"
    print("[smoke] PIPELINE OK")


if __name__ == "__main__":
    try:
        check_imports()
        check_pipeline()
    except AssertionError as e:
        print(f"[smoke] ASSERTION FAILED: {e}")
        sys.exit(1)
    except Exception as e:  # noqa: BLE001
        print(f"[smoke] ERROR: {e}")
        raise
    print("[smoke] ALL GOOD ✅")
