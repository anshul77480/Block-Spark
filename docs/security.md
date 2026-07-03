# Security & threat model

> This is a **POC**. Several deliberate simplifications would be unacceptable in
> production; they are listed under "POC caveats" so they are not mistaken for
> production-ready choices.

## 1. Authentication & authorization

- **Passwords**: hashed with bcrypt via passlib (`app/auth.py`). Actor (simulated)
  accounts store `"!disabled"` and cannot authenticate.
- **Sessions/tokens**: stateless **JWT** (`HS256`), signed with `JWT_SECRET`,
  default 8-hour expiry. Issued on `POST /auth/login`.
- **Transport**: the frontend attaches the token as a bearer header; a `401`
  interceptor clears it and returns to login.
- **RBAC**: `get_current_user` authenticates; `require_admin` gates every mutating
  route (simulator control, `/ingest`, session actions, alert acknowledgement).
  Read routes require any authenticated user. See [ADR-0010].

## 2. Audit integrity (blockchain)

- Every event's canonical JSON is hashed with **SHA-256** and anchored to the
  `AuditLog` contract, yielding a tamper-evident, independently verifiable trail.
- The event hash and returning tx hash are stored on the `Event` row and surfaced in
  the UI. See [ADR-0007], [ADR-0008].

## 3. The insider-threat detection surface

The system reasons about three insider archetypes (see
[risk-methodology.md](risk-methodology.md) and [ADR-0014]):

| Archetype | Signals | Response |
|-----------|---------|----------|
| **Malicious Insider** | bulk export, sequential scraping, destructive/log-wiping commands, off-hours w/o ticket | block + preserve logs + investigate |
| **Compromised Account** | new device + new IP + geo jump + odd hours, normal action content | block + force MFA + reset credentials |
| **Negligent User** | policy violation (no ticket, sensitive access) without evasion/exfil | manager alert + require ticket + retrain |

## 4. Response & containment

- Medium risk → alert + session **flagged**.
- High risk → alert + session **blocked**: `ingest_event()` refuses further actions
  for that session (`423`) and `requires_reauth` is set. Admins can block/unblock
  manually. See [ADR-0013].

## 5. POC caveats (do not ship as-is)

| Area | POC behaviour | Production expectation |
|------|---------------|------------------------|
| CORS | `allow_origins=["*"]` | explicit allow-list |
| JWT secret | default in `.env.example` | secret manager, rotation |
| Token revocation | none (stateless) | denylist / short TTL + refresh |
| Transport | HTTP locally | TLS everywhere |
| Chain accounts | unlocked Hardhat dev account | managed signer / HSM |
| Rate limiting / brute-force | none | throttling, lockout |
| Registration | open `/auth/register` | restricted / SSO |
| Hashing | SHA-256 only | + ML-DSA signatures ([ADR-0008]) |
| Response | software session block | + OS/hardware controls (`FLAG_SECURE`) — out of scope |

## 6. Out-of-scope (Future Scope)

eBPF/kernel hooks, Kafka/broker, CCTV/physical security, `FLAG_SECURE`/OS screen
blocking, full post-quantum crypto (ML-DSA), Merkle-batched anchoring, and MongoDB
as the production store. See root [README](../README.md) "Future Scope".

[ADR-0007]: adr/0007-blockchain-per-event-anchoring.md
[ADR-0008]: adr/0008-sha256-hashing-defer-ml-dsa.md
[ADR-0010]: adr/0010-jwt-bcrypt-rbac.md
[ADR-0013]: adr/0013-session-based-response.md
[ADR-0014]: adr/0014-cause-classification-strategy.md
