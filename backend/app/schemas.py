"""Pydantic request/response schemas."""
from datetime import datetime
from typing import Any, Optional

from pydantic import BaseModel, ConfigDict


# ---- auth ----
class RegisterRequest(BaseModel):
    username: str
    password: str
    email: Optional[str] = None
    role: str = "analyst"


class LoginRequest(BaseModel):
    username: str
    password: str
    mfa_code: Optional[str] = None


class TokenResponse(BaseModel):
    access_token: Optional[str] = None
    token_type: str = "bearer"
    role: Optional[str] = None
    username: Optional[str] = None
    mfa_required: bool = False


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    username: str
    email: Optional[str] = None
    role: str
    mfa_enabled: bool = False


# ---- events / ingestion ----
class RawEvent(BaseModel):
    """A single raw activity event to ingest and score."""
    user_id: Optional[int] = None
    username: str
    role: Optional[str] = None
    session_id: Optional[str] = None
    timestamp: Optional[datetime] = None
    action_type: str
    resource: Optional[str] = None
    record_count: int = 0
    bytes_transferred: int = 0
    source_ip: Optional[str] = None
    geo: Optional[str] = None
    device_id: Optional[str] = None
    matched_case_id: Optional[str] = None
    command_text: Optional[str] = None


class RuleFired(BaseModel):
    rule: str
    points: float
    detail: str


class FeatureContribution(BaseModel):
    feature: str
    value: float
    contribution: float


class ScoredEvent(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    username: str
    role: Optional[str] = None
    session_id: Optional[str] = None
    timestamp: datetime
    action_type: str
    resource: Optional[str] = None
    record_count: int
    bytes_transferred: int
    source_ip: Optional[str] = None
    geo: Optional[str] = None
    device_id: Optional[str] = None
    matched_case_id: Optional[str] = None
    command_text: Optional[str] = None
    features: Optional[dict[str, Any]] = None
    rule_score: float
    ml_score: float
    risk_score: float
    band: str
    cause: Optional[str] = None
    rules_fired: Optional[list] = None
    top_features: Optional[list] = None
    explanation: Optional[str] = None
    recommended_action: Optional[str] = None
    
    # QPC Fields
    qpc_signature: Optional[str] = None
    qpc_pubkey: Optional[str] = None
    qpc_verified: bool = False

    event_hash: Optional[str] = None
    anchor_tx: Optional[str] = None
    anchored: bool = False
    tampered: Optional[bool] = False


class AlertOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    event_id: int
    username: str
    session_id: Optional[str] = None
    band: str
    cause: Optional[str] = None
    risk_score: float
    message: str
    recommended_action: Optional[str] = None
    
    # QPC Fields
    qpc_signature: Optional[str] = None
    qpc_pubkey: Optional[str] = None
    qpc_verified: bool = False

    status: str
    created_at: datetime


class SessionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    session_id: str
    username: Optional[str] = None
    status: str
    reason: Optional[str] = None
    requires_reauth: bool
    updated_at: datetime


class SessionActionRequest(BaseModel):
    session_id: str
    action: str  # "block" | "unblock"
    reason: Optional[str] = None


class SimulatorControl(BaseModel):
    action: str  # "start" | "stop"
    rate_seconds: float = 2.0
    threat_probability: float = 0.35
