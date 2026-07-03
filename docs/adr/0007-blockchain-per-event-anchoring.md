# ADR-0007: Local blockchain + per-event hash anchoring

- Status: Accepted
- Date: 2026-07-03
- Deciders: POC engineering

## Context

The audit log must be **tamper-evident**: an insider (or admin) should not be able to
silently alter or delete evidence. We need something demonstrable locally without
cloud accounts or gas costs.

## Decision

Run a **local Hardhat node** hosting a minimal Solidity contract, `AuditLog.sol`,
that stores `{eventHash, block.timestamp, recorder, metadata}` and emits
`EventAnchored`. For every ingested event the backend computes **SHA-256 over the
canonical event JSON** and calls `anchorEvent(...)` via **web3.py**, storing the
returned tx hash on the event. The client **degrades gracefully** — if the node/
contract is unavailable, events still score and store with `anchored=false`, and it
retries on the next call.

For the POC we anchor **one hash per event**.

## Consequences

- **+** Independently verifiable, immutable audit trail; the UI shows the event hash
  and tx hash.
- **+** Graceful degradation means the chain is never a hard dependency for the demo.
- **−** Per-event anchoring is one transaction per event — fine locally, but too
  chatty/expensive at production volume.
- Follow-up: production should batch event hashes into a **Merkle root** anchored
  periodically (Future Scope).

## Alternatives considered

- **Append-only DB table / signed log file** — not independently tamper-evident.
- **Public testnet** — needs accounts, funds, and network; worse demo ergonomics.
- **Merkle batching now** — added complexity not needed to demonstrate the concept.
