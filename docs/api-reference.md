# API reference

Base URL: `http://127.0.0.1:8000`. Interactive docs (OpenAPI/Swagger): `/docs`.

## Authentication

- `POST /auth/login` returns a JWT (`HS256`, default 8h TTL).
- All data routes require `Authorization: Bearer <token>`.
- Mutating routes additionally require the **admin** role (`require_admin`).

| Header | Value |
|--------|-------|
| `Authorization` | `Bearer <access_token>` |
| `Content-Type` | `application/json` |

## Endpoints

### Auth & identity

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/auth/register` | none | Create a user `{username, password, email?, role?}` |
| `POST` | `/auth/login` | none | `{username, password}` → `{access_token, token_type, role, username}` |
| `GET` | `/me` | user | Current user profile |
| `GET` | `/health` | none | `{status, model_loaded, chain_status, simulator_running}` |

### Simulator

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/simulator/control` | admin | `{action:"start"\|"stop", rate_seconds?, threat_probability?}` |
| `GET` | `/simulator/status` | user | `{running, rate_seconds, threat_probability, generated, last_event}` |

### Ingestion & events

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/ingest` | admin | Score one raw event; returns the scored event. `423` if the session is blocked |
| `GET` | `/events?limit=&band=` | user | Recent scored events (excludes baseline) |
| `GET` | `/events/{id}` | user | One scored event |

**`RawEvent` (request to `/ingest`)**
```json
{
  "username": "dbadmin_priya",
  "session_id": "optional-session-id",
  "action_type": "data_export",
  "resource": "core/customer_pii/account/100001",
  "record_count": 3000,
  "bytes_transferred": 400000000,
  "source_ip": "10.0.1.5",
  "geo": "New York, US",
  "device_id": "dev-priya-01",
  "matched_case_id": null,
  "command_text": null,
  "timestamp": "2026-07-03T03:15:00"
}
```

**`ScoredEvent` (response)** — key fields:
```json
{
  "id": 234, "username": "...", "action_type": "...", "resource": "...",
  "features": { "...": 0.0 },
  "rule_score": 90.0, "ml_score": 100.0, "risk_score": 95.0, "band": "high",
  "cause": "Malicious Insider",
  "rules_fired": [ {"rule": "destructive_command", "points": 40, "detail": "..."} ],
  "top_features": [ {"feature": "no_ticket_flag", "value": 1.0, "contribution": 0.12} ],
  "explanation": "…plain English…",
  "recommended_action": "Immediately block the session…",
  "event_hash": "bc2ff1…", "anchor_tx": "0x0281…", "anchored": true
}
```

### Alerts

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/alerts?status=open` | user | List alerts by status (`open`/`acknowledged`/`closed`) |
| `POST` | `/alerts/{id}/acknowledge` | admin | Mark an alert acknowledged |

### Sessions & response

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/sessions` | user | All session states (`active`/`flagged`/`blocked`) |
| `POST` | `/sessions/action` | admin | `{session_id, action:"block"\|"unblock", reason?}` |

### Chain & stats

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/chain/status` | user | `{status, enabled, contract_address, rpc_url, total_records}` |
| `GET` | `/stats` | user | `{total_events, high, medium, low, anchored, open_alerts, blocked_sessions, causes}` |

## Status codes

| Code | Meaning |
|------|---------|
| `200` | OK |
| `401` | Missing/invalid/expired token |
| `403` | Authenticated but not admin |
| `404` | Resource not found |
| `423` | **Locked** — action attempted on a blocked session |
