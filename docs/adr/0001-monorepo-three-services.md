# ADR-0001: Monorepo with three services

- Status: Accepted
- Date: 2026-07-03
- Deciders: POC engineering

## Context

The POC spans three distinct runtimes — a Python ML/API backend, a Solidity/JS
blockchain project, and a JavaScript frontend. We need the demo to be easy to clone,
reason about, and run end to end, while keeping the number of moving parts small.

## Decision

Use a single **monorepo** with three top-level directories — `backend/`,
`blockchain/`, `frontend/` — plus shared root-level tooling (`setup.sh`, `Makefile`,
`docker-compose.yml`, `docs/`). Each service builds and runs independently but is
orchestrated together.

## Consequences

- **+** One clone, one place for docs and cross-cutting tooling; atomic changes
  across services in one commit.
- **+** Clear service boundaries map directly to the deployment topology.
- **−** Mixed toolchains (pip, npm, Hardhat) in one tree; contributors need both
  Python and Node.
- Neutral: production could split these into separate repos later without changing
  the internal boundaries.

## Alternatives considered

- **Polyrepo** — cleaner per-service CI, but heavier coordination and a worse demo
  experience for a POC.
