# ADR-0006: SQLite for POC storage (MongoDB as production target)

- Status: Accepted
- Date: 2026-07-03
- Deciders: POC engineering

## Context

The demo must run with **zero database setup** on any machine, but the reference
architecture names **MongoDB** as the production datastore.

## Decision

Use **SQLite via SQLAlchemy** for the POC. All persistence goes through the ORM
(`app/models.py`, `app/db.py`), keeping the storage engine behind a single boundary.
Document MongoDB as the production target.

## Consequences

- **+** No services to install; the DB is a file, seeded and trained on first run.
- **+** The SQLAlchemy boundary localizes a future swap of the engine.
- **−** SQLite is single-writer and not suited to production concurrency; the
  simulator uses short-lived sessions per event to avoid lock contention.
- **−** A MongoDB move is not a drop-in ORM change (document vs relational); the ORM
  boundary limits, but does not eliminate, that work.

## Alternatives considered

- **MongoDB now** — adds a required service and setup for no POC benefit.
- **Postgres** — heavier than needed for a single-host demo.
