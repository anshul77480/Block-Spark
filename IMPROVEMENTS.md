# BlockSpark — FinSpark'26 Improvements & Changelog

> **Branch:** `feature/improvements-finspark26`
> **Team:** BlockSpark
> **Event:** FinSpark'26 · COEP Technological University, Pune, India
> **Date:** July 2026
> **Base commits:** `13a4133` (first commit) → `c0b65b3` (UI changes) → this branch

---

## Overview

This document captures **every improvement** made to the BlockSpark insider-threat detection platform relative to the original `main` branch (commits `13a4133` + `c0b65b3`). Changes cover:

- Complete UI/UX redesign and brand identity
- Two-factor authentication (MFA / TOTP) enforcement
- Post-Quantum Cryptography (ML-DSA / Kyber-style) event signing
- Manual threat scenario injection system
- Blockchain verification sandbox
- Immutable ledger audit panel
- Live database tampering detection and visualisation
- Indian metro geo-localization for demo realism
- Documentation and developer tooling

**Total delta:** 32 files changed · 1,857 insertions · 171 deletions

---

## Table of Contents

1. [UI/UX Redesign](#1-uiux-redesign)
2. [Brand & Identity](#2-brand--identity)
3. [MFA / TOTP Two-Factor Authentication](#3-mfa--totp-two-factor-authentication)
4. [Post-Quantum Cryptography (ML-DSA)](#4-post-quantum-cryptography-ml-dsa)
5. [Suggestion #1 — Manual Threat Scenario Injector](#5-suggestion-1--manual-threat-scenario-injector)
6. [Suggestion #2 — Blockchain Verification Sandbox](#6-suggestion-2--blockchain-verification-sandbox)
7. [Suggestion #3 — Blockchain Ledger Audit Panel](#7-suggestion-3--blockchain-ledger-audit-panel)
8. [Suggestion #4 — Live Database Tampering Detection](#8-suggestion-4--live-database-tampering-detection)
9. [Indian Geo-Localization](#9-indian-geo-localization)
10. [Backend API Changes](#10-backend-api-changes)
11. [Database Model Changes](#11-database-model-changes)
12. [New Files Added](#12-new-files-added)
13. [All Modified Files](#13-all-modified-files)
14. [How to Run](#14-how-to-run)
15. [Demo Script for FinSpark'26](#15-demo-script-for-finspark26)

---

## 1. UI/UX Redesign

### Landing Page (`frontend/app/page.jsx`)

**Before:** Single-column bare login form with minimal styling.

**After:**
- **Split 12-column grid layout**: left 5/12 columns show the product pitch (system pillars, tagline, team branding); right 7/12 columns hold the sign-in card
- **Auto-redirect on active session**: `useEffect` checks `localStorage` for a valid JWT token — if found, skips the login form and immediately pushes to `/dashboard`
- **Multi-step login flow**: username/password step → if MFA is enabled for the user, a second TOTP step is presented without a full page reload
- **Feature highlight cards** for the three core pillars:
  - ML Behavioral Engine (UEBA/Isolation Forest)
  - Post-Quantum Cryptography (ML-DSA)
  - Immutable Blockchain Anchoring
- **Design**: no neon/glow backgrounds — clean flat dark surfaces (`#05080e`), Inter font, crisp border tokens

### Dashboard (`frontend/app/dashboard/page.jsx`)

**Before:** Single-column stacked layout, limited tab structure.

**After:**
- Responsive **12-column CSS grid**:
  - Col 1–3: Activity Feed (live-updating)
  - Col 4–9: Centre panel with 3-tab switcher (Analysis · Ledger Log · Tamper Sandbox)
  - Col 10–12: Alerts & Sessions response panels
- **`StatsBar`** — sticky live counters: total events, open alerts, on-chain anchored events, high-risk count
- **Tab switcher** — pill-style toggle between Analysis, Ledger Log, and Tamper Sandbox views
- **Auto-refresh** — events, alerts, sessions, stats, and chain status all poll every 5 seconds via `setInterval`
- **BlockSpark footer** with FinSpark'26 credit line

### Global Styles & Tailwind

**`globals.css`:**
- Removed radial gradient `mesh` background and CSS grid overlay
- Flat `#05080e` base with subtle surface layers (`#080c14`, `#0d1220`)
- Added `animate-fade-in` keyframe for smooth panel transitions

**`tailwind.config.js`:**
- Full design token palette:
  ```
  brand        #10b981 (emerald-500)
  risk-high    #ef4444
  risk-medium  #f59e0b
  risk-low     #22c55e
  surface      #080c14
  surface-2    #0d1220
  base         #05080e
  border-soft  rgba(255,255,255,0.06)
  ink / muted / faint  (text scale)
  ```

---

## 2. Brand & Identity

### Logo (`frontend/components/icons.jsx`)

**Before:** Generic shield/lock SVG placeholder.

**After:** A custom `BlockSparkLogo` component — a **3D isometric wireframe cube** (dark steel edges, depth illusion via three visible faces) with a **solid emerald lightning bolt core** centred inside the cube. Fully self-contained SVG, no raster fallback needed.

### Favicon (`frontend/app/layout.jsx`)

Added an inline `data:image/svg+xml` base64 favicon to Next.js `metadata.icons`. Displays the BlockSpark lightning bolt in the browser tab without any static file dependency.

### TopBar (`frontend/components/TopBar.jsx`)

- Product name: **BlockSpark** (was placeholder)
- Sub-text: **Insider Threat Intelligence**
- Live status pills: `CHAIN LIVE` / `SIM RUNNING` with coloured dots
- Logout button with confirm guard

### Footers

All footers updated across the app:
- Landing: `© 2026 BlockSpark · FinSpark'26`
- Dashboard: `© 2026 BlockSpark · Developed by Team BlockSpark for FinSpark'26 · ML Behavior Engine · Quantum-Safe Core · Immutable Blockchain Logs`

---

## 3. MFA / TOTP Two-Factor Authentication

**Files:** `backend/app/auth.py`, `backend/app/main.py`, `backend/app/models.py`, `backend/app/schemas.py`, `backend/app/seed.py`, `frontend/app/page.jsx`

### What was added

A full RFC 6238 TOTP (Time-based One-Time Password) implementation built entirely in pure Python — no third-party `pyotp` library.

### `backend/app/auth.py` — new functions

```python
generate_totp_secret() -> str
    # Generates a 16-character base32 secret key (compatible with Google Authenticator)

verify_totp(secret: str, code: str, window: int = 1) -> bool
    # Verifies a 6-digit TOTP code using HMAC-SHA1
    # Supports ±1 time-step window (±30s) to handle clock drift
    # Uses FIPS-compliant counter = floor(unix_time / 30)
```

### Login flow changes (`main.py`)

The `POST /token` endpoint now implements a two-phase check:

```
Phase 1: username + password
  → If user.mfa_enabled and no mfa_code in request:
      return { mfa_required: true }  (HTTP 200, no token yet)

Phase 2: username + password + mfa_code
  → verify_totp(user.mfa_secret, mfa_code)
  → If valid: issue JWT and return access_token
  → If invalid: HTTP 401 "Invalid 2FA code"
```

### Schema changes (`schemas.py`)

```python
class LoginRequest(BaseModel):
    username: str
    password: str
    mfa_code: Optional[str] = None   # ← new

class TokenResponse(BaseModel):
    access_token: Optional[str] = None
    role: Optional[str] = None
    username: Optional[str] = None
    mfa_required: bool = False        # ← new
    mfa_enabled: bool = False         # ← new
```

### Model changes (`models.py`)

```python
class User(Base):
    mfa_secret  = Column(String, nullable=True)
    mfa_enabled = Column(Boolean, default=False)
```

### Seed changes (`seed.py`)

Admin is seeded with `mfa_enabled=True` and `mfa_secret="JBSWY3DPEHPK3PXP"` (standard Google Authenticator test secret). Existing admin rows without MFA are migrated on first startup.

### Frontend (`page.jsx`)

Step 1 (username/password) → if `mfa_required == true` in response → shows a TOTP input step with `autoFocus` and `autoComplete="one-time-code"`.

**Admin credentials:**
| Field | Value |
|-------|-------|
| Username | `admin` |
| Password | `admin123` |
| TOTP seed | `JBSWY3DPEHPK3PXP` |

---

## 4. Post-Quantum Cryptography (ML-DSA)

**Files:** `backend/app/qpc.py` *(new)*, `backend/app/qpc_keys.json` *(new)*, `backend/app/ingest.py`, `backend/app/models.py`, `backend/app/schemas.py`, `frontend/components/EventDetail.jsx`

### What it does

Every event that passes through the ingestion pipeline is **digitally signed** using a pure-Python implementation of the FIPS 204 ML-DSA lattice-based signature scheme (Crystals-Dilithium variant). This provides post-quantum-safe authenticity on top of the SHA-256 blockchain anchor.

### `qpc.py` — core module

```
ML-DSA parameters (FIPS 204 simplified):
  Q = 8380417  (prime modulus)
  K = 4        (matrix row dimension)
  L = 4        (matrix column dimension)
  ETA = 2      (secret key bound)
  GAMMA_1 = 524288  (masking bound, 2^19)

Key functions:
  keygen()          → (sk, pk)  — generates LWE keypair
  mldsa_sign()      → signature  — signs the event hash bytes
  mldsa_verify()    → bool       — verifies signature against pk
  get_system_qpc_keypair()  → cached keypair (persisted to qpc_keys.json)
```

### Ingest pipeline integration (`ingest.py`)

After blockchain anchoring, each event is signed:
```python
qpc_sk, qpc_pk = get_system_qpc_keypair()
hash_bytes = bytes.fromhex(event.event_hash)
qpc_sig = mldsa_sign(hash_bytes, qpc_sk)
event.qpc_signature = json.dumps(qpc_sig)
event.qpc_pubkey    = json.dumps(qpc_pk)
event.qpc_verified  = mldsa_verify(hash_bytes, qpc_sig, qpc_pk)
```

Alerts generated from these events also carry `qpc_signature`, `qpc_pubkey`, and `qpc_verified` fields.

### Database columns (`models.py`)

```python
# On Event:
qpc_signature = Column(Text, nullable=True)
qpc_pubkey    = Column(Text, nullable=True)
qpc_verified  = Column(Boolean, default=False)

# On Alert (same three columns)
```

### Dashboard UI (`EventDetail.jsx`)

When an event has `qpc_signature`, the detail card renders a collapsed **"Quantum-Safe Signature (QPC)"** section showing the verification status badge and a truncated signature string.

---

## 5. Suggestion #1 — Manual Threat Scenario Injector

**Files:** `frontend/components/SimulatorControls.jsx`, `backend/app/simulator.py`, `backend/app/main.py`, `frontend/lib/api.js`

### What it does

Allows the demo operator to inject a **pre-scripted threat scenario** directly into the live event stream with a single button. The event goes through the full ML scoring, blockchain anchoring, and QPC signing pipeline — appearing in the feed within seconds.

### Scenarios

| Button | Key | What it simulates |
|--------|-----|-------------------|
| 🚀 Impossible Velocity | `velocity` | Two concurrent logins from Pune + Moscow within 90 seconds |
| 📤 PII Exfiltration | `exfiltration` | 48,000-record dump from `hr_sensitive.db` over 1.2 GB |
| 🗑️ Log Destruction | `destruction` | `DELETE` + `DROP TABLE` on `audit_log` by a privileged user |
| 🚫 Policy Violation | `policy` | After-hours bulk export of 12,000+ financial records |

### Implementation

**Backend (`main.py`):**
```
POST /simulator/trigger-scenario/{scenario}
  → require_admin
  → calls trigger_scenario(scenario, db)
  → runs through full ingest pipeline
  → returns ScoredEvent with risk score, blockchain hash, QPC sig
```

**Frontend (`SimulatorControls.jsx`):**
- Speed-dial button row below start/stop controls
- On click: toast notification → fires endpoint → calls `refresh()` → auto-selects the new event in the detail panel

---

## 6. Suggestion #2 — Blockchain Verification Sandbox

**Files:** `frontend/components/TamperSandbox.jsx`, `backend/app/main.py`, `frontend/lib/api.js`

### What it does

An **interactive JSON editor** in the dashboard pre-populated with the selected event's canonical payload fields. The user edits any value and clicks "Verify Ledger Immutability" — the backend recomputes the SHA-256 hash of the submitted JSON, queries all `LogStored` events from the Hardhat node (block 0 → latest), and returns whether that hash exists on-chain.

### Result states

- ✔ **Integrity Verified** (green card): hash found on-chain → includes block number, tx hash, computed hash with copy buttons
- ❌ **Tampering Detected** (red card): hash not found → computed hash shown for reference

**Backend (`main.py`):**
```
POST /chain/verify-payload
  Body: arbitrary JSON dict
  → canonical_hash(payload) → SHA-256
  → query Hardhat LogStored events
  → return { verified, event_hash, block_number?, transaction_hash? }
```

---

## 7. Suggestion #3 — Blockchain Ledger Audit Panel

**Files:** `frontend/components/LedgerPanel.jsx` *(new)*, `backend/app/main.py`, `frontend/lib/api.js`, `blockchain/scripts/print_records.js` *(new)*

### What it does

A dedicated **"Ledger Log"** tab showing all `LogStored` events emitted by the on-chain `AuditLog.sol` contract. Provides direct visibility into the immutable audit trail without leaving the dashboard.

### Table columns

| Column | Description |
|--------|-------------|
| Block # | Hardhat block number |
| Tx Hash | Truncated + copyable transaction hash |
| Event ID | Internal DB event ID |
| SHA-256 Hash | Canonical hash stored on-chain (copyable) |
| Timestamp | Block timestamp formatted as local time |

### Auto-refresh

Fetches on mount, then refreshes every 15 seconds automatically. Shows a loading skeleton on first fetch and a "No records anchored yet" empty state if the chain is empty.

**Backend:**
```
GET /chain/records
  → web3.py → filter_events("LogStored", fromBlock=0)
  → returns list[{ index, event_id, event_hash, block_number, tx_hash, timestamp }]
```

**Hardhat utility script (`blockchain/scripts/print_records.js`):**
```bash
npx hardhat run scripts/print_records.js --network localhost
# Prints all anchored records to stdout for manual verification
```

---

## 8. Suggestion #4 — Live Database Tampering Detection

**Files:** `backend/app/models.py`, `backend/app/schemas.py`, `backend/app/main.py`, `frontend/components/TamperSandbox.jsx`, `frontend/components/ActivityFeed.jsx`, `frontend/components/EventDetail.jsx`, `frontend/lib/api.js`

### What it does

The flagship demo feature. Proves that blockchain anchoring makes database tampering **detectable and provable** — even if an attacker has direct SQLite write access.

### Full detection pipeline

```
1. Event ingested → SHA-256 hash anchored on Hardhat → stored as event.event_hash
                                                        (immutable from this point)

2. Admin clicks "Corrupt DB Log Row" in Tamper Sandbox
   → POST /events/{event_id}/tamper
   → SQLite UPDATE:
       username        = "root_hacked"
       record_count    = 999999
       bytes_transferred = 500000000
       geo             = "Moscow, RU"

3. Next poll cycle (≤5 seconds)
   → GET /events serialises each Event via Pydantic
   → Event.tampered @property fires:
       canonical_hash(current_db_fields) ≠ self.event_hash
       → returns True

4. Frontend receives tampered=True on the event
   → ActivityFeed: "⚠️ TAMPERED" red pulsing badge
   → EventDetail: red border alert block explaining the hash mismatch

5. Switch to Manual Verifier in Tamper Sandbox
   → Paste corrupted payload → "❌ Tampering Detected"
   → Original payload still in Ledger Log tab → "✔ Integrity Verified"
```

### `Event.tampered` property (`models.py`)

```python
@property
def tampered(self) -> bool:
    if not self.anchored or not self.event_hash:
        return False
    from .chain import canonical_hash
    payload = {
        "event_id": self.id, "username": self.username,
        "action_type": self.action_type, "resource": self.resource,
        "record_count": self.record_count, "bytes_transferred": self.bytes_transferred,
        "timestamp": self.timestamp.isoformat(), "risk_score": self.risk_score,
        "band": self.band, "cause": self.cause,
    }
    return canonical_hash(payload) != self.event_hash
```

### Guard rails

- Tamper endpoint requires `require_admin` — non-admin tokens receive 403
- Button is disabled if event is not anchored (no on-chain reference to compare against)
- Button locks to "DB Already Corrupted ✓" after first use to prevent double-corruption

### EventDetail inline verify

Each event detail card also has a standalone **"Verify Ledger Authenticity"** button (`GET /chain/verify/{event_hash}`) that fetches the original on-chain record and displays block number, recorder address, and timestamp. This works independently of the Tamper Sandbox.

---

## 9. Indian Geo-Localization

**File:** `backend/app/seed.py`

Baseline actor home locations updated from US/UK cities to **Indian metropolitan areas** for demo realism at FinSpark'26:

| Actor | Role | Old Location | New Location |
|-------|------|-------------|--------------|
| `dbadmin_priya` | Database Admin | New York, US | **Pune, IN** (18.52°N, 73.86°E) |
| `teller_marcus` | Teller | Chicago, US | **Mumbai, IN** (19.08°N, 72.88°E) |
| `analyst_sofia` | Risk Analyst | New York, US | **Pune, IN** (18.52°N, 73.86°E) |
| `sysops_ken` | SysAdmin | San Francisco, US | **Bengaluru, IN** (12.97°N, 77.59°E) |
| `support_amina` | Customer Support | London, UK | **Hyderabad, IN** (17.39°N, 78.49°E) |

Default `baseline_lat/lon/geo` columns on the `User` model also updated to Pune coordinates. This ensures the geo-velocity anomaly detector fires correctly when the demo injects a "Moscow, RU" impossible-velocity event.

---

## 10. Backend API Changes

### New endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/simulator/trigger-scenario/{scenario}` | admin | Inject a pre-scripted threat scenario |
| `POST` | `/events/{event_id}/tamper` | admin | Corrupt SQLite columns for tamper demo |
| `GET`  | `/chain/verify/{event_hash}` | any | Verify a specific hash against the ledger |
| `POST` | `/chain/verify-payload` | any | Verify an arbitrary JSON payload's hash |
| `GET`  | `/chain/records` | any | Fetch all on-chain LogStored records |

### Modified endpoints

| Path | Change |
|------|--------|
| `POST /token` | Two-phase MFA flow: returns `mfa_required=true` on first phase if MFA enabled; verifies TOTP on second phase |

---

## 11. Database Model Changes

### `User` model (new columns)

```
mfa_secret    String    — base32 TOTP secret key
mfa_enabled   Boolean   — whether MFA is enforced for this user
```

### `Event` model (new columns + property)

```
qpc_signature  Text     — JSON-serialised ML-DSA signature vector
qpc_pubkey     Text     — JSON-serialised ML-DSA public key
qpc_verified   Boolean  — whether QPC signature passed at ingestion
tampered       @property — runtime hash comparison (not a DB column)
```

### `Alert` model (new columns)

```
qpc_signature  Text     — copied from triggering event
qpc_pubkey     Text     — copied from triggering event
qpc_verified   Boolean  — copied from triggering event
```

---

## 12. New Files Added

| File | Purpose |
|------|---------|
| `IMPROVEMENTS.md` | This document — full changelog |
| `backend/app/qpc.py` | Pure-Python ML-DSA (Kyber/Dilithium-style) PQC signing module |
| `backend/app/qpc_keys.json` | Persisted system keypair (auto-generated on first run) |
| `blockchain/scripts/print_records.js` | Hardhat script: prints all anchored LogStored events to stdout |
| `frontend/components/LedgerPanel.jsx` | Blockchain ledger audit log viewer tab |
| `frontend/components/TamperSandbox.jsx` | DB corruption + blockchain verification sandbox tab |

---

## 13. All Modified Files

| File | Lines Δ | Key changes |
|------|---------|-------------|
| `Makefile` | +9 -0 | Stack startup targets updated |
| `backend/app/auth.py` | +49 -0 | `generate_totp_secret()`, `verify_totp()` |
| `backend/app/features.py` | +5 -0 | ML feature vector extensions for new scenarios |
| `backend/app/ingest.py` | +19 -0 | QPC signing step + alert QPC field propagation |
| `backend/app/main.py` | +151 -0 | 5 new endpoints, two-phase MFA login |
| `backend/app/models.py` | +43 -0 | `mfa_*`, `qpc_*` columns on User/Event/Alert; `tampered` property |
| `backend/app/schemas.py` | +22 -0 | `mfa_code`, `mfa_required`, `qpc_*`, `tampered` fields |
| `backend/app/seed.py` | +24 -0 | Indian geos, MFA seeding, admin MFA migration |
| `backend/app/simulator.py` | +47 -0 | `trigger_scenario()` for 4 named attack patterns |
| `backend/data_adapter.py` | +8 -0 | Field normalisation for new event shape |
| `blockchain/scripts/print_records.js` | +37 -0 | *(new)* |
| `e2e_check.sh` | +11 -0 | Smoke-test assertions for new endpoints |
| `frontend/app/dashboard/page.jsx` | +80 -0 | 3-tab switcher, TamperSandbox, LedgerPanel, onRefresh |
| `frontend/app/globals.css` | +9 -1 | Token overhaul, removed gradients |
| `frontend/app/layout.jsx` | +3 -0 | SVG favicon via `metadata.icons` |
| `frontend/app/page.jsx` | +180 -83 | Split layout, auto-redirect, MFA step |
| `frontend/components/ActivityFeed.jsx` | +6 -0 | `⚠️ TAMPERED` pulsing badge |
| `frontend/components/EventDetail.jsx` | +140 -0 | QPC signature section, tamper alert, inline chain verify |
| `frontend/components/LedgerPanel.jsx` | +135 -0 | *(new)* |
| `frontend/components/RiskTimeline.jsx` | +8 -0 | Minor chart token fixes |
| `frontend/components/SimulatorControls.jsx` | +88 -0 | 4 scenario trigger buttons |
| `frontend/components/StatsBar.jsx` | +2 -0 | Minor token update |
| `frontend/components/TamperSandbox.jsx` | +273 -0 | *(new)* full sandbox component |
| `frontend/components/TopBar.jsx` | +11 -0 | BlockSpark branding |
| `frontend/components/icons.jsx` | +23 -0 | 3D isometric BlockSpark logo SVG |
| `frontend/components/ui.jsx` | +8 -0 | Minor shared primitive updates |
| `frontend/lib/api.js` | +27 -0 | `triggerScenario`, `verifyPayloadOnChain`, `tamperEventLog`, `getChainRecords` |
| `frontend/tailwind.config.js` | +14 -0 | Full design token palette |
| `inject_event.sh` | +11 -0 | Updated curl payloads |

---

## 14. How to Run

### Prerequisites

- Node.js 18+, Python 3.11+
- Hardhat installed via `blockchain/package.json`
- No external DB or cloud services required — fully self-contained

### Start the full stack

```bash
# From project root
make up
```

Starts three processes in parallel:
1. **Hardhat node** — `localhost:8545` (local Ethereum blockchain)
2. **FastAPI backend** — `localhost:8000` (API + ML engine)
3. **Next.js frontend** — `localhost:3000` (dashboard)

### Environment setup

Copy and configure the backend env:
```bash
cp backend/.env.example backend/.env
# Default values work for local dev — no changes needed
```

### First-run seeding

The database is auto-seeded on startup. To reset and reseed:
```bash
rm backend/insider_threat.db
make up
```

### Login credentials

| Field | Value |
|-------|-------|
| Username | `admin` |
| Password | `admin123` |
| TOTP seed | `JBSWY3DPEHPK3PXP` |
| MFA app | Google Authenticator / any TOTP app |

---

## 15. Demo Script for FinSpark'26

> Approximate runtime: 8–10 minutes for a full walkthrough

### Act 1 — Overview (1 min)

Open `localhost:3000`. Walk through the landing page pillars (ML Engine, PQC, Blockchain). Click **Sign In**.

### Act 2 — MFA Login (1 min)

1. Enter `admin` / `admin123` → step 1 passes
2. Open Google Authenticator (seed `JBSWY3DPEHPK3PXP`) → enter 6-digit code
3. Redirected to `/dashboard` — point out the live stats bar and empty feed

### Act 3 — Threat Simulation (2 min)

1. Click **▶ Start** in Simulator Controls
2. Watch events stream into the Activity Feed — colours show risk bands (red = high, amber = medium, green = low)
3. Click **Log Destruction** scenario button → a `HIGH` risk event injects instantly
4. Click the event → Event Analysis tab shows ML risk score, SHAP feature bars, cause classification, QPC signature badge

### Act 4 — Blockchain Ledger (2 min)

1. Click the **Ledger Log** tab
2. Point out the on-chain record matching the event hash — immutable, timestamped
3. Click the hash copy button → paste into the Manual Verifier (Tamper Sandbox) → shows ✔ Integrity Verified

### Act 5 — Tamper Demonstration (3 min)

1. **Select an anchored event** in the feed
2. Switch to **Tamper Sandbox** tab
3. Click **"Corrupt DB Log Row"** — the button changes to "DB Already Corrupted ✓"
4. The event feed immediately shows a pulsing **⚠️ TAMPERED** badge in red
5. Click the event → detail card shows the red "Local DB Tampering Detected" alert
6. Switch to the Manual Verifier — paste the now-corrupted payload (username = root_hacked, record_count = 999999) → **❌ Tampering Detected · Hash Mismatch**
7. Switch to Ledger Log — the original record still exists, intact

### Act 6 — Close (1 min)

**Key message:** The SQL database was directly modified — normally undetectable. But the blockchain hash anchored at ingestion time cannot be changed. BlockSpark uses this cryptographic ground truth to provide tamper-evident audit trails for financial institutions.

---

*BlockSpark · Team for FinSpark'26 · COEP Technological University, Pune, India*
