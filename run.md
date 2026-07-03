# Run guide

Four ways to run the POC: **`make`**, **one shell script**, **Docker (one
command)**, or **manual (three terminals)**.

---

## Option 0 — `make` (easiest)

Prerequisites: Python 3.11+, Node 18+, curl, GNU Make.

```
make run       # install (if needed) + start the whole stack, stream logs (Ctrl+C to stop)
```

Run `make` (or `make help`) to list every target. The most useful:

| Command | Does |
|---------|------|
| `make run` | install (idempotent) + start everything and stream logs |
| `make up` | start without reinstalling deps |
| `make stop` | stop all services |
| `make restart` | stop then start |
| `make reset` | wipe DB + model + chain state, then start fresh (aligned demo counts) |
| `make install` | install all dependencies only |
| `make smoke` | backend import + pipeline smoke test |
| `make e2e` | full end-to-end API check against the running stack |
| `make health` / `make stats` | quick status |
| `make sim-start RATE=1.0 THREAT=0.4` / `make sim-stop` | control the simulator |
| `make logs` | tail the service logs |
| `make docker-up` / `make docker-down` | Docker Compose lifecycle |
| `make clean` | remove venv, node_modules, artifacts, logs |

**Deterministic demo scenarios** (inject one crafted event and see it scored,
classified, and anchored):

```
make scenario-normal            # -> LOW
make scenario-negligent         # -> MEDIUM / Negligent User
make scenario-compromised       # -> HIGH   / Compromised Account
make scenario-malicious-exfil   # -> HIGH   / Malicious Insider  (bulk PII export)
make scenario-malicious-destroy # -> HIGH   / Malicious Insider  (destructive command)
make demo-all                   # run all five back to back
```

Then open **http://localhost:3000** (login `admin` / `admin123`). Logs are in `logs/`.

---

## Option 1 — One script

Prerequisites: Python 3.11+, Node 18+, curl.

```
./setup.sh
```

`make run` is a thin wrapper around this script. It installs all dependencies
(idempotent), starts the Hardhat chain, deploys the `AuditLog` contract, seeds the
DB, trains the model, and starts the backend API and Next.js dashboard — then streams
logs. **Press Ctrl+C to stop everything.**

Flags:
- `./setup.sh --skip-install` — skip dependency install, just run
- `./setup.sh --install-only` — install dependencies then exit
- `./setup.sh --stop` — stop services started by a previous run

---

## Option 2 — Docker

Prerequisites: Docker + Docker Compose. (Or use `make docker-up` / `make docker-down`.)

```
docker compose up --build
```

That's it. Compose starts, in order:

- **chain** — a local Hardhat node, deploys `AuditLog`, writes the contract address to a shared volume.
- **backend** — waits for the chain + address, seeds the demo admin and baseline activity, trains the Isolation Forest, then starts the API.
- **frontend** — builds and serves the Next.js dashboard.

Then open:

- Dashboard: **http://localhost:3000**  (login `admin` / `admin123`)
- API docs:  **http://localhost:8000/docs**

Stop with `Ctrl+C`; remove volumes with `docker compose down -v`.

---

## Option 3 — Manual (three terminals)

Prerequisites: Python 3.11+ , Node 18+ . Each step below also has a `make` shortcut
(`make chain`, `make deploy`, `make seed`, `make train`, `make backend`,
`make frontend`).

### Terminal 1 — blockchain (chain node + contract)

- Install deps and start the local node:
  ```
  cd blockchain
  npm install
  npx hardhat node
  ```
- In a scratch terminal (or Terminal 1 after the node is up), deploy the contract:
  ```
  cd blockchain
  npx hardhat run scripts/deploy.js --network localhost
  ```
  This writes `blockchain/deployed_address.txt`, which the backend reads.

### Terminal 2 — backend (API + ML + chain client)

- Create the virtualenv and install pinned deps:
  ```
  cd backend
  python -m venv .venv
  source .venv/bin/activate         # Windows: .venv\Scripts\activate
  pip install -r requirements.txt
  ```
- Copy env and (optionally) add an LLM key:
  ```
  cp .env.example .env
  ```
- Prove the stack imports and works (imports + train + score):
  ```
  python smoke_test.py
  ```
- Seed the demo admin + baseline activity, then train the model:
  ```
  python -m app.seed
  python train_model.py
  ```
- Start the API:
  ```
  uvicorn app.main:app --reload --port 8000
  ```

### Terminal 3 — frontend (dashboard)

- Install and start:
  ```
  cd frontend
  cp .env.local.example .env.local     # NEXT_PUBLIC_API_URL=http://127.0.0.1:8000
  npm install
  npm run dev
  ```
- Open **http://localhost:3000** and log in with `admin` / `admin123`.

---

## Demo flow (any option)

1. Log in as `admin`.
2. Click **Start simulator** — activity streams into the feed.
3. Watch scores/bands appear; medium raises an alert and flags the session, high **blocks** the session and requires re-auth.
4. Click any event to see its cause, plain-English explanation, SHAP top features, rules fired, and its **blockchain anchor** (event hash + tx hash).
5. In **Sessions & response**, block/unblock a session manually to demonstrate the response control.

Prefer the terminal? Drive the same flow deterministically with
`make demo-all` (or the individual `make scenario-*` targets above).

## Optional — load the CERT dataset

Drop the Kaggle CERT CSVs into a folder and map/ingest them:

```
cd backend
python data_adapter.py /path/to/cert_csvs --limit 3000 --ingest
```
(or `make load-cert DIR=/path/to/cert_csvs LIMIT=3000`)

The simulator remains fully functional, so the demo never depends on the download.
