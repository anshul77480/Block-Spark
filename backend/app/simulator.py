"""Real-time activity simulator.

Runs in a background thread, generating realistic banking-admin activity and
pushing each event through ingest_event(). A configurable fraction of events are
threat scenarios (malicious / negligent / compromised) so the demo produces
alerts, cause classifications and session blocks live.
"""
from __future__ import annotations

import random
import threading
import time
from datetime import datetime

from .db import SessionLocal
from .ingest import SessionBlockedError, ingest_event
from .models import User

NORMAL_ACTIONS = ["login", "record_view", "db_query", "logout"]
BUSINESS_HOURS = list(range(9, 18))


def _now_at_hour(hour: int) -> datetime:
    n = datetime.utcnow()
    return n.replace(hour=hour % 24, minute=random.randint(0, 59), second=random.randint(0, 59))


class Simulator:
    def __init__(self):
        self._thread: threading.Thread | None = None
        self._stop = threading.Event()
        self.running = False
        self.rate_seconds = 2.0
        self.threat_probability = 0.35
        self.generated = 0
        self.last_event: dict | None = None
        self._lock = threading.Lock()

    # ---- scenario generators ----
    def _actor_pool(self, db) -> list[User]:
        return db.query(User).filter(User.is_simulated == True).all()  # noqa: E712

    def _normal_event(self, user: User) -> dict:
        action = random.choice(NORMAL_ACTIONS)
        resource = random.choice(
            ["dashboard/home", "report/daily", f"account/{random.randint(1000, 9999)}",
             "ticket/queue", "profile/self"]
        )
        return {
            "username": user.username,
            "role": user.role,
            "action_type": action,
            "resource": resource,
            "record_count": random.randint(0, 5),
            "bytes_transferred": random.randint(0, 200_000),
            "source_ip": user.home_ip,
            "geo": user.baseline_geo,
            "device_id": (user.known_devices or ["dev-unknown"])[0],
            "matched_case_id": f"CASE-{random.randint(1000, 9999)}" if random.random() < 0.7 else None,
            "command_text": None,
            "timestamp": _now_at_hour(random.choice(BUSINESS_HOURS)),
        }

    def _malicious_exfil(self, user: User) -> dict:
        # off-hours bulk export of sensitive data, no ticket
        return {
            "username": user.username,
            "role": user.role,
            "action_type": "data_export",
            "resource": f"core/customer_pii/account/{random.randint(100000, 100050)}",
            "record_count": random.randint(600, 4000),
            "bytes_transferred": random.randint(80_000_000, 500_000_000),
            "source_ip": user.home_ip,
            "geo": user.baseline_geo,
            "device_id": (user.known_devices or ["dev-unknown"])[0],
            "matched_case_id": None,
            "command_text": None,
            "timestamp": _now_at_hour(random.choice([1, 2, 3, 22, 23])),
        }

    def _malicious_destruction(self, user: User) -> dict:
        cmd = random.choice(
            ["rm -rf /var/log/audit/*", "shred -u /data/ledger.db",
             "history -c && unset HISTFILE", "chattr -R -a /var/log", "dd if=/dev/zero of=/data/core.db"]
        )
        return {
            "username": user.username,
            "role": user.role,
            "action_type": "command_exec",
            "resource": "core/ledger",
            "record_count": 0,
            "bytes_transferred": 0,
            "source_ip": user.home_ip,
            "geo": user.baseline_geo,
            "device_id": (user.known_devices or ["dev-unknown"])[0],
            "matched_case_id": None,
            "command_text": cmd,
            "timestamp": _now_at_hour(random.choice([0, 1, 2, 23])),
        }

    def _compromised(self, user: User) -> dict:
        # normal-looking action but new device + new IP + geo jump + odd hour
        return {
            "username": user.username,
            "role": user.role,
            "action_type": random.choice(["login", "record_view", "db_query"]),
            "resource": f"account/{random.randint(1000, 9999)}",
            "record_count": random.randint(0, 3),
            "bytes_transferred": random.randint(0, 50_000),
            "source_ip": f"185.{random.randint(1,254)}.{random.randint(1,254)}.{random.randint(1,254)}",
            "geo": random.choice(["Moscow, RU", "Beijing, CN", "Lagos, NG", "Kyiv, UA"]),
            "device_id": f"dev-unknown-{random.randint(1000,9999)}",
            "matched_case_id": None,
            "command_text": None,
            "timestamp": _now_at_hour(random.choice([2, 3, 4, 23])),
        }

    def _negligent(self, user: User) -> dict:
        # policy violation during business hours: sensitive access, no ticket, no evasion
        return {
            "username": user.username,
            "role": user.role,
            "action_type": "db_query",
            "resource": f"core/customer_pii/account/{random.randint(1000, 9999)}",
            "record_count": random.randint(10, 120),
            "bytes_transferred": random.randint(100_000, 2_000_000),
            "source_ip": user.home_ip,
            "geo": user.baseline_geo,
            "device_id": (user.known_devices or ["dev-unknown"])[0],
            "matched_case_id": None,
            "command_text": None,
            "timestamp": _now_at_hour(random.choice(BUSINESS_HOURS)),
        }

    def _generate_one(self, db) -> dict | None:
        actors = self._actor_pool(db)
        if not actors:
            return None
        user = random.choice(actors)
        if random.random() < self.threat_probability:
            scenario = random.choice(
                [self._malicious_exfil, self._malicious_destruction, self._compromised, self._negligent]
            )
            raw = scenario(user)
        else:
            raw = self._normal_event(user)
        return raw

    # ---- thread loop ----
    def _run(self):
        while not self._stop.is_set():
            db = SessionLocal()
            try:
                raw = self._generate_one(db)
                if raw is not None:
                    try:
                        event = ingest_event(db, raw)
                        with self._lock:
                            self.generated += 1
                            self.last_event = {
                                "id": event.id,
                                "username": event.username,
                                "action_type": event.action_type,
                                "risk_score": event.risk_score,
                                "band": event.band,
                                "cause": event.cause,
                            }
                    except SessionBlockedError:
                        # session already blocked — skip; admin must unblock
                        pass
            except Exception as e:  # noqa: BLE001 keep the loop alive for the demo
                print(f"[simulator] error: {e}")
            finally:
                db.close()
            self._stop.wait(self.rate_seconds)

    def start(self, rate_seconds: float = 2.0, threat_probability: float = 0.35):
        if self.running:
            return {"running": True, "message": "already running"}
        self.rate_seconds = max(0.2, float(rate_seconds))
        self.threat_probability = min(1.0, max(0.0, float(threat_probability)))
        self._stop.clear()
        self._thread = threading.Thread(target=self._run, daemon=True)
        self._thread.start()
        self.running = True
        return {"running": True, "rate_seconds": self.rate_seconds,
                "threat_probability": self.threat_probability}

    def stop(self):
        self._stop.set()
        if self._thread:
            self._thread.join(timeout=5)
        self.running = False
        return {"running": False, "generated": self.generated}

    def status(self) -> dict:
        with self._lock:
            return {
                "running": self.running,
                "rate_seconds": self.rate_seconds,
                "threat_probability": self.threat_probability,
                "generated": self.generated,
                "last_event": self.last_event,
            }

    def trigger_scenario(self, db, scenario: str):
        actors = self._actor_pool(db)
        if not actors:
            raise ValueError("No simulated actors seeded in DB")
        
        scenario_map = {
            "exfil": self._malicious_exfil,
            "destruction": self._malicious_destruction,
            "compromised": self._compromised,
            "negligent": self._negligent,
        }
        
        if scenario not in scenario_map:
            raise ValueError(f"Unknown scenario: {scenario}")
            
        generator = scenario_map[scenario]
        
        target_username_map = {
            "exfil": "dbadmin_priya",
            "destruction": "sysops_ken",
            "compromised": "analyst_sofia",
            "negligent": "support_amina",
        }
        
        target_user = None
        target_name = target_username_map.get(scenario)
        if target_name:
            target_user = db.query(User).filter(User.username == target_name).first()
            
        if not target_user:
            target_user = random.choice(actors)
            
        raw = generator(target_user)
        event = ingest_event(db, raw)
        
        with self._lock:
            self.generated += 1
            self.last_event = {
                "id": event.id,
                "username": event.username,
                "action_type": event.action_type,
                "risk_score": event.risk_score,
                "band": event.band,
                "cause": event.cause,
            }
        return event


simulator = Simulator()
