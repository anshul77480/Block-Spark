# Architecture Decision Records

ADRs capture significant decisions, their context, and their consequences. Format is
based on [Michael Nygard's ADR template](https://cognitect.com/blog/2011/11/15/documenting-architecture-decisions).
They are **append-only**: to change a decision, add a new ADR and mark the old one
`Superseded by ADR-XXXX`.

## Status legend

`Proposed` · `Accepted` · `Deprecated` · `Superseded`

## Index

| ADR | Title | Status |
|-----|-------|--------|
| [0001](0001-monorepo-three-services.md) | Monorepo with three services | Accepted |
| [0002](0002-python-fastapi-backend.md) | Python + FastAPI for backend & ML | Accepted |
| [0003](0003-hybrid-risk-engine.md) | Hybrid risk engine (rules + ML) | Accepted |
| [0004](0004-isolation-forest.md) | Isolation Forest for anomaly detection | Accepted |
| [0005](0005-score-blend-and-ml-calibration.md) | 0.5/0.5 blend and `ML_ANCHOR` calibration | Accepted |
| [0006](0006-sqlite-storage.md) | SQLite for POC storage (MongoDB later) | Accepted |
| [0007](0007-blockchain-per-event-anchoring.md) | Local chain + per-event anchoring | Accepted |
| [0008](0008-sha256-hashing-defer-ml-dsa.md) | SHA-256 now, ML-DSA deferred | Accepted |
| [0009](0009-shap-llm-explanations.md) | SHAP + LLM explanations w/ fallback | Accepted |
| [0010](0010-jwt-bcrypt-rbac.md) | JWT + bcrypt + role-based access | Accepted |
| [0011](0011-in-process-no-kafka.md) | In-process orchestration, no Kafka | Accepted |
| [0012](0012-nextjs-polling-dashboard.md) | Next.js dashboard with polling | Accepted |
| [0013](0013-session-based-response.md) | Session-based risk response | Accepted |
| [0014](0014-cause-classification-strategy.md) | Cause classification strategy | Accepted |
| [0015](0015-model-personalization-and-evaluation.md) | Personalization, feature scaling & evaluation | Accepted |

## Template

```markdown
# ADR-XXXX: <title>

- Status: Proposed | Accepted | Deprecated | Superseded by ADR-YYYY
- Date: YYYY-MM-DD
- Deciders: <who>

## Context
<forces at play, constraints, problem being solved>

## Decision
<the choice made, in active voice>

## Consequences
<positive, negative, and neutral outcomes; follow-ups>

## Alternatives considered
<options rejected and why>
```
