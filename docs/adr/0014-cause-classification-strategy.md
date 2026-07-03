# ADR-0014: Cause classification strategy

- Status: Accepted
- Date: 2026-07-03
- Deciders: POC engineering

## Context

A risk score alone doesn't tell an analyst *what kind* of threat this is. The three
archetypes — **Malicious Insider**, **Negligent User**, **Compromised Account** —
imply very different responses (investigate vs retrain vs reset credentials). We need
a transparent, defensible way to pick one, using signals we already compute.

## Decision

Classify in `cause.py` using **feature buckets + rule overrides** (no separate ML
model):

1. Group features into **identity/context**, **exfil/evasion**, and **policy**
   buckets.
2. **Rule overrides first**: destructive/exfil/scraping rules ⇒ **Malicious
   Insider**; a pure identity anomaly (new device **and** new IP) with normal action
   content ⇒ **Compromised Account**.
3. Otherwise, sum |SHAP contribution| per bucket, nudge by fired rules, and pick the
   dominant bucket.
4. Default to **Negligent User** when nothing meaningful dominates.

Returns the cause plus the top-3 contributing features for the explanation layer.

## Consequences

- **+** Fully explainable and deterministic; reuses existing features/SHAP/rules —
  no extra model to train or label.
- **+** The overrides encode strong domain priors (a `shred` command is malicious; a
  foreign-device login with normal actions is compromise).
- **−** Heuristic boundaries can misclassify ambiguous cases (e.g. negligent vs
  compromised). Acceptable and tunable for a POC; a supervised cause classifier is a
  future option if labels become available.
- Only computed for **medium/high** events (low events carry no cause).

## Alternatives considered

- **Supervised multi-class classifier** — needs labelled causes; not available.
- **LLM-only classification** — non-deterministic and unauditable for this decision.
