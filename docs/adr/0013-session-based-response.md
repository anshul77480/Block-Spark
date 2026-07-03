# ADR-0013: Session-based risk response

- Status: Accepted
- Date: 2026-07-03
- Deciders: POC engineering

## Context

Detection is only useful with a response. The POC must demonstrate tiered,
risk-proportionate containment — and a working "block the session" action — without
OS/hardware integration (`FLAG_SECURE` and kernel controls are out of scope).

## Decision

Model response as a **`SessionState` machine** driven by the event band:

| Band | Action |
|------|--------|
| low | log only |
| medium | raise alert, set session `flagged` |
| high | raise alert, set session `blocked`, `requires_reauth = true` |

While `blocked`, `ingest_event()` **refuses further actions** for that session
(HTTP `423`). Admins can `block`/`unblock` any session via `POST /sessions/action`.

## Consequences

- **+** A concrete, demonstrable containment action tied directly to risk.
- **+** Enforcement is centralized in `ingest_event()`, so every path (simulator,
  API, adapter) honours the block.
- **+** Manual admin override supports the SOC workflow.
- **−** Software-level block only; it does not stop out-of-band exfiltration.
  Hardware/OS response (`FLAG_SECURE`) is the documented production extension (Future
  Scope).

## Alternatives considered

- **Per-user (not per-session) block** — coarser; sessions map better to a
  compromised login or an active exfil attempt.
- **Alert-only (no block)** — fails the requirement to demonstrate response.
