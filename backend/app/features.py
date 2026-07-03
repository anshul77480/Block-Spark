"""Feature engineering: turn a raw event + the user's recent activity window into
a fixed numeric feature vector used by both the rule engine and the Isolation Forest.

The FEATURE_ORDER list is the canonical column order for the ML model — keep it
stable between training (train_model.py) and inference.
"""
from __future__ import annotations

import math
from datetime import datetime, timedelta
from typing import Optional

# Canonical feature order for the ML model. DO NOT reorder without retraining.
# Groups: raw/context features, then cyclical time, then per-user z-scores.
FEATURE_ORDER = [
    "hour_of_day",
    "hour_sin",                       # cyclical time encoding (so 23:00 ~ 01:00)
    "hour_cos",
    "is_off_hours",
    "is_weekend",
    "geo_distance_km",
    "is_new_device",
    "is_new_ip",
    "records_accessed_in_window",
    "distinct_accounts_in_window",
    "sequential_access_score",
    "export_count_in_window",
    "export_volume_mb",
    "download_count_in_window",
    "sensitive_resource_access_count",
    "risky_command_flag",
    "no_ticket_flag",
    "failed_action_ratio",
    "actions_per_minute",
    "records_z",                      # per-user personalization: deviation from the
    "velocity_z",                     # user's OWN baseline (z-score), not an absolute
    "export_z",
]

# z-score feature -> the raw feature it standardises against the user's baseline.
Z_SOURCE = {
    "records_z": "records_accessed_in_window",
    "velocity_z": "actions_per_minute",
    "export_z": "export_volume_mb",
}

WINDOW_MINUTES = 30
BUSINESS_START = 9
BUSINESS_END = 18
BULK_EXPORT_RECORDS = 500
BULK_EXPORT_MB = 50.0

SENSITIVE_KEYWORDS = (
    "pii", "ssn", "account", "customer", "core", "ledger", "card",
    "salary", "kyc", "credentials", "vault",
)
HIGH_RISK_ACTIONS = {"data_export", "file_download", "command_exec", "db_query"}
RISKY_COMMAND_PATTERNS = (
    "rm -rf", "shred", " dd ", "dd if=", "chattr", "chmod 777", "chmod -r 777",
    "history -c", "truncate", "> /var/log", "unset histfile", "wipe", "srm",
)


def _haversine_km(lat1, lon1, lat2, lon2) -> float:
    r = 6371.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlmb = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dlmb / 2) ** 2
    return 2 * r * math.asin(min(1.0, math.sqrt(a)))


# Rough lat/lon lookup for the demo geos the simulator/adapter emit.
GEO_COORDS = {
    "New York, US": (40.7128, -74.0060),
    "Newark, US": (40.7357, -74.1724),
    "Chicago, US": (41.8781, -87.6298),
    "San Francisco, US": (37.7749, -122.4194),
    "London, UK": (51.5074, -0.1278),
    "Moscow, RU": (55.7558, 37.6173),
    "Beijing, CN": (39.9042, 116.4074),
    "Lagos, NG": (6.5244, 3.3792),
    "Kyiv, UA": (50.4501, 30.5234),
    "Unknown": (0.0, 0.0),
}


def _geo_to_coords(geo: Optional[str]) -> tuple[float, float]:
    if geo and geo in GEO_COORDS:
        return GEO_COORDS[geo]
    return GEO_COORDS["Unknown"]


def _sequential_score(account_ids: list[int]) -> float:
    """0..1 — how close the accessed account IDs are to a monotonic run.
    High => scraping consecutive records."""
    ids = [a for a in account_ids if a is not None]
    if len(ids) < 3:
        return 0.0
    ordered = sorted(ids)
    consec = sum(1 for i in range(1, len(ordered)) if ordered[i] - ordered[i - 1] == 1)
    return round(consec / (len(ordered) - 1), 4)


def _extract_account_id(resource: Optional[str]) -> Optional[int]:
    """Pull a trailing integer out of a resource string like 'account/100245'."""
    if not resource:
        return None
    digits = ""
    for ch in reversed(resource):
        if ch.isdigit():
            digits = ch + digits
        elif digits:
            break
    return int(digits) if digits else None


def is_risky_command(command_text: Optional[str]) -> bool:
    if not command_text:
        return False
    low = command_text.lower()
    return any(p in low for p in RISKY_COMMAND_PATTERNS)


def is_sensitive_resource(resource: Optional[str]) -> bool:
    if not resource:
        return False
    low = resource.lower()
    return any(k in low for k in SENSITIVE_KEYWORDS)


def compute_features(event: dict, recent: list[dict], user_baseline: dict) -> dict:
    """Build the numeric feature vector.

    event         : the raw event dict (RawEvent-shaped) currently being scored.
    recent        : list of that user's recent raw event dicts (within the window),
                    each with at least action_type/resource/record_count/
                    bytes_transferred/matched_case_id/timestamp.
    user_baseline : {baseline_lat, baseline_lon, home_ip, known_devices}.
    """
    ts: datetime = event.get("timestamp") or datetime.utcnow()
    if isinstance(ts, str):
        ts = datetime.fromisoformat(ts)

    window_start = ts - timedelta(minutes=WINDOW_MINUTES)
    window = [
        e for e in recent
        if (e.get("timestamp") or ts) >= window_start
    ] + [event]

    hour = ts.hour
    hour_sin = math.sin(2 * math.pi * hour / 24.0)
    hour_cos = math.cos(2 * math.pi * hour / 24.0)
    is_off_hours = 1 if (hour < BUSINESS_START or hour >= BUSINESS_END) else 0
    is_weekend = 1 if ts.weekday() >= 5 else 0

    # geo
    ev_lat, ev_lon = _geo_to_coords(event.get("geo"))
    base_lat = user_baseline.get("baseline_lat", 40.7128)
    base_lon = user_baseline.get("baseline_lon", -74.0060)
    geo_distance_km = round(_haversine_km(base_lat, base_lon, ev_lat, ev_lon), 2)

    # device / ip novelty
    known_devices = set(user_baseline.get("known_devices") or [])
    dev = event.get("device_id")
    is_new_device = 1 if (dev and dev not in known_devices) else 0
    home_ip = user_baseline.get("home_ip", "")
    src_ip = event.get("source_ip") or ""
    # "same subnet" = first three octets match
    def _subnet(ip: str) -> str:
        return ".".join(ip.split(".")[:3]) if ip.count(".") == 3 else ip
    is_new_ip = 1 if (src_ip and _subnet(src_ip) != _subnet(home_ip)) else 0

    # windowed aggregates
    records_accessed = sum(int(e.get("record_count") or 0) for e in window)
    account_ids = [_extract_account_id(e.get("resource")) for e in window]
    distinct_accounts = len({a for a in account_ids if a is not None})
    sequential_access_score = _sequential_score(account_ids)

    exports = [e for e in window if e.get("action_type") == "data_export"]
    export_count = len(exports)
    export_volume_mb = round(sum(int(e.get("bytes_transferred") or 0) for e in exports) / 1_000_000, 3)

    downloads = [e for e in window if e.get("action_type") == "file_download"]
    download_count = len(downloads)

    sensitive_count = sum(1 for e in window if is_sensitive_resource(e.get("resource")))

    risky_command_flag = 1 if is_risky_command(event.get("command_text")) else 0

    high_risk = event.get("action_type") in HIGH_RISK_ACTIONS
    no_ticket_flag = 1 if (high_risk and not event.get("matched_case_id")) else 0

    failed = sum(1 for e in window if str(e.get("action_type", "")).endswith("_failed")
                 or e.get("status") == "failed")
    failed_action_ratio = round(failed / len(window), 3) if window else 0.0

    # actions per minute across the window
    span_min = max(1.0, WINDOW_MINUTES)
    actions_per_minute = round(len(window) / span_min, 3)

    features = {
        "hour_of_day": float(hour),
        "hour_sin": float(hour_sin),
        "hour_cos": float(hour_cos),
        "is_off_hours": float(is_off_hours),
        "is_weekend": float(is_weekend),
        "geo_distance_km": float(geo_distance_km),
        "is_new_device": float(is_new_device),
        "is_new_ip": float(is_new_ip),
        "records_accessed_in_window": float(records_accessed),
        "distinct_accounts_in_window": float(distinct_accounts),
        "sequential_access_score": float(sequential_access_score),
        "export_count_in_window": float(export_count),
        "export_volume_mb": float(export_volume_mb),
        "download_count_in_window": float(download_count),
        "sensitive_resource_access_count": float(sensitive_count),
        "risky_command_flag": float(risky_command_flag),
        "no_ticket_flag": float(no_ticket_flag),
        "failed_action_ratio": float(failed_action_ratio),
        "actions_per_minute": float(actions_per_minute),
        # per-user z-scores default to 0.0; filled in from the user's activity_stats
        "records_z": 0.0,
        "velocity_z": 0.0,
        "export_z": 0.0,
    }
    apply_user_zscores(features, user_baseline.get("activity_stats"))
    return features


def zscore(value: float, mean: Optional[float], std: Optional[float]) -> float:
    """Standardise a value against a baseline mean/std, clamped to [-6, 6]."""
    if mean is None or std is None or std < 1e-6:
        return 0.0
    return max(-6.0, min(6.0, (value - mean) / std))


def apply_user_zscores(features: dict, activity_stats: Optional[dict]) -> dict:
    """Fill in the per-user z-score features from the user's activity_stats:
    {source_feature: {"mean": m, "std": s}}. No stats => z stays 0 (no signal)."""
    stats = activity_stats or {}
    for zkey, src in Z_SOURCE.items():
        m = stats.get(src) or {}
        features[zkey] = float(zscore(features.get(src, 0.0), m.get("mean"), m.get("std")))
    return features


def compute_activity_stats(feature_dicts: list[dict]) -> dict:
    """Compute {source_feature: {mean, std}} over a user's baseline feature vectors,
    used to standardise future activity (personalization)."""
    import statistics

    stats: dict = {}
    for src in set(Z_SOURCE.values()):
        vals = [float(f.get(src, 0.0)) for f in feature_dicts]
        if len(vals) >= 2:
            stats[src] = {"mean": statistics.fmean(vals), "std": statistics.pstdev(vals)}
        elif vals:
            stats[src] = {"mean": vals[0], "std": 0.0}
        else:
            stats[src] = {"mean": 0.0, "std": 0.0}
    return stats


def features_to_vector(features: dict) -> list[float]:
    """Ordered numeric vector for the ML model."""
    return [float(features.get(name, 0.0)) for name in FEATURE_ORDER]
