"""Cause classification: Malicious Insider | Negligent User | Compromised Account.

Decision uses the SHAP-ranked top features plus which rules fired. We group
features into three signal buckets and pick the dominant cause.
"""
from __future__ import annotations

# feature -> signal bucket
IDENTITY_FEATURES = {
    "is_new_device", "is_new_ip", "geo_distance_km", "hour_of_day",
    "hour_sin", "hour_cos", "is_off_hours", "is_weekend",
}
EXFIL_EVASION_FEATURES = {
    "export_count_in_window", "export_volume_mb", "download_count_in_window",
    "sequential_access_score", "risky_command_flag", "records_accessed_in_window",
    "distinct_accounts_in_window", "records_z", "velocity_z", "export_z",
}
POLICY_FEATURES = {
    "no_ticket_flag", "sensitive_resource_access_count", "failed_action_ratio",
    "actions_per_minute",
}

MALICIOUS_RULES = {"bulk_export", "sequential_scraping", "destructive_command"}
COMPROMISE_RULES = {"new_device_and_ip"}
NEGLIGENT_RULES = {"no_ticket_high_risk", "off_hours_access"}


def classify_cause(features: dict, top_features: list[dict], rules_fired: list[dict]) -> str:
    """Return one of: 'Malicious Insider', 'Negligent User', 'Compromised Account'."""
    fired = {r["rule"] for r in rules_fired}

    # --- strong deterministic signals from rules first ---
    if fired & MALICIOUS_RULES:
        # destructive/exfil intent dominates unless it's purely identity-driven
        if "destructive_command" in fired or "bulk_export" in fired or "sequential_scraping" in fired:
            # but if the ONLY anomaly is identity + otherwise normal actions -> compromised
            identity_only = (
                fired & COMPROMISE_RULES
                and not (fired & {"bulk_export", "sequential_scraping", "destructive_command"} - COMPROMISE_RULES)
            )
            if not identity_only:
                return "Malicious Insider"

    # --- weight top SHAP features into buckets ---
    identity_w = exfil_w = policy_w = 0.0
    for tf in top_features:
        name = tf.get("feature")
        contrib = abs(float(tf.get("contribution", 0.0)))
        if name in IDENTITY_FEATURES:
            identity_w += contrib
        elif name in EXFIL_EVASION_FEATURES:
            exfil_w += contrib
        elif name in POLICY_FEATURES:
            policy_w += contrib

    # nudge with active rules
    if fired & COMPROMISE_RULES:
        identity_w += 1.0
    if fired & MALICIOUS_RULES:
        exfil_w += 1.0
    if fired & NEGLIGENT_RULES:
        policy_w += 0.5

    # Compromised: identity/context anomaly while action content is normal-ish
    action_content_normal = (
        features.get("export_volume_mb", 0) < 1
        and features.get("sequential_access_score", 0) < 0.6
        and features.get("risky_command_flag", 0) == 0
    )
    if (features.get("is_new_device", 0) and features.get("is_new_ip", 0)) and action_content_normal:
        return "Compromised Account"

    buckets = {
        "Compromised Account": identity_w,
        "Malicious Insider": exfil_w,
        "Negligent User": policy_w,
    }
    best = max(buckets, key=buckets.get)

    # If nothing meaningful fired and no exfil/identity signal, treat as negligent policy issue.
    if buckets[best] == 0.0:
        return "Negligent User"
    return best
