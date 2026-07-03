# ADR-0009: SHAP + LLM explanations with a deterministic fallback

- Status: Accepted
- Date: 2026-07-03
- Deciders: POC engineering

## Context

Analysts need to understand *why* an event is risky, in plain language, backed by
which features drove the score. The demo must not break if there is no LLM API key or
the network is down.

## Decision

1. Compute per-feature attributions with **`shap.TreeExplainer`** (fallback
   `KernelExplainer`) on the Isolation Forest; keep the **top 3** by |contribution|.
2. Build a compact JSON payload (user, action, score, band, cause, top features,
   fired rules) and send it to an **OpenAI-compatible LLM** via `httpx` for a short
   narrative + recommended action.
3. **If `LLM_API_KEY` is empty or the call fails, generate the narrative from a
   deterministic template** using the same payload. The response records
   `explanation_source: "llm" | "template"`.

## Consequences

- **+** Explanations are grounded in real SHAP attributions, not just prose.
- **+** The demo is fully functional offline/keyless; the LLM is an enhancement, not
  a dependency.
- **+** Provider-agnostic (any OpenAI-compatible endpoint via `LLM_BASE_URL`).
- **−** SHAP on some models can be slow; TreeExplainer keeps it fast for Isolation
  Forest, with a KernelExplainer fallback for safety.

## Alternatives considered

- **LLM-only narratives** — brittle (breaks without a key) and ungrounded.
- **Template-only** — robust but less natural; kept precisely as the fallback.
- **LIME** — SHAP has better tree support and additive attribution semantics here.
