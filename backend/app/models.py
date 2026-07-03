"""SQLAlchemy ORM models.

NOTE (README): SQLite is used here for zero-config demo storage. The production
target from the architecture diagram is MongoDB; the ORM boundary keeps that swap
localized.
"""
from datetime import datetime

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    JSON,
    String,
    Text,
)
from sqlalchemy.orm import relationship

from .db import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True)
    username = Column(String, unique=True, index=True, nullable=False)
    email = Column(String, unique=True, nullable=True)
    hashed_password = Column(String, nullable=False)
    role = Column(String, default="analyst", nullable=False)  # admin | analyst | employee

    # Multi-Factor Authentication (MFA)
    mfa_secret = Column(String, nullable=True)
    mfa_enabled = Column(Boolean, default=False, nullable=False)

    # Behavioural baseline (used by feature engineering)
    baseline_lat = Column(Float, default=18.5204)
    baseline_lon = Column(Float, default=73.8567)
    baseline_geo = Column(String, default="Pune, IN")
    home_ip = Column(String, default="10.0.0.1")
    known_devices = Column(JSON, default=list)      # list[str]
    # per-user baseline stats for z-score personalization:
    # {source_feature: {"mean": m, "std": s}} — populated by seed.py.
    activity_stats = Column(JSON, default=dict)
    is_simulated = Column(Boolean, default=False)   # true for actor accounts the simulator drives

    created_at = Column(DateTime, default=datetime.utcnow)


class Event(Base):
    __tablename__ = "events"

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), index=True)
    username = Column(String, index=True)
    role = Column(String)
    session_id = Column(String, index=True)

    timestamp = Column(DateTime, default=datetime.utcnow, index=True)

    # raw activity fields
    action_type = Column(String)
    resource = Column(String)
    record_count = Column(Integer, default=0)
    bytes_transferred = Column(Integer, default=0)
    source_ip = Column(String)
    geo = Column(String)
    device_id = Column(String)
    matched_case_id = Column(String, nullable=True)
    command_text = Column(String, nullable=True)

    # computed
    features = Column(JSON)             # dict[str, float]
    rule_score = Column(Float, default=0.0)
    ml_score = Column(Float, default=0.0)
    risk_score = Column(Float, default=0.0)
    band = Column(String, default="low")
    cause = Column(String, nullable=True)
    rules_fired = Column(JSON, default=list)     # list[dict]
    top_features = Column(JSON, default=list)    # list[dict]
    explanation = Column(Text, nullable=True)
    recommended_action = Column(Text, nullable=True)

    # QPC (Quantum-Proof Cryptography) signature to secure the event audit trail
    qpc_signature = Column(Text, nullable=True)  # JSON-serialized list of 256 hex signature elements
    qpc_pubkey = Column(Text, nullable=True)     # JSON-serialized public key pk_0/pk_1
    qpc_verified = Column(Boolean, default=False)

    # blockchain anchoring
    event_hash = Column(String, index=True)
    anchor_tx = Column(String, nullable=True)
    anchored = Column(Boolean, default=False)

    is_baseline = Column(Boolean, default=False)  # seed/baseline events not scored as threats

    @property
    def tampered(self) -> bool:
        if not self.anchored or not self.event_hash:
            return False
        try:
            from .chain import canonical_hash
            ts_str = self.timestamp.isoformat() if hasattr(self.timestamp, "isoformat") else str(self.timestamp)
            payload = {
                "event_id": self.id,
                "username": self.username,
                "action_type": self.action_type,
                "resource": self.resource,
                "record_count": self.record_count,
                "bytes_transferred": self.bytes_transferred,
                "timestamp": ts_str,
                "risk_score": self.risk_score,
                "band": self.band,
                "cause": self.cause,
            }
            return canonical_hash(payload) != self.event_hash
        except Exception:
            return False

    alerts = relationship("Alert", back_populates="event")


class Alert(Base):
    __tablename__ = "alerts"

    id = Column(Integer, primary_key=True)
    event_id = Column(Integer, ForeignKey("events.id"), index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    username = Column(String, index=True)
    session_id = Column(String, index=True)
    band = Column(String)
    cause = Column(String, nullable=True)
    risk_score = Column(Float)
    message = Column(Text)
    recommended_action = Column(Text, nullable=True)
    status = Column(String, default="open", index=True)  # open | acknowledged | closed
    created_at = Column(DateTime, default=datetime.utcnow, index=True)

    # QPC signature copies from Event for quick tamper verification
    qpc_signature = Column(Text, nullable=True)
    qpc_pubkey = Column(Text, nullable=True)
    qpc_verified = Column(Boolean, default=False)

    event = relationship("Event", back_populates="alerts")


class SessionState(Base):
    __tablename__ = "sessions"

    id = Column(Integer, primary_key=True)
    session_id = Column(String, unique=True, index=True, nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"))
    username = Column(String, index=True)
    status = Column(String, default="active", index=True)  # active | flagged | blocked
    reason = Column(Text, nullable=True)
    requires_reauth = Column(Boolean, default=False)
    updated_at = Column(DateTime, default=datetime.utcnow)
