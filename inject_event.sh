#!/usr/bin/env bash
# Inject one deterministic scenario event through the scoring pipeline and print
# the result (score, band, cause, explanation, rules, chain anchor).
#
# Usage: ./inject_event.sh <normal|malicious-exfil|malicious-destroy|compromised|negligent>
# Each run uses a fresh session id so a previous block never refuses it (423).
set -e

API="${API:-http://127.0.0.1:8000}"
SCENARIO="${1:-malicious-destroy}"
USER="${USER_NAME:-dbadmin_priya}"
SESS="demo-${SCENARIO}-$(date +%s)"

# actor baselines (match seed.py) so identity features are meaningful
HOME_IP="10.0.1.5"; HOME_GEO="New York, US"; DEV="dev-priya-01"

case "$SCENARIO" in
  normal)
    BODY=$(cat <<JSON
{"username":"$USER","session_id":"$SESS","action_type":"record_view",
 "resource":"dashboard/home","record_count":2,"bytes_transferred":1000,
 "source_ip":"$HOME_IP","geo":"$HOME_GEO","device_id":"$DEV","matched_case_id":"CASE-1001"}
JSON
);;
  malicious-exfil)
    BODY=$(cat <<JSON
{"username":"$USER","session_id":"$SESS","action_type":"data_export",
 "resource":"core/customer_pii/account/100001","record_count":3000,"bytes_transferred":400000000,
 "source_ip":"$HOME_IP","geo":"$HOME_GEO","device_id":"$DEV","matched_case_id":null}
JSON
);;
  malicious-destroy)
    BODY=$(cat <<JSON
{"username":"$USER","session_id":"$SESS","action_type":"command_exec",
 "resource":"core/ledger","record_count":0,"bytes_transferred":0,
 "source_ip":"$HOME_IP","geo":"$HOME_GEO","device_id":"$DEV","matched_case_id":null,
 "command_text":"shred -u /data/ledger.db && history -c"}
JSON
);;
  compromised)
    # off-hours login from a new device + new IP + geo jump, but otherwise normal
    # action content -> identity anomaly => Compromised Account.
    OFFHOURS_TS="$(date -u +%Y-%m-%d)T03:$(date -u +%M:%S)"
    BODY=$(cat <<JSON
{"username":"$USER","session_id":"$SESS","action_type":"db_query","timestamp":"$OFFHOURS_TS",
 "resource":"account/4821","record_count":3,"bytes_transferred":4000,
 "source_ip":"185.220.101.55","geo":"Moscow, RU","device_id":"dev-unknown-9931","matched_case_id":null}
JSON
);;
  negligent)
    BODY=$(cat <<JSON
{"username":"$USER","session_id":"$SESS","action_type":"db_query",
 "resource":"core/customer_pii/account/4821","record_count":60,"bytes_transferred":1500000,
 "source_ip":"$HOME_IP","geo":"$HOME_GEO","device_id":"$DEV","matched_case_id":null}
JSON
);;
  *) echo "unknown scenario: $SCENARIO"; exit 1;;
esac

MFA_CODE=$(python3 -c "
import hmac, hashlib, time, struct, base64
key = base64.b32decode('JBSWY3DPEHPK3PXP')
counter = int(time.time()) // 30
h = hmac.new(key, struct.pack('>Q', counter), hashlib.sha1).digest()
offset = h[-1] & 0x0f
code = f'{(struct.unpack(\">I\", h[offset:offset+4])[0] & 0x7fffffff) % 1000000:06d}'
print(code)
")
TOK=$(curl -s -X POST "$API/auth/login" -H 'Content-Type: application/json' \
  -d "{\"username\":\"admin\",\"password\":\"admin123\",\"mfa_code\":\"$MFA_CODE\"}" | python3 -c "import sys,json;print(json.load(sys.stdin)['access_token'])")

echo -e "\033[0;34m=== scenario: $SCENARIO  (user=$USER session=$SESS) ===\033[0m"
curl -s -X POST "$API/ingest" -H "Authorization: Bearer $TOK" -H 'Content-Type: application/json' \
  -d "$BODY" | python3 -c "
import sys,json
e=json.load(sys.stdin)
if 'detail' in e: print('  ->', e['detail']); sys.exit()
print(f\"  risk score : {e['risk_score']} ({e['band']})   rule={e['rule_score']} ml={e['ml_score']}\")
print(f\"  cause      : {e['cause']}\")
print(f\"  rules fired: {[r['rule'] for r in (e.get('rules_fired') or [])]}\")
print(f\"  top feats  : {[f['feature'] for f in (e.get('top_features') or [])]}\")
if e.get('explanation'): print(f\"  explanation: {e['explanation']}\")
if e.get('recommended_action'): print(f\"  recommend  : {e['recommended_action']}\")
print(f\"  event hash : {e.get('event_hash')}\")
print(f\"  anchor tx  : {e.get('anchor_tx')}  (anchored={e.get('anchored')})\")"
