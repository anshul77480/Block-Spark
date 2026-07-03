# Insider Threat Detection & Response POC — task runner.
# Run `make` or `make help` to see all targets.

SHELL := /bin/bash
.ONESHELL:
.DEFAULT_GOAL := help

API ?= http://127.0.0.1:8000
BACKEND := backend
FRONTEND := frontend
CHAIN := blockchain
VENV := $(BACKEND)/.venv
PY := $(VENV)/bin/python
PIP := $(VENV)/bin/pip

# ---- colours ----
BLUE := \033[0;34m
GREEN := \033[0;32m
NC := \033[0m

## ----------------------------------------------------------------------------
## Lifecycle (whole stack)
## ----------------------------------------------------------------------------

.PHONY: help
help: ## Show this help
	@echo -e "$(GREEN)Insider Threat POC — make targets$(NC)"
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | \
	  awk 'BEGIN{FS=":.*?## "}{printf "  \033[0;34m%-20s\033[0m %s\n", $$1, $$2}'
	@echo
	@echo "  Scenario helpers accept:  make scenario-<normal|malicious-exfil|malicious-destroy|compromised|negligent>"

.PHONY: install
install: ## Install all dependencies (backend venv, hardhat, frontend)
	@./setup.sh --install-only

.PHONY: run
run: ## Install (if needed) + start the whole stack and stream logs (Ctrl+C to stop)
	@./setup.sh

.PHONY: up
up: ## Start the stack without reinstalling deps
	@./setup.sh --skip-install

.PHONY: stop
stop: ## Stop all services started by setup.sh
	@./setup.sh --stop

.PHONY: restart
restart: stop up ## Stop then start the stack

.PHONY: reset
reset: ## Stop, wipe DB + model (fresh chain/DB/sessions), then start clean
	@./setup.sh --stop || true
	@rm -f $(BACKEND)/insider_threat.db $(BACKEND)/iforest_model.joblib
	@rm -f $(CHAIN)/deployed_address.txt
	@echo -e "$(GREEN)state wiped — starting fresh$(NC)"
	@./setup.sh --skip-install

.PHONY: clean
clean: ## Remove build artifacts, venv, node_modules, logs (full reset)
	@./setup.sh --stop || true
	@rm -rf $(VENV) $(BACKEND)/__pycache__ $(BACKEND)/app/__pycache__
	@rm -f $(BACKEND)/*.db $(BACKEND)/*.joblib
	@rm -rf $(FRONTEND)/node_modules $(FRONTEND)/.next
	@rm -rf $(CHAIN)/node_modules $(CHAIN)/artifacts $(CHAIN)/cache $(CHAIN)/deployed_address.txt
	@rm -rf logs .pids
	@echo -e "$(GREEN)clean complete$(NC)"

## ----------------------------------------------------------------------------
## Individual services (foreground — use separate terminals)
## ----------------------------------------------------------------------------

.PHONY: chain
chain: ## Start the local Hardhat node (foreground)
	@cd $(CHAIN) && npx hardhat node

.PHONY: deploy
deploy: ## Deploy the AuditLog contract to the running node
	@cd $(CHAIN) && npx hardhat run scripts/deploy.js --network localhost

.PHONY: backend
backend: ## Start the FastAPI backend (foreground)
	@cd $(BACKEND) && .venv/bin/uvicorn app.main:app --reload --port 8000

.PHONY: frontend
frontend: ## Start the Next.js dashboard (foreground)
	@cd $(FRONTEND) && npm run dev

## ----------------------------------------------------------------------------
## Data / model
## ----------------------------------------------------------------------------

.PHONY: seed
seed: ## Seed demo admin + baseline activity
	@cd $(BACKEND) && .venv/bin/python -m app.seed

.PHONY: train
train: ## Train the Isolation Forest on baseline data
	@cd $(BACKEND) && .venv/bin/python train_model.py

.PHONY: load-cert
load-cert: ## Map+ingest CERT CSVs. Usage: make load-cert DIR=/path/to/cert LIMIT=3000
	@cd $(BACKEND) && .venv/bin/python data_adapter.py $(DIR) --limit $(or $(LIMIT),2000) --ingest

## ----------------------------------------------------------------------------
## Tests / verification
## ----------------------------------------------------------------------------

.PHONY: smoke
smoke: ## Backend import + pipeline smoke test (no chain/LLM needed)
	@cd $(BACKEND) && .venv/bin/python smoke_test.py

.PHONY: e2e
e2e: ## Full end-to-end API check against the running backend
	@./e2e_check.sh

.PHONY: evaluate
evaluate: ## Detection metrics (precision/recall/F1/AUC) on injected threats. NORMAL= THREATS=
	@cd $(BACKEND) && .venv/bin/python evaluate.py --normal $(or $(NORMAL),150) --threats $(or $(THREATS),150)

.PHONY: health
health: ## Curl the backend health endpoint
	@curl -s $(API)/health | (python3 -m json.tool 2>/dev/null || cat); echo

.PHONY: stats
stats: ## Show dashboard stats (events by band, causes, blocked, anchored)
	@MFA=$$(python3 -c "import hmac, hashlib, time, struct, base64; key = base64.b32decode('JBSWY3DPEHPK3PXP'); counter = int(time.time()) // 30; h = hmac.new(key, struct.pack('>Q', counter), hashlib.sha1).digest(); offset = h[-1] & 0x0f; print(f'{(struct.unpack(\">I\", h[offset:offset+4])[0] & 0x7fffffff) % 1000000:06d}')"); \
	TOK=$$(curl -s -X POST $(API)/auth/login -H 'Content-Type: application/json' -d "{\"username\":\"admin\",\"password\":\"admin123\",\"mfa_code\":\"$$MFA\"}" | python3 -c "import sys,json;print(json.load(sys.stdin)['access_token'])"); \
	curl -s $(API)/stats -H "Authorization: Bearer $$TOK" | python3 -m json.tool

.PHONY: logs
logs: ## Tail the setup.sh service logs
	@tail -f logs/backend.log logs/frontend.log logs/chain.log

## ----------------------------------------------------------------------------
## Simulator control
## ----------------------------------------------------------------------------

.PHONY: sim-start
sim-start: ## Start the activity simulator (RATE=secs THREAT=0..1)
	@MFA=$$(python3 -c "import hmac, hashlib, time, struct, base64; key = base64.b32decode('JBSWY3DPEHPK3PXP'); counter = int(time.time()) // 30; h = hmac.new(key, struct.pack('>Q', counter), hashlib.sha1).digest(); offset = h[-1] & 0x0f; print(f'{(struct.unpack(\">I\", h[offset:offset+4])[0] & 0x7fffffff) % 1000000:06d}')"); \
	TOK=$$(curl -s -X POST $(API)/auth/login -H 'Content-Type: application/json' -d "{\"username\":\"admin\",\"password\":\"admin123\",\"mfa_code\":\"$$MFA\"}" | python3 -c "import sys,json;print(json.load(sys.stdin)['access_token'])"); \
	curl -s -X POST $(API)/simulator/control -H "Authorization: Bearer $$TOK" -H 'Content-Type: application/json' \
	  -d '{"action":"start","rate_seconds":$(or $(RATE),1.0),"threat_probability":$(or $(THREAT),0.4)}'; echo

.PHONY: sim-stop
sim-stop: ## Stop the activity simulator
	@MFA=$$(python3 -c "import hmac, hashlib, time, struct, base64; key = base64.b32decode('JBSWY3DPEHPK3PXP'); counter = int(time.time()) // 30; h = hmac.new(key, struct.pack('>Q', counter), hashlib.sha1).digest(); offset = h[-1] & 0x0f; print(f'{(struct.unpack(\">I\", h[offset:offset+4])[0] & 0x7fffffff) % 1000000:06d}')"); \
	TOK=$$(curl -s -X POST $(API)/auth/login -H 'Content-Type: application/json' -d "{\"username\":\"admin\",\"password\":\"admin123\",\"mfa_code\":\"$$MFA\"}" | python3 -c "import sys,json;print(json.load(sys.stdin)['access_token'])"); \
	curl -s -X POST $(API)/simulator/control -H "Authorization: Bearer $$TOK" -H 'Content-Type: application/json' -d '{"action":"stop"}'; echo

## ----------------------------------------------------------------------------
## Demo scenarios (inject one deterministic event and show its scoring)
## ----------------------------------------------------------------------------

.PHONY: scenario-normal scenario-malicious-exfil scenario-malicious-destroy scenario-compromised scenario-negligent demo-all
scenario-normal: ## Inject a normal event -> expect LOW
	@./inject_event.sh normal
scenario-malicious-exfil: ## Inject bulk PII export -> expect HIGH / Malicious Insider
	@./inject_event.sh malicious-exfil
scenario-malicious-destroy: ## Inject destructive command -> expect HIGH / Malicious Insider
	@./inject_event.sh malicious-destroy
scenario-compromised: ## Inject new-device+geo-jump login -> expect Compromised Account
	@./inject_event.sh compromised
scenario-negligent: ## Inject no-ticket PII access -> expect MEDIUM / Negligent User
	@./inject_event.sh negligent

demo-all: ## Run all five scenarios back to back
	@./inject_event.sh normal
	@./inject_event.sh negligent
	@./inject_event.sh compromised
	@./inject_event.sh malicious-exfil
	@./inject_event.sh malicious-destroy

## ----------------------------------------------------------------------------
## Docker
## ----------------------------------------------------------------------------

.PHONY: docker-up
docker-up: ## Build + start the whole stack with Docker Compose
	@docker compose up --build

.PHONY: docker-down
docker-down: ## Stop compose stack and remove volumes
	@docker compose down -v

.PHONY: docker-build
docker-build: ## Build all Docker images
	@docker compose build
