# ADR-0002: Python + FastAPI for the backend & ML

- Status: Accepted
- Date: 2026-07-03
- Deciders: POC engineering

## Context

The core deliverable is an ML-driven risk engine (Isolation Forest, SHAP) that also
exposes an HTTP API, handles auth, ingests activity, and talks to a blockchain node.
The ML ecosystem (scikit-learn, SHAP, pandas, numpy) is Python-first.

## Decision

Implement the backend as a **single Python 3.11 service using FastAPI + Uvicorn**.
The same process hosts the API, the activity simulator, feature engineering, the risk
engine, cause classification, explanations, and the web3.py chain client.

## Consequences

- **+** ML libraries are native; no cross-language boundary for scoring/SHAP.
- **+** FastAPI gives typed Pydantic schemas, dependency-injected auth, and free
  OpenAPI docs at `/docs`.
- **+** One service is easy to run and reason about for a POC.
- **−** A single process couples API and ML/compute; production would separate the
  scoring workers from the API tier.
- Pinned, mutually compatible versions are required because SHAP/numpy/scikit-learn
  are version-sensitive (verified by `smoke_test.py`).

## Alternatives considered

- **Node/TS backend calling a Python ML sidecar** — extra service and IPC for no POC
  benefit.
- **Flask/Django** — FastAPI's async, typing, and OpenAPI ergonomics are a better fit.
