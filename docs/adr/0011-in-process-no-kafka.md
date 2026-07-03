# ADR-0011: In-process orchestration, no message broker

- Status: Accepted
- Date: 2026-07-03
- Deciders: POC engineering

## Context

A production insider-threat pipeline would stream events through a broker (e.g.
Kafka) between collection, scoring, and response. For a single-host demo, a broker
adds a heavyweight dependency and operational overhead with no demonstrable benefit.

## Decision

Keep event flow **in-process**: the simulator (a background thread) and the
`/ingest` route call `ingest_event()` directly, which runs feature→score→cause→
explain→anchor→respond synchronously and persists in one commit. No Kafka or broker.

## Consequences

- **+** Zero broker setup; the whole pipeline is a single call path that is easy to
  trace and debug.
- **+** Deterministic ordering per session simplifies the windowed features and the
  block response.
- **−** No horizontal scale-out or backpressure handling; synchronous scoring blocks
  the request. Fine for demo volumes.
- Follow-up: production would introduce Kafka (or similar) between stages (Future
  Scope) — the `ingest_event()` seam is where that boundary would go.

## Alternatives considered

- **Kafka / Redis streams now** — explicitly out of scope; disproportionate for the
  POC.
- **In-process async queue** — marginal benefit over direct calls at this scale.
