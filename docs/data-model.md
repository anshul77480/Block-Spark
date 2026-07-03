# Data model

SQLAlchemy ORM models in `backend/app/models.py`. SQLite for the POC; the ORM
boundary keeps the production swap to MongoDB localized ([ADR-0006]).

## Entities

```
User 1───* Event *───1 SessionState
  │           │
  │           *
  └───────── Alert
```

### `User` (`users`)
Analyst/admin accounts **and** simulated actor employees.

| Column | Type | Notes |
|--------|------|-------|
| `id` | int PK | |
| `username` | str unique | |
| `email` | str | |
| `hashed_password` | str | bcrypt; `"!disabled"` for actor accounts |
| `role` | str | `admin` \| `analyst` \| `employee` \| role label |
| `baseline_lat`,`baseline_lon`,`baseline_geo` | float/str | behavioural baseline location |
| `home_ip` | str | baseline network |
| `known_devices` | JSON | list of known device IDs |
| `activity_stats` | JSON | per-user baseline mean/std for z-score personalization (`{feature: {mean, std}}`) |
| `is_simulated` | bool | true for actor accounts driven by the simulator |
| `created_at` | datetime | |

### `Event` (`events`)
One activity event plus its computed features and scoring outputs.

| Column | Type | Notes |
|--------|------|-------|
| `id` | int PK | |
| `user_id`,`username`,`role` | fk/str | actor |
| `session_id` | str | groups events into a session |
| `timestamp` | datetime | |
| `action_type`,`resource`,`record_count`,`bytes_transferred` | | raw activity |
| `source_ip`,`geo`,`device_id`,`matched_case_id`,`command_text` | | raw activity |
| `features` | JSON | the 22-dim feature vector |
| `rule_score`,`ml_score`,`risk_score` | float | scoring |
| `band` | str | `low` \| `medium` \| `high` |
| `cause` | str | set for medium/high |
| `rules_fired` | JSON | `[{rule, points, detail}]` |
| `top_features` | JSON | `[{feature, value, contribution}]` |
| `explanation`,`recommended_action` | text | narrative outputs |
| `event_hash` | str | SHA-256 of canonical event JSON |
| `anchor_tx` | str | on-chain tx hash (nullable) |
| `anchored` | bool | whether anchoring succeeded |
| `is_baseline` | bool | seed/baseline events (training data), not scored as threats |

### `Alert` (`alerts`)
Raised for medium/high events.

| Column | Type | Notes |
|--------|------|-------|
| `id` | int PK | |
| `event_id`,`user_id`,`username`,`session_id` | | linkage |
| `band`,`cause`,`risk_score` | | severity |
| `message`,`recommended_action` | text | |
| `status` | str | `open` \| `acknowledged` \| `closed` |
| `created_at` | datetime | |

### `SessionState` (`sessions`)
Drives the risk-based response ([ADR-0013]).

| Column | Type | Notes |
|--------|------|-------|
| `id` | int PK | |
| `session_id` | str unique | default `"<username>-session"` |
| `user_id`,`username` | | actor |
| `status` | str | `active` \| `flagged` \| `blocked` |
| `reason` | text | why the last transition happened |
| `requires_reauth` | bool | set on high-risk block |
| `updated_at` | datetime | |

## Lifecycle notes

- **Baseline events** (`is_baseline=True`) are created by `seed.py` and used purely
  as Isolation-Forest training data; they are excluded from `/events` and `/stats`.
- **Sessions** are created lazily on first ingest. A `blocked` session causes
  `ingest_event()` to raise `SessionBlockedError` → HTTP `423`.

[ADR-0006]: adr/0006-sqlite-storage.md
[ADR-0013]: adr/0013-session-based-response.md
