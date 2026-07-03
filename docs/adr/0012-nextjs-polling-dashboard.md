# ADR-0012: Next.js dashboard with polling

- Status: Accepted
- Date: 2026-07-03
- Deciders: POC engineering

## Context

The SOC dashboard must show live activity, alerts, sessions, and per-event analysis,
and update as the simulator runs. It needs charts and a responsive dark-mode UI.

## Decision

Build the UI with **Next.js 14 (app router) + Tailwind + Recharts + axios**. The
dashboard is a client component that **polls** the backend every **2.5 s** with a
parallel `Promise.all` over events/alerts/sessions/stats/simulator/chain, and renders
presentational components. The API base URL comes from `NEXT_PUBLIC_API_URL`.

## Consequences

- **+** Polling is trivial to implement and robust; no socket lifecycle to manage.
- **+** Matches the required stack (Next.js, Tailwind, Recharts) and gives a clean
  SOC look with minimal code.
- **−** Polling has up-to-2.5 s latency and constant background requests; a
  production console would likely use WebSockets/SSE for push updates.
- **−** `NEXT_PUBLIC_API_URL` is baked at build time (must point at the
  browser-reachable backend, not the docker-internal host).

## Alternatives considered

- **WebSockets/SSE** — lower latency and less chatter, but more moving parts than a
  POC needs.
- **React Query** — nice caching ergonomics; a hand-rolled poll loop kept
  dependencies minimal.
