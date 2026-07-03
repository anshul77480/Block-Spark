#!/usr/bin/env bash
# End-to-end manual verification against a running backend (default :8000).
set -e
API="${API:-http://127.0.0.1:8000}"
say() { echo -e "\n\033[0;34m=== $* ===\033[0m"; }

say "1. Health (model loaded + chain connected?)"
curl -s "$API/health"; echo

say "2. Login as admin -> JWT"
TOK=$(curl -s -X POST "$API/auth/login" -H 'Content-Type: application/json' \
  -d '{"username":"admin","password":"admin123"}' | python3 -c "import sys,json;print(json.load(sys.stdin)['access_token'])")
echo "token: ${TOK:0:24}..."
AUTH="Authorization: Bearer $TOK"

say "3. Start simulator (fast, high threat rate) and let it run 12s"
curl -s -X POST "$API/simulator/control" -H "$AUTH" -H 'Content-Type: application/json' \
  -d '{"action":"start","rate_seconds":0.4,"threat_probability":0.6}'; echo
sleep 12
curl -s -X POST "$API/simulator/control" -H "$AUTH" -H 'Content-Type: application/json' \
  -d '{"action":"stop"}'; echo

say "4. Stats (events by band, causes, anchored, blocked)"
curl -s "$API/stats" -H "$AUTH" | python3 -m json.tool

say "5. Recent scored events (score / band / cause / anchored)"
curl -s "$API/events?limit=8" -H "$AUTH" | python3 -c "
import sys,json
for e in json.load(sys.stdin):
    print(f\"  #{e['id']} {e['band']:6} score={e['risk_score']:5} cause={str(e['cause']):20} anchored={e['anchored']} tx={str(e['anchor_tx'])[:14]}\")"

say "6. A high-risk event in full (cause + explanation + rules + chain anchor)"
curl -s "$API/events?limit=60&band=high" -H "$AUTH" | python3 -c "
import sys,json
evs=json.load(sys.stdin)
if not evs: print('  (no high-risk events this run — re-run; threat scenarios are random)'); sys.exit()
e=evs[0]
print(f\"  user       : {e['username']} ({e['role']})\")
print(f\"  action     : {e['action_type']} on {e['resource']}\")
print(f\"  risk score : {e['risk_score']} ({e['band']})  rule={e['rule_score']} ml={e['ml_score']}\")
print(f\"  cause      : {e['cause']}\")
print(f\"  rules fired: {[r['rule'] for r in (e['rules_fired'] or [])]}\")
print(f\"  top feats  : {[f['feature'] for f in (e['top_features'] or [])]}\")
print(f\"  explanation: {e['explanation']}\")
print(f\"  recommend  : {e['recommended_action']}\")
print(f\"  event hash : {e['event_hash']}\")
print(f\"  anchor tx  : {e['anchor_tx']}\")"

say "7. Open alerts"
curl -s "$API/alerts?status=open" -H "$AUTH" | python3 -c "
import sys,json
al=json.load(sys.stdin)
print(f'  {len(al)} open alerts')
for a in al[:5]: print(f\"   - {a['username']:16} {a['band']:6} {str(a['cause']):20} :: {a['message'][:70]}\")"

say "8. Sessions (blocked = high-risk auto-response)"
curl -s "$API/sessions" -H "$AUTH" | python3 -c "
import sys,json
for s in json.load(sys.stdin):
    if not s['session_id'].endswith('-baseline'):
        print(f\"  {s['username']:16} {s['status']:8} reauth={s['requires_reauth']}\")"

say "9. Response enforcement: ingest to a BLOCKED session should return 423"
BLK=$(curl -s "$API/sessions" -H "$AUTH" | python3 -c "
import sys,json
for s in json.load(sys.stdin):
    if s['status']=='blocked' and not s['session_id'].endswith('-baseline'):
        print(s['session_id']); break")
if [ -n "$BLK" ]; then
  echo "  blocked session: $BLK"
  code=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$API/ingest" -H "$AUTH" -H 'Content-Type: application/json' \
    -d "{\"username\":\"${BLK%-session}\",\"session_id\":\"$BLK\",\"action_type\":\"record_view\",\"resource\":\"account/1\"}")
  echo "  ingest to blocked session -> HTTP $code  (expect 423)"
  say "10. Admin unblock, then ingest should return 200"
  curl -s -X POST "$API/sessions/action" -H "$AUTH" -H 'Content-Type: application/json' \
    -d "{\"session_id\":\"$BLK\",\"action\":\"unblock\",\"reason\":\"cleared\"}" >/dev/null
  code=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$API/ingest" -H "$AUTH" -H 'Content-Type: application/json' \
    -d "{\"username\":\"${BLK%-session}\",\"session_id\":\"$BLK\",\"action_type\":\"record_view\",\"resource\":\"account/1\",\"matched_case_id\":\"CASE-1\"}")
  echo "  ingest after unblock -> HTTP $code  (expect 200)"
else
  echo "  (no blocked session this run — high-risk scenarios are random; re-run)"
fi

say "11. Chain audit log (total anchored records on-chain)"
curl -s "$API/chain/status" -H "$AUTH" | python3 -m json.tool

echo -e "\n\033[0;32mEnd-to-end check complete.\033[0m"
