# ADR-0008: SHA-256 hashing now, ML-DSA (post-quantum) deferred

- Status: Accepted
- Date: 2026-07-03
- Deciders: POC engineering

## Context

The reference architecture envisions post-quantum signatures (**ML-DSA**, FIPS 204)
for long-lived audit records. Full PQC integration is heavy (key management,
libraries, signature storage) and out of scope for a demo whose goal is to show the
detection→response→audit flow.

## Decision

Use **SHA-256** to hash the canonical event JSON before anchoring. Explicitly defer
**ML-DSA** to future work and note it in the docs and README "Future Scope".

## Consequences

- **+** Standard, ubiquitous, dependency-free hashing that fully demonstrates
  tamper-evident anchoring.
- **−** Hashing proves integrity but not signer identity/non-repudiation; ML-DSA
  would add authenticated, quantum-resistant signatures.
- Neutral: the anchoring interface (`chain.py`) can later hash-then-sign without
  changing the event flow.

## Alternatives considered

- **Implement ML-DSA now** — disproportionate effort for the POC; risks destabilising
  the core demo.
- **ECDSA signatures** — adds signing without the post-quantum property the
  architecture calls for; still deferred as future work.
