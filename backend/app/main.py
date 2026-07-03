"""FastAPI app: auth, simulator control, ingestion, events, alerts, sessions, chain."""
from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

from . import schemas
from .auth import (
    authenticate_user,
    create_access_token,
    get_current_user,
    hash_password,
    require_admin,
)
from .chain import get_chain
from .db import get_db, init_db
from .ingest import SessionBlockedError, ingest_event, set_session_status
from .models import Alert, Event, SessionState, User
from .simulator import simulator


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    # ensure the demo admin exists so login always works
    from .db import SessionLocal
    from .seed import seed_admin
    db = SessionLocal()
    try:
        seed_admin(db)
    finally:
        db.close()
    yield
    simulator.stop()


app = FastAPI(title="Insider Threat Detection & Response POC", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # POC only
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------- health ----------------
@app.get("/health")
def health():
    chain = get_chain()
    from . import risk_engine
    return {
        "status": "ok",
        "model_loaded": risk_engine.load_model() is not None,
        "chain_status": chain.status,
        "simulator_running": simulator.running,
    }


# ---------------- auth ----------------
@app.post("/auth/register", response_model=schemas.UserOut)
def register(req: schemas.RegisterRequest, db: Session = Depends(get_db)):
    if db.query(User).filter(User.username == req.username).first():
        raise HTTPException(status_code=400, detail="Username already exists")
    user = User(
        username=req.username,
        email=req.email,
        hashed_password=hash_password(req.password),
        role=req.role,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@app.post("/auth/login", response_model=schemas.TokenResponse)
def login(req: schemas.LoginRequest, db: Session = Depends(get_db)):
    user = authenticate_user(db, req.username, req.password)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    token = create_access_token(user.username, user.role)
    return schemas.TokenResponse(access_token=token, role=user.role, username=user.username)


@app.get("/me", response_model=schemas.UserOut)
def me(user: User = Depends(get_current_user)):
    return user


# ---------------- simulator ----------------
@app.post("/simulator/control")
def simulator_control(req: schemas.SimulatorControl, _: User = Depends(require_admin)):
    if req.action == "start":
        return simulator.start(req.rate_seconds, req.threat_probability)
    if req.action == "stop":
        return simulator.stop()
    raise HTTPException(status_code=400, detail="action must be 'start' or 'stop'")


@app.get("/simulator/status")
def simulator_status(_: User = Depends(get_current_user)):
    return simulator.status()


# ---------------- ingestion ----------------
@app.post("/ingest", response_model=schemas.ScoredEvent)
def ingest(raw: schemas.RawEvent, _: User = Depends(require_admin), db: Session = Depends(get_db)):
    try:
        event = ingest_event(db, raw.model_dump())
    except SessionBlockedError as e:
        raise HTTPException(status_code=423, detail=str(e))  # 423 Locked
    return event


# ---------------- events ----------------
@app.get("/events", response_model=list[schemas.ScoredEvent])
def list_events(
    limit: int = Query(50, le=500),
    band: str | None = None,
    _: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    q = db.query(Event).filter(Event.is_baseline == False)  # noqa: E712
    if band:
        q = q.filter(Event.band == band)
    return q.order_by(Event.id.desc()).limit(limit).all()


@app.get("/events/{event_id}", response_model=schemas.ScoredEvent)
def get_event(event_id: int, _: User = Depends(get_current_user), db: Session = Depends(get_db)):
    event = db.get(Event, event_id)
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    return event


# ---------------- alerts ----------------
@app.get("/alerts", response_model=list[schemas.AlertOut])
def list_alerts(
    status: str | None = "open",
    limit: int = Query(100, le=500),
    _: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    q = db.query(Alert)
    if status:
        q = q.filter(Alert.status == status)
    return q.order_by(Alert.id.desc()).limit(limit).all()


@app.post("/alerts/{alert_id}/acknowledge", response_model=schemas.AlertOut)
def acknowledge_alert(alert_id: int, _: User = Depends(require_admin), db: Session = Depends(get_db)):
    alert = db.get(Alert, alert_id)
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")
    alert.status = "acknowledged"
    db.commit()
    db.refresh(alert)
    return alert


# ---------------- sessions ----------------
@app.get("/sessions", response_model=list[schemas.SessionOut])
def list_sessions(_: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return db.query(SessionState).order_by(SessionState.updated_at.desc()).all()


@app.post("/sessions/action", response_model=schemas.SessionOut)
def session_action(
    req: schemas.SessionActionRequest, _: User = Depends(require_admin), db: Session = Depends(get_db)
):
    try:
        return set_session_status(db, req.session_id, req.action, req.reason)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


# ---------------- chain ----------------
@app.get("/chain/status")
def chain_status(_: User = Depends(get_current_user)):
    chain = get_chain()
    return {
        "status": chain.status,
        "enabled": chain.enabled,
        "contract_address": chain.address,
        "rpc_url": chain.w3.provider.endpoint_uri if chain.w3 else None,
        "total_records": chain.total_records(),
    }


# ---------------- dashboard stats ----------------
@app.get("/stats")
def stats(_: User = Depends(get_current_user), db: Session = Depends(get_db)):
    base = db.query(Event).filter(Event.is_baseline == False)  # noqa: E712
    total = base.count()
    high = base.filter(Event.band == "high").count()
    medium = base.filter(Event.band == "medium").count()
    low = base.filter(Event.band == "low").count()
    anchored = base.filter(Event.anchored == True).count()  # noqa: E712
    open_alerts = db.query(Alert).filter(Alert.status == "open").count()
    blocked = db.query(SessionState).filter(SessionState.status == "blocked").count()

    causes = {}
    for c, in db.query(Event.cause).filter(Event.cause.isnot(None), Event.is_baseline == False):  # noqa: E712
        causes[c] = causes.get(c, 0) + 1

    return {
        "total_events": total,
        "high": high,
        "medium": medium,
        "low": low,
        "anchored": anchored,
        "open_alerts": open_alerts,
        "blocked_sessions": blocked,
        "causes": causes,
    }
