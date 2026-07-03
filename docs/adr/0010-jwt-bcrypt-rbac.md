# ADR-0010: JWT + bcrypt authentication with role-based access

- Status: Accepted
- Date: 2026-07-03
- Deciders: POC engineering

## Context

The console needs login and a clear separation between what any authenticated analyst
can read and what only an admin can do (control the simulator, ingest, block
sessions, acknowledge alerts).

## Decision

- Hash passwords with **bcrypt** (passlib). Issue **stateless JWTs** (`HS256`, 8-hour
  default TTL) on `POST /auth/login`.
- `get_current_user` decodes/validates the token; **`require_admin`** gates all
  mutating routes. Read routes require any authenticated user.
- The frontend stores the token in `localStorage` and attaches it via an axios
  interceptor; a `401` clears it and redirects to login.

## Consequences

- **+** Simple, stateless, dependency-light auth appropriate for a POC; RBAC is
  enforced with a one-line FastAPI dependency.
- **−** Stateless JWTs cannot be revoked before expiry; `localStorage` is vulnerable
  to XSS. Acceptable for the demo; production would add refresh/rotation, shorter
  TTLs, httpOnly cookies, and possibly SSO (see [security.md](../security.md)).
- **−** `bcrypt` is pinned to `4.0.1` for clean passlib interop.

## Alternatives considered

- **Server-side sessions** — needs shared session storage; more infra for the demo.
- **OAuth2/OIDC provider** — right for production, overkill to stand up for a POC.
