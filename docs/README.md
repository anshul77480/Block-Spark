# Documentation

Engineering documentation for the **Insider Threat Detection & Response POC**.

## Index

| Document | What it covers |
|----------|----------------|
| [architecture.md](architecture.md) | System context, components, runtime data flow, tech stack |
| [risk-methodology.md](risk-methodology.md) | Feature engineering, hybrid scoring, calibration, cause classification, explanations |
| [api-reference.md](api-reference.md) | REST endpoints, auth, request/response shapes |
| [data-model.md](data-model.md) | Persistence entities and relationships |
| [security.md](security.md) | Auth/RBAC model, threat model, POC security caveats |
| [operations.md](operations.md) | Run, deploy, configure, troubleshoot (runbook) |
| [future-scope.md](future-scope.md) | Out-of-scope items + production roadmap and phasing |
| [adr/](adr/) | Architecture Decision Records — the *why* behind each choice |

## How this is organised

- **Reference docs** (`architecture`, `api`, `data-model`, …) describe **what the
  system is** and how to operate it. They are kept in sync with the code.
- **ADRs** (`adr/NNNN-*.md`) capture **decisions and their rationale** at a point in
  time. They are append-only: superseded decisions are marked, not deleted.

## Scope reminder

This is a **proof of concept** for demonstration, not a production system. Where a
production choice differs from the POC implementation, it is called out explicitly
(e.g. SQLite → MongoDB, per-event anchoring → Merkle batching, SHA-256 → ML-DSA).
See [ADR index](adr/README.md) and the root [README](../README.md) "Future Scope".
