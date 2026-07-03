"""Seed the demo admin, a set of simulated actor employees, and a baseline of
normal activity so the Isolation Forest has something to learn from on first run.

Idempotent: safe to re-run.
"""
from __future__ import annotations

import random
from datetime import datetime, timedelta

from .auth import hash_password
from .config import settings
from .db import SessionLocal, init_db
from .features import apply_user_zscores, compute_activity_stats, compute_features
from .models import Event, User

ACTORS = [
    # username,           role,                  geo,             lat,      lon,      home_ip,     device
    ("dbadmin_priya",     "database_admin",      "Pune, IN",      18.5204,  73.8567,  "10.0.1.5",  "dev-priya-01"),
    ("teller_marcus",     "teller",              "Mumbai, IN",    19.0760,  72.8777,  "10.0.2.9",  "dev-marcus-01"),
    ("analyst_sofia",     "risk_analyst",        "Pune, IN",      18.5204,  73.8567,  "10.0.1.22", "dev-sofia-01"),
    ("sysops_ken",        "sysadmin",            "Bengaluru, IN", 12.9716,  77.5946,  "10.0.3.7",  "dev-ken-01"),
    ("support_amina",     "customer_support",    "Hyderabad, IN", 17.3850,  78.4867,  "10.0.4.3",  "dev-amina-01"),
]

NORMAL_ACTIONS = ["login", "record_view", "db_query", "logout"]


def seed_admin(db):
    admin = db.query(User).filter(User.username == settings.ADMIN_USERNAME).first()
    from .auth import generate_totp_secret
    if admin is None:
        mfa_sec = "JBSWY3DPEHPK3PXP"  # Standard test secret 'JBSWY3DPEHPK3PXP' for easier testing/verification
        admin = User(
            username=settings.ADMIN_USERNAME,
            email=settings.ADMIN_EMAIL,
            hashed_password=hash_password(settings.ADMIN_PASSWORD),
            role="admin",
            is_simulated=False,
            mfa_enabled=True,
            mfa_secret=mfa_sec,
        )
        db.add(admin)
        db.commit()
        print(f"[seed] created admin '{settings.ADMIN_USERNAME}' (password from .env) with MFA enabled")
        print(f"[seed] admin MFA secret key (use for Google Authenticator): {mfa_sec}")
    else:
        if not admin.mfa_secret:
            admin.mfa_secret = "JBSWY3DPEHPK3PXP"
            admin.mfa_enabled = True
            db.commit()
            print(f"[seed] updated admin '{settings.ADMIN_USERNAME}' to enable MFA")
        print(f"[seed] admin '{settings.ADMIN_USERNAME}' already exists. MFA secret: {admin.mfa_secret}")
    return admin


def seed_actors(db):
    created = []
    for username, role, geo, lat, lon, ip, dev in ACTORS:
        u = db.query(User).filter(User.username == username).first()
        if u is None:
            u = User(
                username=username,
                email=f"{username}@bank.local",
                hashed_password="!disabled",
                role=role,
                baseline_geo=geo,
                baseline_lat=lat,
                baseline_lon=lon,
                home_ip=ip,
                known_devices=[dev],
                is_simulated=True,
            )
            db.add(u)
            created.append(username)
    db.commit()
    print(f"[seed] actor employees ready ({len(created)} new, {len(ACTORS)} total)")
    return db.query(User).filter(User.is_simulated == True).all()  # noqa: E712


def seed_baseline_activity(db, per_user: int = 40):
    """Generate normal historical events per actor (marked is_baseline). Used both
    as realistic history and as training data for the model."""
    existing = db.query(Event).filter(Event.is_baseline == True).count()  # noqa: E712
    if existing > 0:
        print(f"[seed] baseline activity already present ({existing} events)")
        return
    actors = db.query(User).filter(User.is_simulated == True).all()  # noqa: E712
    total = 0
    for user in actors:
        recent: list[dict] = []
        pending: list[tuple[dict, dict]] = []  # (event_kwargs, features)
        for i in range(per_user):
            hour = random.choice(range(9, 18))
            ts = datetime.utcnow() - timedelta(days=random.randint(0, 14),
                                               hours=random.randint(0, 3))
            ts = ts.replace(hour=hour, minute=random.randint(0, 59))
            raw = {
                "username": user.username,
                "role": user.role,
                "action_type": random.choice(NORMAL_ACTIONS),
                "resource": random.choice(
                    ["dashboard/home", "report/daily", f"account/{random.randint(1000,9999)}",
                     "ticket/queue"]
                ),
                "record_count": random.randint(0, 5),
                "bytes_transferred": random.randint(0, 300_000),
                "source_ip": user.home_ip,
                "geo": user.baseline_geo,
                "device_id": (user.known_devices or ["dev"])[0],
                "matched_case_id": f"CASE-{random.randint(1000,9999)}" if random.random() < 0.8 else None,
                "command_text": None,
                "timestamp": ts,
            }
            baseline = {
                "baseline_lat": user.baseline_lat,
                "baseline_lon": user.baseline_lon,
                "home_ip": user.home_ip,
                "known_devices": user.known_devices or [],
            }
            # pass 1: z-scores are 0 here (no stats yet); patched below.
            feats = compute_features(raw, recent, baseline)
            recent.append({
                "action_type": raw["action_type"], "resource": raw["resource"],
                "record_count": raw["record_count"], "bytes_transferred": raw["bytes_transferred"],
                "matched_case_id": raw["matched_case_id"], "timestamp": ts,
            })
            pending.append(({
                "user_id": user.id, "username": user.username, "role": user.role,
                "session_id": f"{user.username}-baseline", "timestamp": ts,
                "action_type": raw["action_type"], "resource": raw["resource"],
                "record_count": raw["record_count"], "bytes_transferred": raw["bytes_transferred"],
                "source_ip": raw["source_ip"], "geo": raw["geo"], "device_id": raw["device_id"],
                "matched_case_id": raw["matched_case_id"], "command_text": None,
            }, feats))

        # derive this user's baseline stats, then backfill z-scores so the training
        # data has realistic z variance (~N(0,1)) rather than all-zero columns.
        stats = compute_activity_stats([f for _, f in pending])
        user.activity_stats = stats
        for kwargs, feats in pending:
            apply_user_zscores(feats, stats)
            db.add(Event(**kwargs, features=feats, rule_score=0.0, ml_score=0.0,
                         risk_score=0.0, band="low", is_baseline=True))
            total += 1
        db.commit()
    print(f"[seed] generated {total} baseline normal events + per-user activity_stats")


def run_seed():
    init_db()
    db = SessionLocal()
    try:
        seed_admin(db)
        seed_actors(db)
        seed_baseline_activity(db)
    finally:
        db.close()
    print("[seed] done.")


if __name__ == "__main__":
    run_seed()
