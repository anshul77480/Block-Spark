# Architecture

## 1. System context

The POC simulates a banking SOC (Security Operations Centre) workflow: analysts
authenticate to a console, user activity is generated/ingested, each event is scored
for insider-threat risk, high-risk activity is classified and explained, every event
is hash-anchored to an immutable ledger, and risky sessions are contained.

```
        ┌──────────────┐        ┌───────────────────────────────┐        ┌──────────────┐
        │  SOC analyst │  HTTPS │      Backend (FastAPI)         │  web3  │  Blockchain  │
        │  (browser)   │◄──────►│  auth · simulator · scoring ·  │◄──────►│  Hardhat +   │
        │  Next.js UI  │  JSON  │  cause · explain · orchestrate │  RPC   │  AuditLog.sol│
        └──────────────┘        └───────────────┬───────────────┘        └──────────────┘
                                                 │ SQLAlchemy
                                                 ▼
                                        ┌──────────────────┐
                                        │  SQLite (POC)    │  events · alerts · sessions · users
                                        │  → MongoDB (prod)│
                                        └──────────────────┘
                                                 ▲
                                    optional     │
                                 CERT dataset ───┘  (data_adapter.py maps CSVs → events)
```

## 2. Components

Three deployable services (see [ADR-0001](adr/0001-monorepo-three-services.md)):

### Backend — `backend/` (Python 3.11, FastAPI)
Single service that owns auth, the activity simulator, feature engineering, the risk
engine, cause classification, explanations, the chain client, and orchestration.

| Module | Responsibility |
|--------|----------------|
| `app/main.py` | FastAPI app, routes, CORS, lifespan (init DB, ensure admin) |
| `app/auth.py` | bcrypt hashing, JWT issue/verify, `get_current_user`/`require_admin` |
| `app/models.py` | SQLAlchemy ORM: `User`, `Event`, `Alert`, `SessionState` |
| `app/schemas.py` | Pydantic request/response models |
| `app/features.py` | Raw event + rolling window → 17-dim feature vector |
| `app/risk_engine.py` | Rule layer + Isolation Forest + blend + banding |
| `app/cause.py` | Malicious / Negligent / Compromised classification |
| `app/explain.py` | SHAP attributions + LLM narrative (+ template fallback) |
| `app/chain.py` | SHA-256 canonical hashing + web3.py anchoring client |
| `app/ingest.py` | Orchestration: features→score→cause→explain→anchor→respond |
| `app/simulator.py` | Background-thread activity generator |
| `app/seed.py` | Demo admin + actor employees + baseline activity |
| `train_model.py` | Fits the scaler + Isolation Forest, calibrates, persists |
| `evaluate.py` | Detection metrics (precision/recall/F1/AUC) on injected threats |
| `data_adapter.py` | Maps Kaggle CERT CSVs onto the feature schema |

### Blockchain — `blockchain/` (Hardhat + Solidity 0.8.24)
A local Hardhat node hosting `AuditLog.sol`, which stores `{eventHash, timestamp,
recorder, metadata}` per event and emits `EventAnchored`. Deployed by
`scripts/deploy.js`, which writes the contract address to a file the backend reads.

### Frontend — `frontend/` (Next.js 14 app router, Tailwind, Recharts)
A dark-mode SOC dashboard: login, live activity feed, risk gauge/timeline, event
analysis (cause, explanation, SHAP, rules, chain anchor), alerts, and session
block/unblock controls. Polls the backend every 2.5 s.

## 3. Runtime data flow — one event

Implemented in `ingest.py::ingest_event()`:

1. **Resolve** the user and `SessionState`. If the session is `blocked`, refuse
   (HTTP `423`).
2. **Window**: load the user's events from the last 30 minutes for context.
3. **Features** (`features.py`): compute the 17-dim vector; store raw + vector.
4. **Score** (`risk_engine.py`): `final = 0.5·rule + 0.5·ml`, banded low/medium/high.
5. **Cause** (medium/high, `cause.py`): from SHAP top features + fired rules.
6. **Explain** (medium/high, `explain.py`): SHAP → payload → LLM or template.
7. **Anchor** (`chain.py`): SHA-256 of canonical JSON → `AuditLog.anchorEvent()`.
8. **Respond**: low = log; medium = alert + flag session; high = alert + **block** +
   require re-auth.
9. **Persist** everything in a single commit.

## 4. Technology choices (summary)

| Concern | Choice | ADR |
|---------|--------|-----|
| Repo layout | Monorepo, 3 services | [0001](adr/0001-monorepo-three-services.md) |
| Backend/ML runtime | Python 3.11 + FastAPI | [0002](adr/0002-python-fastapi-backend.md) |
| Risk model | Rules + Isolation Forest (hybrid) | [0003](adr/0003-hybrid-risk-engine.md) |
| Anomaly detector | Isolation Forest (unsupervised) | [0004](adr/0004-isolation-forest.md) |
| Score blend + ML scaling | 0.5/0.5 blend, `ML_ANCHOR` calibration | [0005](adr/0005-score-blend-and-ml-calibration.md) |
| Storage | SQLite (POC) → MongoDB (prod) | [0006](adr/0006-sqlite-storage.md) |
| Ledger | Hardhat + per-event anchoring | [0007](adr/0007-blockchain-per-event-anchoring.md) |
| Hashing | SHA-256 now, ML-DSA deferred | [0008](adr/0008-sha256-hashing-defer-ml-dsa.md) |
| Explanations | SHAP + LLM + template fallback | [0009](adr/0009-shap-llm-explanations.md) |
| Auth | JWT + bcrypt + RBAC | [0010](adr/0010-jwt-bcrypt-rbac.md) |
| Eventing | In-process (no Kafka) | [0011](adr/0011-in-process-no-kafka.md) |
| UI updates | Next.js + polling | [0012](adr/0012-nextjs-polling-dashboard.md) |
| Response | Session block/flag (software) | [0013](adr/0013-session-based-response.md) |
| Cause logic | Feature buckets + rule overrides | [0014](adr/0014-cause-classification-strategy.md) |
| Model depth | Per-user z-scores, scaling, cyclical time, eval harness | [0015](adr/0015-model-personalization-and-evaluation.md) |

## 5. Deployment topologies

- **`setup.sh`** — local processes on one host (venv + node), for development/demo.
- **`docker compose`** — three containers (`chain`, `backend`, `frontend`) plus
  shared volumes; the chain writes the contract address to a volume the backend
  reads. See [operations.md](operations.md).
