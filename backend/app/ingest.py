"""Ingestion + orchestration: feature build -> score -> cause -> explain -> anchor
-> risk-based response. This is the glue that produces one fully-scored Event.
"""
from __future__ import annotations

from datetime import datetime, timedelta
from typing import Optional

from sqlalchemy.orm import Session

from . import cause as cause_mod
from . import explain as explain_mod
from . import risk_engine
from .chain import get_chain
from .features import WINDOW_MINUTES, compute_features
from .models import Alert, Event, SessionState, User


class SessionBlockedError(Exception):
    """Raised when an action is attempted on a blocked session."""


def _get_or_create_user(db: Session, raw: dict) -> User:
    user = None
    if raw.get("user_id"):
        user = db.get(User, raw["user_id"])
    if user is None:
        user = db.query(User).filter(User.username == raw["username"]).first()
    if user is None:
        user = User(
            username=raw["username"],
            role=raw.get("role") or "employee",
            hashed_password="!disabled",  # actor account, cannot log in
            is_simulated=True,
            known_devices=[],
        )
        db.add(user)
        db.flush()
    return user


def _get_or_create_session(db: Session, session_id: str, user: User) -> SessionState:
    sess = db.query(SessionState).filter(SessionState.session_id == session_id).first()
    if sess is None:
        sess = SessionState(
            session_id=session_id, user_id=user.id, username=user.username, status="active"
        )
        db.add(sess)
        db.flush()
    return sess


def _recent_events(db: Session, username: str, ts: datetime) -> list[dict]:
    window_start = ts - timedelta(minutes=WINDOW_MINUTES)
    rows = (
        db.query(Event)
        .filter(Event.username == username, Event.timestamp >= window_start, Event.timestamp <= ts)
        .order_by(Event.timestamp.asc())
        .all()
    )
    return [
        {
            "action_type": r.action_type,
            "resource": r.resource,
            "record_count": r.record_count,
            "bytes_transferred": r.bytes_transferred,
            "matched_case_id": r.matched_case_id,
            "timestamp": r.timestamp,
        }
        for r in rows
    ]


def ingest_event(db: Session, raw: dict, enforce_block: bool = True) -> Event:
    """Score and persist a single raw event. Returns the stored Event."""
    ts = raw.get("timestamp") or datetime.utcnow()
    if isinstance(ts, str):
        ts = datetime.fromisoformat(ts)

    user = _get_or_create_user(db, raw)
    session_id = raw.get("session_id") or f"{user.username}-session"
    sess = _get_or_create_session(db, session_id, user)

    if enforce_block and sess.status == "blocked":
        raise SessionBlockedError(f"Session {session_id} is blocked; action refused")

    # --- features ---
    recent = _recent_events(db, user.username, ts)
    baseline = {
        "baseline_lat": user.baseline_lat,
        "baseline_lon": user.baseline_lon,
        "home_ip": user.home_ip,
        "known_devices": user.known_devices or [],
        "activity_stats": user.activity_stats or {},
    }
    raw_for_features = {**raw, "timestamp": ts}
    features = compute_features(raw_for_features, recent, baseline)

    # --- score ---
    model = risk_engine.load_model()
    scoring = risk_engine.score_event(features, model=model)

    band = scoring["band"]
    event_dict = {**raw, "role": raw.get("role") or user.role, "username": user.username,
                  "features": features, "timestamp": ts}

    # --- cause + explanation for medium/high ---
    cause = None
    explanation = {}
    if band in ("medium", "high"):
        top_features_pre = explain_mod.top_feature_attributions(features, model, k=3)
        cause = cause_mod.classify_cause(features, top_features_pre, scoring["rules_fired"])
        explanation = explain_mod.explain(event_dict, scoring, cause, model)

    # --- build & persist event ---
    event = Event(
        user_id=user.id,
        username=user.username,
        role=event_dict["role"],
        session_id=session_id,
        timestamp=ts,
        action_type=raw.get("action_type"),
        resource=raw.get("resource"),
        record_count=int(raw.get("record_count") or 0),
        bytes_transferred=int(raw.get("bytes_transferred") or 0),
        source_ip=raw.get("source_ip"),
        geo=raw.get("geo"),
        device_id=raw.get("device_id"),
        matched_case_id=raw.get("matched_case_id"),
        command_text=raw.get("command_text"),
        features=features,
        rule_score=scoring["rule_score"],
        ml_score=scoring["ml_score"],
        risk_score=scoring["risk_score"],
        band=band,
        cause=cause,
        rules_fired=scoring["rules_fired"],
        top_features=explanation.get("top_features", []),
        explanation=explanation.get("explanation"),
        recommended_action=explanation.get("recommended_action"),
    )
    db.add(event)
    db.flush()

    # --- blockchain anchoring (every event) ---
    chain = get_chain()
    anchor_payload = {
        "event_id": event.id,
        "username": event.username,
        "action_type": event.action_type,
        "resource": event.resource,
        "record_count": event.record_count,
        "bytes_transferred": event.bytes_transferred,
        "timestamp": ts.isoformat(),
        "risk_score": event.risk_score,
        "band": band,
        "cause": cause,
    }
    anchor = chain.anchor(anchor_payload, metadata=f"{event.username}:{band}:{event.risk_score}")
    event.event_hash = anchor["event_hash"]
    event.anchor_tx = anchor["anchor_tx"]
    event.anchored = anchor["anchored"]

    # --- QPC (Quantum-Proof Cryptography) Signing ---
    try:
        from .qpc import get_system_qpc_keypair, mldsa_sign, mldsa_verify
        import json

        qpc_sk, qpc_pk = get_system_qpc_keypair()
        hash_bytes = bytes.fromhex(event.event_hash)
        qpc_sig = mldsa_sign(hash_bytes, qpc_sk)
        
        event.qpc_signature = json.dumps(qpc_sig)
        event.qpc_pubkey = json.dumps(qpc_pk)
        event.qpc_verified = mldsa_verify(hash_bytes, qpc_sig, qpc_pk)
    except Exception as e:
        # Fallback or logging if signing fails (should not fail under normal conditions)
        event.qpc_verified = False

    # --- risk-based response ---
    if band == "medium":
        _raise_alert(db, event, sess)
        if sess.status == "active":
            sess.status = "flagged"
            sess.reason = f"Medium-risk activity (score {event.risk_score})"
            sess.updated_at = datetime.utcnow()
    elif band == "high":
        _raise_alert(db, event, sess)
        sess.status = "blocked"
        sess.reason = f"{cause or 'High-risk'} — score {event.risk_score}. Session blocked."
        sess.requires_reauth = True
        sess.updated_at = datetime.utcnow()

    db.commit()
    db.refresh(event)
    return event


def _raise_alert(db: Session, event: Event, sess: SessionState):
    msg = (
        f"{event.username} ({event.role}): {event.band.upper()}-risk {event.action_type} "
        f"on {event.resource or 'resource'} — score {event.risk_score}."
    )
    alert = Alert(
        event_id=event.id,
        user_id=event.user_id,
        username=event.username,
        session_id=sess.session_id,
        band=event.band,
        cause=event.cause,
        risk_score=event.risk_score,
        message=msg,
        recommended_action=event.recommended_action,
        qpc_signature=event.qpc_signature,
        qpc_pubkey=event.qpc_pubkey,
        qpc_verified=event.qpc_verified,
        status="open",
    )
    db.add(alert)


def set_session_status(db: Session, session_id: str, action: str, reason: Optional[str] = None) -> SessionState:
    sess = db.query(SessionState).filter(SessionState.session_id == session_id).first()
    if sess is None:
        raise ValueError(f"Unknown session {session_id}")
    if action == "block":
        sess.status = "blocked"
        sess.requires_reauth = True
        sess.reason = reason or "Manually blocked by admin"
    elif action == "unblock":
        sess.status = "active"
        sess.requires_reauth = False
        sess.reason = reason or "Manually unblocked by admin"
    else:
        raise ValueError(f"Unknown action {action}")
    sess.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(sess)
    return sess
