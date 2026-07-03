"""Map the Kaggle CERT Insider Threat dataset onto our raw-event feature schema.

The CERT dataset ships several CSVs (logon.csv, device.csv, file.csv, http.csv,
email.csv) plus LDAP. Because the Isolation Forest is unsupervised, we train the
baseline on NORMAL behaviour only — labels are not required.

This adapter is deliberately dependency-light: point it at a folder of CERT CSVs
and it yields raw-event dicts shaped like schemas.RawEvent, which you can push
through app.ingest.ingest_event or persist as baseline.

Usage:
    python data_adapter.py /path/to/cert_csvs --limit 5000 --ingest
The simulator remains fully functional, so the demo is never blocked on a download.
"""
from __future__ import annotations

import argparse
import csv
import os
from datetime import datetime
from typing import Iterator, Optional

# CERT timestamp format e.g. "01/02/2010 07:11:45"
CERT_TS_FORMATS = ["%m/%d/%Y %H:%M:%S", "%m/%d/%Y %H:%M"]


def _parse_ts(value: str) -> Optional[datetime]:
    for fmt in CERT_TS_FORMATS:
        try:
            return datetime.strptime(value.strip(), fmt)
        except (ValueError, AttributeError):
            continue
    return None


def _read_csv(path: str) -> Iterator[dict]:
    if not os.path.exists(path):
        return
    with open(path, newline="", encoding="utf-8", errors="ignore") as f:
        for row in csv.DictReader(f):
            yield row


def logon_events(folder: str) -> Iterator[dict]:
    for r in _read_csv(os.path.join(folder, "logon.csv")):
        act = (r.get("activity") or "").lower()
        yield {
            "username": r.get("user"),
            "role": "employee",
            "action_type": "login" if "logon" in act else "logout",
            "resource": r.get("pc"),
            "record_count": 0,
            "bytes_transferred": 0,
            "source_ip": None,
            "geo": "Pune, IN",
            "device_id": r.get("pc"),
            "matched_case_id": None,
            "command_text": None,
            "timestamp": _parse_ts(r.get("date", "")),
        }


def device_events(folder: str) -> Iterator[dict]:
    for r in _read_csv(os.path.join(folder, "device.csv")):
        act = (r.get("activity") or "").lower()
        yield {
            "username": r.get("user"),
            "role": "employee",
            "action_type": "file_download" if "connect" in act else "logout",
            "resource": f"usb/{r.get('pc')}",
            "record_count": 0,
            "bytes_transferred": 0,
            "source_ip": None,
            "geo": "Pune, IN",
            "device_id": r.get("pc"),
            "matched_case_id": None,
            "command_text": None,
            "timestamp": _parse_ts(r.get("date", "")),
        }


def file_events(folder: str) -> Iterator[dict]:
    for r in _read_csv(os.path.join(folder, "file.csv")):
        content = r.get("content") or ""
        yield {
            "username": r.get("user"),
            "role": "employee",
            "action_type": "data_export",
            "resource": f"file/{r.get('filename')}",
            "record_count": 0,
            "bytes_transferred": len(content),
            "source_ip": None,
            "geo": "Pune, IN",
            "device_id": r.get("pc"),
            "matched_case_id": None,
            "command_text": None,
            "timestamp": _parse_ts(r.get("date", "")),
        }


def http_events(folder: str) -> Iterator[dict]:
    for r in _read_csv(os.path.join(folder, "http.csv")):
        yield {
            "username": r.get("user"),
            "role": "employee",
            "action_type": "record_view",
            "resource": (r.get("url") or "")[:120],
            "record_count": 1,
            "bytes_transferred": len(r.get("content") or ""),
            "source_ip": None,
            "geo": "Pune, IN",
            "device_id": r.get("pc"),
            "matched_case_id": None,
            "command_text": None,
            "timestamp": _parse_ts(r.get("date", "")),
        }


ADAPTERS = {
    "logon": logon_events,
    "device": device_events,
    "file": file_events,
    "http": http_events,
}


def iter_events(folder: str, limit: Optional[int] = None) -> Iterator[dict]:
    count = 0
    for name, fn in ADAPTERS.items():
        for ev in fn(folder):
            if ev.get("timestamp") is None or not ev.get("username"):
                continue
            yield ev
            count += 1
            if limit and count >= limit:
                return


def main():
    ap = argparse.ArgumentParser(description="Map CERT CSVs to raw events")
    ap.add_argument("folder", help="folder containing CERT CSVs")
    ap.add_argument("--limit", type=int, default=2000)
    ap.add_argument("--ingest", action="store_true",
                    help="push mapped events through the scoring pipeline")
    args = ap.parse_args()

    events = list(iter_events(args.folder, args.limit))
    print(f"[adapter] mapped {len(events)} CERT rows to raw events")

    if args.ingest:
        from app.db import SessionLocal, init_db
        from app.ingest import ingest_event
        init_db()
        db = SessionLocal()
        try:
            for ev in events:
                ingest_event(db, ev)
        finally:
            db.close()
        print(f"[adapter] ingested {len(events)} events through the risk pipeline")
    else:
        for ev in events[:5]:
            print(ev)
        print("(preview only; pass --ingest to score & store)")


if __name__ == "__main__":
    main()
