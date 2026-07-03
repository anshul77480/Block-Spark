"""SHAP feature attribution + LLM narrative (with deterministic template fallback)."""
from __future__ import annotations

from typing import Optional

import httpx
import numpy as np

from .config import settings
from .features import FEATURE_ORDER, features_to_vector

_explainer = None


def _get_explainer(model):
    """Build (and cache) a SHAP explainer for the Isolation Forest.

    Accepts either a bare sklearn estimator or the CalibratedModel wrapper.
    TreeExplainer supports sklearn IsolationForest; fall back to KernelExplainer.
    """
    global _explainer
    if _explainer is not None:
        return _explainer
    import shap

    est = getattr(model, "model", model)  # unwrap CalibratedModel
    try:
        _explainer = shap.TreeExplainer(est)
    except Exception:
        # KernelExplainer needs a background set; use a tiny neutral baseline.
        background = np.zeros((1, len(FEATURE_ORDER)))
        _explainer = shap.KernelExplainer(est.decision_function, background)
    return _explainer


def top_feature_attributions(features: dict, model, k: int = 3) -> list[dict]:
    """Return the top-k features by |SHAP contribution|.

    Falls back to |value|-based ranking if SHAP is unavailable or errors.
    """
    vec = np.array([features_to_vector(features)], dtype=float)
    if model is not None:
        try:
            explainer = _get_explainer(model)
            # SHAP runs on the model's input space (scaled), but we display the
            # original feature values for interpretability.
            scaled = model.transform(vec) if hasattr(model, "transform") else vec
            shap_vals = explainer.shap_values(scaled)
            arr = np.array(shap_vals)
            if arr.ndim == 2:
                arr = arr[0]
            contribs = list(zip(FEATURE_ORDER, vec[0], np.array(arr).ravel()[: len(FEATURE_ORDER)]))
            contribs.sort(key=lambda t: abs(t[2]), reverse=True)
            return [
                {"feature": f, "value": round(float(v), 3), "contribution": round(float(c), 5)}
                for f, v, c in contribs[:k]
            ]
        except Exception:
            pass
    # fallback: rank non-zero features by magnitude
    vals = [(f, float(features.get(f, 0.0))) for f in FEATURE_ORDER]
    vals.sort(key=lambda t: abs(t[1]), reverse=True)
    return [{"feature": f, "value": round(v, 3), "contribution": round(v, 5)} for f, v in vals[:k]]


def build_payload(event: dict, scoring: dict, cause: str, top_features: list[dict]) -> dict:
    return {
        "user": event.get("username"),
        "role": event.get("role"),
        "action": event.get("action_type"),
        "resource": event.get("resource"),
        "record_count": event.get("record_count"),
        "geo": event.get("geo"),
        "device_id": event.get("device_id"),
        "source_ip": event.get("source_ip"),
        "matched_case_id": event.get("matched_case_id"),
        "risk_score": scoring["risk_score"],
        "band": scoring["band"],
        "cause": cause,
        "top_features": top_features,
        "rules_fired": [r["rule"] for r in scoring.get("rules_fired", [])],
    }


# ---------- narrative ----------
_LLM_SYSTEM = (
    "You are a SOC analyst assistant for a bank. Given a JSON insider-threat "
    "alert, write a concise plain-English narrative (3-4 sentences) of the likely "
    "threat sequence, then on a new line 'Recommended action: <one action>'. "
    "Be specific and reference the concrete signals."
)


def _template_narrative(payload: dict) -> tuple[str, str]:
    """Deterministic fallback used when no LLM key is configured."""
    rules = payload.get("rules_fired", [])
    tf = ", ".join(f["feature"] for f in payload.get("top_features", [])) or "behavioural anomalies"
    cause = payload["cause"]
    who = f"{payload.get('user')} ({payload.get('role')})"
    action = payload.get("action")
    resource = payload.get("resource") or "a resource"

    lead = (
        f"{who} triggered a {payload['band'].upper()}-risk alert (score "
        f"{payload['risk_score']}) while performing '{action}' on {resource}. "
    )
    drivers = f"The score was driven primarily by {tf}. "

    cause_line = {
        "Malicious Insider": (
            "The pattern (bulk movement / sequential access / destructive commands) "
            "indicates deliberate exfiltration or evasion consistent with a malicious insider. "
        ),
        "Compromised Account": (
            "The anomaly is dominated by identity and context signals (new device / new network / "
            "unusual time) while the actions still resemble the user's normal role, suggesting "
            "the account may be compromised by stolen credentials. "
        ),
        "Negligent User": (
            "There is no evidence of evasion or exfiltration intent; this looks like a policy "
            "violation (e.g. acting without a ticket) rather than an attack. "
        ),
    }.get(cause, "")

    fired_txt = (
        "Rules fired: " + ", ".join(rules) + ". " if rules else ""
    )
    narrative = lead + drivers + cause_line + fired_txt

    action_map = {
        "Malicious Insider": "Immediately block the session, preserve logs, and open a HR/legal investigation.",
        "Compromised Account": "Force re-authentication + MFA, block the session, and reset credentials.",
        "Negligent User": "Alert the user's manager, require a ticket, and deliver policy retraining.",
    }
    recommended = action_map.get(cause, "Escalate to a SOC analyst for review.")
    return narrative.strip(), recommended


def _call_llm(payload: dict) -> Optional[tuple[str, str]]:
    if not settings.LLM_API_KEY:
        return None
    import json
    try:
        resp = httpx.post(
            f"{settings.LLM_BASE_URL}/chat/completions",
            headers={
                "Authorization": f"Bearer {settings.LLM_API_KEY}",
                "Content-Type": "application/json",
            },
            json={
                "model": settings.LLM_MODEL,
                "messages": [
                    {"role": "system", "content": _LLM_SYSTEM},
                    {"role": "user", "content": json.dumps(payload)},
                ],
                "temperature": 0.2,
                "max_tokens": 300,
            },
            timeout=20.0,
        )
        resp.raise_for_status()
        text = resp.json()["choices"][0]["message"]["content"].strip()
        # split recommended action if present
        if "Recommended action:" in text:
            narrative, rec = text.split("Recommended action:", 1)
            return narrative.strip(), rec.strip()
        return text, "Escalate to a SOC analyst for review."
    except Exception:
        return None


def explain(event: dict, scoring: dict, cause: str, model) -> dict:
    """Produce top_features, plain-English narrative, and recommended action."""
    top_features = top_feature_attributions(event.get("features", {}), model, k=3)
    payload = build_payload(event, scoring, cause, top_features)

    llm = _call_llm(payload)
    if llm is not None:
        narrative, recommended = llm
        source = "llm"
    else:
        narrative, recommended = _template_narrative(payload)
        source = "template"

    return {
        "top_features": top_features,
        "explanation": narrative,
        "recommended_action": recommended,
        "explanation_source": source,
    }
