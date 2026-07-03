# Future scope

What the POC deliberately does **not** build, and how each would be approached in a
production system. Items 1–7 are the explicitly out-of-scope items from the brief;
items 8+ are the natural roadmap that follows from the POC's design seams.

> Guiding principle: the POC proves the **detection → cause → explanation → audit →
> response** loop end to end. Everything below hardens, scales, or extends that loop —
> none of it changes the core concept.

## Explicitly out of scope (from the brief)

### 1. eBPF / kernel-level telemetry
- **POC**: activity arrives as application-level events (simulator, API, CERT
  adapter).
- **Production**: eBPF probes capture syscalls, process exec, file, and network
  events in the kernel for high-fidelity, hard-to-evade telemetry.
- **Seam**: these become additional event sources feeding `ingest_event()`; the
  feature schema (`features.py`) extends with process/syscall features.
- **Effort**: High. **Risk**: kernel/version compatibility, performance overhead.

### 2. Kafka / message broker
- **POC**: in-process synchronous calls ([ADR-0011](adr/0011-in-process-no-kafka.md)).
- **Production**: a broker (Kafka/Redpanda) decouples collection → scoring →
  response, enabling backpressure, replay, and horizontal scale.
- **Seam**: the `ingest_event()` call path is the boundary; split into producer
  (collectors) and consumer (scoring workers) around a topic.
- **Effort**: Medium–High. **Payoff**: throughput, resilience, decoupling.

### 3. CCTV / physical-security integration
- **POC**: purely digital signals.
- **Production**: correlate badge-in/out and camera events with digital activity
  (e.g. bulk export while the user is not on premises → stronger compromise signal).
- **Seam**: new feature group (physical presence) + correlation rules in the rule
  layer.
- **Effort**: High (integrations, privacy/compliance).

### 4. `FLAG_SECURE` / OS-level screen-capture blocking
- **POC**: response is a **software session block** ([ADR-0013](adr/0013-session-based-response.md)).
- **Production**: on high risk, instruct the endpoint/OS to set `FLAG_SECURE`, lock
  the screen, or kill the session at the device — containment the app layer can't
  enforce.
- **Seam**: a new response action alongside `block`, dispatched to an endpoint agent.
- **Effort**: High (endpoint agent, OS APIs, MDM).

### 5. Post-quantum signatures (ML-DSA)
- **POC**: **SHA-256** hashing before anchoring ([ADR-0008](adr/0008-sha256-hashing-defer-ml-dsa.md)).
- **Production**: sign audit records with **ML-DSA (FIPS 204)** for authenticated,
  quantum-resistant non-repudiation (hashing proves integrity, not identity).
- **Seam**: `chain.py` hashes today; add hash-then-sign + signature storage/verify.
- **Effort**: Medium–High (key management, libraries, verification tooling).

### 6. Merkle-batched anchoring
- **POC**: **one hash per event** ([ADR-0007](adr/0007-blockchain-per-event-anchoring.md)).
- **Production**: accumulate event hashes into a **Merkle tree** and anchor the
  **root** periodically; store per-event inclusion proofs. Cuts transactions from
  O(events) to O(batches).
- **Seam**: `chain.py` gains a batcher; `AuditLog` stores roots; events store their
  Merkle proof.
- **Effort**: Medium. **Payoff**: cost/throughput at production volume.

### 7. MongoDB production datastore
- **POC**: **SQLite** behind SQLAlchemy ([ADR-0006](adr/0006-sqlite-storage.md)).
- **Production**: MongoDB (per the reference architecture) for scale and
  document-shaped event/feature payloads.
- **Seam**: the ORM/repository boundary; introduce a repository layer to abstract the
  document vs relational difference.
- **Effort**: Medium (not a drop-in — data-access rewrite behind the boundary).

## Delivered since the initial POC

Several model-depth items from the original roadmap are now **implemented**
([ADR-0015](adr/0015-model-personalization-and-evaluation.md)):

- **Per-user z-score personalization** (`records_z`, `velocity_z`, `export_z`) —
  deviation from each user's own baseline, not absolute thresholds.
- **Feature scaling** (`StandardScaler`) + **cyclical time encoding**
  (`hour_sin`/`hour_cos`); feature count 17 → 22.
- **Evaluation harness** (`evaluate.py` / `make evaluate`) — precision/recall/F1/AUC
  on injected threats, so tuning is measured.

## Roadmap beyond the brief

### 8. Model lifecycle: retraining, drift, monitoring
Building on the evaluation harness and per-user baselines above: scheduled retraining
on rolling baselines, drift detection on feature distributions and score bands,
**peer-group** baselines, and model versioning + A/B evaluation. Re-sweep `ML_ANCHOR`
when the training distribution shifts
([ADR-0005](adr/0005-score-blend-and-ml-calibration.md)).

### 8b. Ensemble & sequence models
Add LOF / One-Class SVM / an autoencoder alongside the Isolation Forest and combine
scores; explore LSTM/transformer models over the *sequence* of actions. Deferred in
[ADR-0015](adr/0015-model-personalization-and-evaluation.md) (non-tree models
complicate the SHAP path). Also: multi-resolution windows (5m/1h/24h/7d).

### 9. Supervised cause classifier
Once labelled incidents accumulate, replace/augment the heuristic buckets
([ADR-0014](adr/0014-cause-classification-strategy.md)) with a supervised
Malicious/Negligent/Compromised classifier, keeping the rule overrides as guardrails.

### 10. Real-time UI (WebSockets/SSE)
Replace 2.5 s polling ([ADR-0012](adr/0012-nextjs-polling-dashboard.md)) with push
updates for lower latency and less chatter at scale.

### 11. Identity & hardening
SSO/OIDC, MFA, token refresh/rotation + revocation, httpOnly cookies, CORS
allow-lists, rate limiting/lockout, and secrets management — see the "POC caveats"
table in [security.md](security.md).

### 12. Scale & reliability
Separate API tier from scoring workers, autoscaling, HA datastore, and a managed/HSM
signer for chain transactions instead of an unlocked dev account.

### 13. SOC ecosystem integration
Forward alerts to SIEM/SOAR, ticketing (ServiceNow/Jira), and chat (Slack/Teams);
support analyst triage workflows, case management, and feedback that trains the
models.

### 14. Data connectors
Productionize `data_adapter.py` into streaming connectors for real IAM/DB-audit/DLP/
EDR sources, beyond the CERT CSV mapping.

## Indicative phasing

| Phase | Theme | Items |
|-------|-------|-------|
| 1 | Productionize core | 7 (MongoDB), 11 (identity/hardening), 10 (real-time UI) |
| 2 | Scale the pipeline | 2 (broker), 12 (scale/HA), 8 (model lifecycle) |
| 3 | Fidelity & trust | 1 (eBPF), 6 (Merkle), 5 (ML-DSA), 9 (supervised cause) |
| 4 | Enterprise reach | 13 (SIEM/SOAR), 14 (connectors), 3 (physical), 4 (`FLAG_SECURE`) |

Phasing is indicative, not committed — sequence by the deployment environment's
priorities (compliance, scale, or telemetry fidelity first).
