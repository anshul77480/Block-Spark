# Operations runbook

## 1. Prerequisites

- Python 3.11+ (3.11 recommended; 3.12 works), Node 18+, `curl`.
- For the Docker path: Docker + Docker Compose.

## 2. Start / stop

### Script (local processes)
```
./setup.sh                # install (idempotent) + start everything, stream logs
./setup.sh --skip-install # start without reinstalling
./setup.sh --stop         # stop all services
```
Or via `make`: `make run` / `make up` / `make stop` / `make restart`.

### Docker
```
docker compose up --build     # or: make docker-up
docker compose down -v        # or: make docker-down
```

### Fresh state (aligned counts for a clean demo)
```
make reset      # stop + wipe DB/model/chain address + start clean
```

## 3. Configuration (`backend/.env`)

| Var | Default | Purpose |
|-----|---------|---------|
| `JWT_SECRET` | dev value | JWT signing key |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | 480 | token TTL |
| `DATABASE_URL` | `sqlite:///./insider_threat.db` | datastore |
| `LLM_API_KEY` | *(empty)* | if empty → template explanations |
| `LLM_BASE_URL` / `LLM_MODEL` | OpenRouter / gpt-4o-mini | LLM endpoint |
| `RPC_URL` | `http://127.0.0.1:8545` | chain node |
| `CONTRACT_ADDRESS` / `CONTRACT_ADDRESS_FILE` | *(file)* | contract address source |
| `CHAIN_ENABLED` | `true` | set `false` to run without the chain |
| `ADMIN_USERNAME` / `ADMIN_PASSWORD` | `admin` / `admin123` | seeded admin |

Frontend: `NEXT_PUBLIC_API_URL` (browser-visible; must reach the backend).

## 4. First-run sequence (what the tooling does)

1. Start Hardhat node → deploy `AuditLog` → write contract address.
2. `python -m app.seed` — create admin, actor employees, baseline activity.
3. `python train_model.py` — train + calibrate the Isolation Forest.
4. Start backend (`uvicorn`) then frontend (`next`).

## 5. Verification

```
make smoke     # imports + train + score one normal & one malicious event
make e2e       # full API walkthrough against the running backend
make evaluate  # detection metrics: precision/recall/F1/AUC on injected threats
make health    # backend health JSON
make stats     # events by band, causes, blocked, anchored
```

Demo scenarios (deterministic):
```
make scenario-normal | scenario-negligent | scenario-compromised
make scenario-malicious-exfil | scenario-malicious-destroy | demo-all
```

## 6. Troubleshooting

| Symptom | Likely cause | Fix |
|---------|--------------|-----|
| `chain_status != connected` | node not up / no address | ensure Hardhat running + contract deployed; backend retries on next call |
| `model_loaded: false` | model not trained | `make train` |
| `/ingest` returns `423` | session is blocked | unblock via `/sessions/action` or `make reset` |
| Simulator "generated" barely rises | all actor sessions blocked | `make reset` |
| Anchored count < event count | chain restarted (ledger resets), DB persisted | `make reset` for aligned counts |
| Explanations look templated | no `LLM_API_KEY` | expected fallback; set key to use the LLM |
| Frontend can't reach API | `NEXT_PUBLIC_API_URL` wrong | point at the host-mapped backend URL |
| Port in use (3000/8000/8545) | stale process | `./setup.sh --stop` (frees ports) |

## 7. Logs

`setup.sh` writes to `logs/{chain,deploy,seed,train,backend,frontend}.log`
(`make logs` tails the key ones). Docker: `docker compose logs -f <service>`.

## 8. Loading the CERT dataset (optional)

```
make load-cert DIR=/path/to/cert_csvs LIMIT=3000
```
Maps CERT CSVs to events and scores them. Train on normal behaviour only — labels
are not required.
