# Insider Threat Detection & Response — POC

A working, end-to-end proof of concept for an insider-threat detection and response
system in a banking-style environment. An admin logs in, activity is generated in
real time, a **hybrid risk engine** scores every event, high-risk activity is
**classified by cause** and **explained in plain English**, every event hash is
**anchored to a local blockchain**, and a dark-mode SOC dashboard shows it all live
with a working **block-session response**.

> This is a demo POC, not production. It runs end to end with no stubs in the core
> flow. See **Future Scope** for the deliberately out-of-scope items.

---

## Documentation

Full engineering docs live in **[`docs/`](docs/)**:

- [Architecture](docs/architecture.md) — system context, components, data flow, stack
- [Risk methodology](docs/risk-methodology.md) — features, scoring, calibration, cause, explanations
- [API reference](docs/api-reference.md) · [Data model](docs/data-model.md) · [Security](docs/security.md) · [Operations runbook](docs/operations.md)
- [Future scope](docs/future-scope.md) — out-of-scope items + production roadmap and phasing
- [Architecture Decision Records](docs/adr/) — the *why* behind every major choice (15 ADRs)

## The end-to-end flow

```
 Simulator / CERT adapter
          │  raw activity events
          ▼
 features.py ──► risk_engine.py ──► cause.py ──► explain.py ──► chain.py ──► response
 (feature       (rules + Isolation   (Malicious/  (SHAP top      (SHA-256     (alert /
  vector)        Forest, 0-100        Negligent/   features +     anchored     flag /
                 blended score)       Compromised) LLM narrative) on-chain)    block)
          │                                                                       │
          └──────────────────────► SQLite (events, alerts, sessions) ◄────────────┘
                                              │
                                     FastAPI  ▼   Next.js SOC dashboard (live)
```

## Architecture / services

Three services, small surface area:

| Service      | Stack                                  | Role                                          |
|--------------|----------------------------------------|-----------------------------------------------|
| `backend`    | Python 3.11, FastAPI, scikit-learn, SHAP, SQLAlchemy/SQLite, web3.py | Auth, simulator, feature engineering, risk engine, cause, explanations, chain client, orchestration |
| `blockchain` | Hardhat local node + `AuditLog.sol`    | Immutable on-chain audit log of event hashes  |
| `frontend`   | Next.js 14 (app router), Tailwind, Recharts | Dark-mode SOC dashboard                    |

## What's implemented (in scope)

- **Login + admin dashboard** with JWT auth and role-based access (`require_admin`).
- **Real-time activity simulator** generating realistic banking-admin activity, incl. threat scenarios.
- **Hybrid AI risk score (0-100)** — deterministic rule engine blended with an Isolation Forest.
- **Cause classification** — Malicious Insider / Negligent User / Compromised Account.
- **Plain-English explanations** — SHAP feature attributions + an LLM, with a deterministic template fallback when no API key is set.
- **Blockchain audit log** — SHA-256 of each canonical event JSON anchored to `AuditLog` via web3.py; tx hash stored and shown.
- **Risk-based response** — low: log only; medium: alert + flag session; high: **block session** (further actions refused, `423`) + require re-auth.

## The risk engine (core deliverable)

`backend/app/risk_engine.py` — `final = 0.5 * rule_score + 0.5 * ml_score`, clamped 0-100.
Weights and thresholds are module-level constants so they are easy to tune.

**Rule layer** (deterministic, always explainable — points added then capped at 100):

| Rule | Points |
|------|:------:|
| Off-hours access (outside 09:00–18:00) | +15 |
| High-risk action with no matching ticket | +25 |
| Bulk export (≥ records or MB threshold) | +25 |
| Sequential account paging (scraping)   | +20 |
| Destructive / log-wiping command       | +40 |
| New device **and** new IP together      | +20 |
| High action velocity                    | +10 |

Every fired rule is recorded (name, points, detail) and shown in the UI.

**ML layer** — an Isolation Forest trained on baseline-normal feature vectors
(`train_model.py`), persisted with joblib. Features are **`StandardScaler`-scaled**
before fitting/inference so no high-magnitude column dominates. The anomaly score
from `decision_function` is normalised to 0-100 (higher = more anomalous) using
calibration bounds captured at training time.

**Personalization** — three **per-user z-score** features (`records_z`,
`velocity_z`, `export_z`) score deviation from *each user's own* baseline, plus
**cyclical time encoding** (`hour_sin`/`hour_cos`). See [ADR-0015](docs/adr/0015-model-personalization-and-evaluation.md).

**Bands**: low `0–39`, medium `40–69`, high `70–100`.

**Evaluation** — `make evaluate` (`evaluate.py`) injects labelled normal/threat
events and reports precision/recall/F1 for the alert and block decisions plus
ROC-AUC. Baseline: alert F1 ≈ 0.91, block precision 1.00, ROC-AUC ≈ 0.98.

### Tuning note

Because the Isolation Forest's `decision_function` is compressed for the
(now 22-feature) space, its raw output was rescaled (`ML_ANCHOR` in `risk_engine.py`)
so that genuine threats reach the high band under the 50/50 blend while normal
activity stays low. The blend weights and this anchor are the two knobs to tune;
both are constants at the top of the file. Tuning is now **measured** with
`make evaluate` rather than eyeballed (destruction & exfil → high, negligent →
medium, baseline → low).

## How it all works (deep dive)

### The life of one event (end to end)

Every activity event — whether produced by the simulator, the `POST /ingest` API,
or the CERT adapter — flows through the same orchestration in
[`backend/app/ingest.py`](backend/app/ingest.py) → `ingest_event()`:

1. **Resolve user & session.** The actor (`username`) is looked up or created; a
   `SessionState` row keyed by `session_id` (default `"<username>-session"`) is
   fetched/created. **If that session is already `blocked`, the event is refused**
   with a `SessionBlockedError` (HTTP `423`) — this is the enforcement half of the
   response.
2. **Gather the rolling window.** The user's events from the last `WINDOW_MINUTES`
   (30) are pulled from the DB so windowed features (volumes, distinct accounts,
   sequential-access score, velocity) have context.
3. **Compute features** ([`features.py`](backend/app/features.py) →
   `compute_features()`): the raw event + window + the user's behavioural baseline
   (home geo/IP/known devices) become a fixed 22-dim numeric vector. Both the raw
   event and the vector are stored.
4. **Score** ([`risk_engine.py`](backend/app/risk_engine.py) → `score_event()`):
   the rule layer and the Isolation-Forest layer each produce 0–100; they're
   blended and banded (see below).
5. **Classify cause** (medium/high only,
   [`cause.py`](backend/app/cause.py)): using the SHAP-ranked top features + which
   rules fired, decide Malicious / Negligent / Compromised.
6. **Explain** (medium/high only, [`explain.py`](backend/app/explain.py)): compute
   SHAP attributions, build a compact JSON payload, and get a plain-English
   narrative + recommended action from the LLM (or the template fallback).
7. **Anchor** ([`chain.py`](backend/app/chain.py)): SHA-256 of the canonical event
   JSON is written to the `AuditLog` contract via web3.py; the returned tx hash is
   stored on the event.
8. **Respond** (see the response state machine below) and persist everything in one
   commit.

### Feature engineering internals

`compute_features()` builds the vector from three inputs — the current raw event,
the recent window, and the user's baseline:

- **Time**: `hour_of_day`, `is_off_hours` (outside 09:00–18:00), `is_weekend`.
- **Identity / context**: `geo_distance_km` (haversine from the user's baseline
  lat/lon using a small geo→coords table), `is_new_device` (device not in the
  user's `known_devices`), `is_new_ip` (source IP not in the baseline /24 subnet).
- **Volume / scraping (windowed)**: `records_accessed_in_window`,
  `distinct_accounts_in_window`, `sequential_access_score` (fraction of accessed
  account IDs that form a consecutive run — high ⇒ paging through records),
  `export_count_in_window`, `export_volume_mb`, `download_count_in_window`,
  `sensitive_resource_access_count` (resources matching PII/core keywords).
- **Intent flags**: `risky_command_flag` (matches `rm -rf`, `shred`, `dd`,
  `chattr`, log-clearing, …), `no_ticket_flag` (a high-risk action with no
  `matched_case_id`), `failed_action_ratio`, `actions_per_minute`.

`FEATURE_ORDER` is the canonical column order shared by training and inference —
it must not change without retraining.

### Risk score math — worked example

`final = clamp(0,100, RULE_WEIGHT·rule + ML_WEIGHT·ml)` with `RULE_WEIGHT =
ML_WEIGHT = 0.5`.

Example: a database admin runs `shred -u /data/ledger.db` at 02:00 with no ticket.
- Rule layer: `destructive_command (+40)` + `off_hours_access (+15)` +
  `no_ticket_high_risk (+25)` = **80**.
- ML layer: the vector (risky_command=1, off_hours=1, no_ticket=1) is far outside
  the all-normal training set → Isolation Forest `decision_function` is strongly
  negative → normalised to **~85**.
- `final = 0.5·80 + 0.5·85 = 82.5` → **high** → session blocked.

A normal `record_view` in business hours fires no rules (rule=0) and sits near the
training centre (ml≈15–25) → `final ≈ 8–13` → **low**.

### How the model is trained (`train_model.py`)

The Isolation Forest is **unsupervised** and trained only on **normal** behaviour:
the baseline events created by `seed.py` (or a synthetic normal set if the DB is
empty). A `StandardScaler` is fitted on the vectors first; the forest trains on the
scaled data. We then record the 2nd/98th percentiles of `decision_function` over the
scaled training data as calibration bounds (`lo`,`hi`) and persist a
`CalibratedModel` (`model` + `scaler` + `lo` + `hi` + `feature_order`) with joblib.
At inference, `ml_score()` scales the vector, then maps raw `decision_function`
linearly from `hi`→0 and `lo`→`ML_ANCHOR`, clamped to 100 (see the Tuning note
above). Per-user `activity_stats` for the z-score features are computed by `seed.py`.

### Cause classification logic (`cause.py`)

Features are grouped into three buckets — **identity/context** (new device/IP, geo,
time), **exfil/evasion** (exports, downloads, scraping, destructive commands,
volume), and **policy** (no-ticket, sensitive access, velocity). SHAP contributions
of the top features are summed per bucket, nudged by which rules fired, and the
dominant bucket picks the cause — with two guards: destructive/exfil rules force
**Malicious Insider**, and a pure identity anomaly (new device **and** new IP) with
otherwise-normal action content forces **Compromised Account**.

### Explanations (`explain.py`)

`shap.TreeExplainer` (falling back to `KernelExplainer`) computes per-feature
contributions for the event's vector; the top 3 by |contribution| are kept. A
compact JSON payload (user, action, score, band, cause, top features, rules) is
sent to the LLM via `httpx` (`/chat/completions`). **If `LLM_API_KEY` is empty**, a
deterministic template produces an equivalent narrative + recommended action, so
the demo never breaks. The response includes `explanation_source: "llm" |
"template"`.

### Blockchain anchoring (`chain.py` + `AuditLog.sol`)

`canonical_hash()` serialises the event with sorted keys and hashes it with
SHA-256. `ChainClient` connects to the RPC node, resolves the contract address
(from `CONTRACT_ADDRESS` or the address file the deploy script writes), and calls
`anchorEvent(bytes32 hash, string metadata)` from the first unlocked Hardhat
account. The contract stores `{hash, block.timestamp, recorder, metadata}`, emits
`EventAnchored`, and exposes `getRecord`/`totalRecords`. The client **degrades
gracefully** — if the node is down or no address is found, events still score and
store with `anchored=false`, and it retries connecting on the next call.

### Risk-based response — session state machine

`SessionState.status` transitions drive the response tiers:

```
          low  → (no change; log only)
active ─── medium → flagged        (alert raised, session flagged)
   │      high   → blocked         (alert raised, requires_reauth=true)
   │                 │
   └──────── admin unblock ◄───────┘   (POST /sessions/action)
```

While `blocked`, `ingest_event()` refuses further actions for that session
(`423`), and the dashboard shows the blocked state. Admins can block/unblock any
session manually. (Hardware screen-locking / `FLAG_SECURE` is the production
extension of this response — out of scope, see Future Scope.)

### Auth flow

`POST /auth/login` verifies the bcrypt hash (passlib) and returns a signed JWT
(PyJWT, `HS256`). The frontend stores it in `localStorage` and an axios interceptor
attaches it as `Authorization: Bearer …` on every request; a `401` clears the token
and bounces to login. `get_current_user` decodes the token; `require_admin` gates
all mutating routes (simulator control, ingest, session actions, alert ack).

### Frontend architecture

The dashboard ([`frontend/app/dashboard/page.jsx`](frontend/app/dashboard/page.jsx))
is a client component that **polls** every 2.5 s, fetching events, alerts, sessions,
stats, simulator status and chain status in parallel (`Promise.all`). State flows
down to presentational components ([`components/`](frontend/components/)):
`StatsBar`, `ActivityFeed` (select an event), `EventDetail` (gauge + cause +
explanation + SHAP bars + rules + chain anchor), `RiskTimeline` (Recharts line with
band reference lines), `AlertsPanel`, and `SessionsPanel` (block/unblock buttons).
The API base URL comes from `NEXT_PUBLIC_API_URL`.

## Feature set (`features.py`) — 22 features

`hour_of_day`, `hour_sin`, `hour_cos`, `is_off_hours`, `is_weekend`,
`geo_distance_km`, `is_new_device`, `is_new_ip`, `records_accessed_in_window`,
`distinct_accounts_in_window`, `sequential_access_score`, `export_count_in_window`,
`export_volume_mb`, `download_count_in_window`, `sensitive_resource_access_count`,
`risky_command_flag`, `no_ticket_flag`, `failed_action_ratio`, `actions_per_minute`,
`records_z`, `velocity_z`, `export_z`. The last three are **per-user z-scores**
(deviation from that user's own baseline); `hour_sin`/`hour_cos` are cyclical time.
Both the raw event and its computed feature vector are stored. Full table:
[docs/risk-methodology.md](docs/risk-methodology.md).

## API (FastAPI)

`POST /auth/register`, `POST /auth/login`, `GET /me`, `GET /health`,
`POST /simulator/control` (admin), `GET /simulator/status`, `POST /ingest` (admin,
scores one event → score/band/cause/explanation/rules/anchor tx),
`GET /events`, `GET /events/{id}`, `GET /alerts`, `POST /alerts/{id}/acknowledge`,
`GET /sessions`, `POST /sessions/action` (admin block/unblock), `GET /chain/status`,
`GET /stats`. All data routes require the JWT; mutating actions require the admin role.
Interactive docs at `/docs`.

## Dataset (`data_adapter.py`)

Primary dataset: the **CERT Insider Threat dataset** on Kaggle
(`logon.csv`, `device.csv`, `file.csv`, `http.csv`, `email.csv`, LDAP). Because the
Isolation Forest is unsupervised, we train on **normal behaviour only** — labels are
not required. `data_adapter.py` maps CERT columns onto our feature schema so a real
dataset drops straight in. The simulator stays fully functional so the demo is never
blocked on a download.

## Run it

Three ways, easiest first:

**1. One shell script (installs everything + runs it all):**
```
./setup.sh
```
Installs backend/blockchain/frontend deps (idempotent), starts the chain, deploys
the contract, seeds + trains, starts the API and dashboard, then streams logs.
Ctrl+C stops everything. Flags: `--skip-install`, `--install-only`, `--stop`.

**2. Docker (one command):**
```
docker compose up --build
```

**3. Manual (three terminals):** see **[run.md](run.md)**.

Then open **http://localhost:3000** (login `admin` / `admin123`) and API docs at
**http://localhost:8000/docs**.

### Task runner (`make`)

A `Makefile` wraps every common task — run `make` to list them. Highlights:

| Target | Does |
|--------|------|
| `make run` / `make up` / `make stop` | start (with/without install) / stop the stack |
| `make reset` | wipe DB + model + chain state and start fresh |
| `make smoke` / `make e2e` | pipeline smoke test / full API end-to-end check |
| `make evaluate` | detection metrics (precision/recall/F1/AUC) on injected threats |
| `make sim-start` / `make sim-stop` | control the simulator (`RATE=`, `THREAT=`) |
| `make stats` / `make health` | quick status |
| `make docker-up` / `make docker-down` | Docker Compose lifecycle |

**Deterministic demo scenarios** — inject one crafted event and see it scored,
classified and anchored (great for a live walkthrough):

```
make scenario-normal            # -> LOW
make scenario-negligent         # -> MEDIUM / Negligent User
make scenario-compromised       # -> HIGH   / Compromised Account
make scenario-malicious-exfil   # -> HIGH   / Malicious Insider  (bulk PII export)
make scenario-malicious-destroy # -> HIGH   / Malicious Insider  (destructive command)
make demo-all                   # run all five back to back
```

Verify the (version-sensitive) ML stack independently:
```
cd backend && source .venv/bin/activate && python smoke_test.py
```

## Storage note

SQLite is used for **zero-config demo storage**. The production target from the
architecture diagram is **MongoDB**; the SQLAlchemy boundary keeps that swap
localized.

## Blockchain note

For the POC we anchor **one hash per event**. Production would batch event hashes
into a **Merkle root** anchored periodically to reduce transaction volume. Hashing
uses **SHA-256**; post-quantum signatures (ML-DSA) are future work (below).

---

## Future Scope (deliberately out of scope for this POC)

These were intentionally **not** built; they are the production extensions. See
**[docs/future-scope.md](docs/future-scope.md)** for the detailed rationale,
production approach, and phasing for each.

- **eBPF / kernel hooks** for low-level telemetry capture.
- **Kafka / message broker** for event streaming (POC uses direct in-process calls).
- **CCTV / physical security** integration.
- **`FLAG_SECURE` / OS-level screen-capture blocking** as the hardware response to a
  high-risk session (the software block/kill is implemented here).
- **Post-quantum cryptography (ML-DSA)** for signing audit records (POC uses SHA-256
  hashing only).
- **Merkle-batched anchoring** instead of per-event anchoring.
- **MongoDB** as the production datastore (POC uses SQLite).

## Repository layout

```
insider-threat-poc/
  backend/     FastAPI + ML + web3 client (app/, train_model.py, evaluate.py, data_adapter.py, smoke_test.py)
  blockchain/  Hardhat project (contracts/AuditLog.sol, scripts/deploy.js)
  frontend/    Next.js 14 dashboard (app/, components/, lib/)
  docs/        engineering docs + Architecture Decision Records (adr/)
  docker-compose.yml
  Makefile     task runner (make help) — lifecycle, tests, demo scenarios, docker
  setup.sh     one-command install + run + stop for the whole stack
  inject_event.sh  inject a single deterministic scenario event
  e2e_check.sh full end-to-end API verification
  README.md
  run.md
```
