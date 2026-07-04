# 📋 Deployment Strategy Plan: BlockSpark

This plan outlines the architecture and deployment strategy for moving the BlockSpark platform to a production environment. It specifically addresses using **Hyperledger Besu** for the blockchain layer, enabling gasless transactions, and choices for hosting the frontend, backend, database, and secrets management.

---

## Mode Detection
- **Mode:** TWO Approaches Mode (Comparing Self-Hosted vs. Managed Cloud)
- **Target File:** `plans/deployment-strategy-20260704.md`

---

## Approach A: Self-Hosted Private Network (Docker / K8s / Private VMs)

### Why this solution
Best suited for high-security enterprise environments or hosting inside a dedicated cloud VPC (Virtual Private Cloud). Gives full control over node configurations, consensus mechanisms (IBFT 2.0 / QBFT), and data privacy controls.

### Architecture Overview
1. **Blockchain Layer (Besu):** A private Hyperledger Besu network (minimum 4 validator nodes for IBFT 2.0 fault tolerance) running on private VM instances (EC2/Compute Engine) or Kubernetes (EKS/GKE).
2. **Backend (FastAPI):** Containerized via Docker, deployed in the same private network or container registry, exposed via an Application Load Balancer.
3. **Frontend (Next.js):** Containerized or deployed on a Node.js runtime container behind an Nginx reverse proxy.
4. **Database:** SQLite replaced with a highly available PostgreSQL cluster (e.g. AWS Aurora or self-hosted Pgpool-II).

---

## Approach B: Hybrid Managed Cloud (Vercel + AWS ECS + Managed Besu via Kaleido)

### Why this solution
Maximizes deployment velocity, shifts the operational overhead of running blockchain validators to a managed provider, and ensures high frontend performance via edge caching.

### Architecture Overview
1. **Blockchain Layer (Besu):** A private subnet on **Kaleido** running Hyperledger Besu. Kaleido handles node health, patching, key management, and JSON-RPC node infrastructure.
2. **Backend (FastAPI):** Hosted on **AWS ECS (Fargate)** or **GCP Cloud Run** for serverless container scalability.
3. **Frontend (Next.js):** Hosted on **Vercel** for automatic global edge deployments and native Next.js server-side optimizations.
4. **Database:** **AWS RDS PostgreSQL** for a managed, automated-backup database.

---

## Gasless Transactions Strategy (Hyperledger Besu)

To support seamless, gasless transaction anchoring from the backend to Hyperledger Besu without requiring end-users or the backend service to pay gas fees, two approaches are supported by Besu:

### 1. Zero Gas Price Network (Recommended for Private Chains)
Since Hyperledger Besu is a private/permissioned network, we configure the consensus rules in the genesis file to enforce a zero-gas-price market.
- **Node Configuration (`config.toml`):**
  ```toml
  # Set the minimum gas price to 0
  min-gas-price = 0
  ```
- **Genesis Block (`genesis.json`):**
  Configure the gas limit high enough to accommodate transactions, and omit gas fee burns.
- **Backend Signer:**
  The FastAPI backend signs transactions using Web3.py with `gasPrice` explicitly set to `0`.
  ```python
  tx = contract.functions.storeLog(event_id, event_hash).build_transaction({
      'from': backend_address,
      'nonce': w3.eth.get_transaction_count(backend_address),
      'gas': 200000,
      'gasPrice': 0, # zero-gas transaction
      'chainId': private_chain_id
  })
  ```

### 2. Account Abstraction / Paymaster (For Public or Gas-Enforced Subnets)
If gas must be consumed on the network:
- Deploy an **ERC-4337 Paymaster contract**.
- The backend acts as a Bundler sending User Operations signed by the backend key.
- The Paymaster sponsors the transaction fees, meaning the calling service doesn't need native gas tokens.

---

## Comparison Table

| Criteria | Approach A (Self-Hosted) | Approach B (Managed Cloud) |
|----------|--------------------------|----------------------------|
| **Deployment Effort** | 🔴 High (manual configuration of IBFT 2.0, networking, firewalls) | 🟢 Low-Medium (managed services & automated deployment) |
| **Operational Overhead** | 🔴 High (must monitor VM/node uptime, coordinate hard forks, manage disks) | 🟢 Low (Kaleido/Vercel handles infrastructure maintenance) |
| **Security & Isolation** | 🟢 Extremely High (Fully private VPC, no external data transit) | 🟡 High (Requires private links/security setups to bridge Vercel and AWS/Kaleido) |
| **Cost** | 🟡 Variable (cost of VM running 24/7 nodes) | 🟡 Premium (Kaleido fees + Vercel + AWS managed resources) |
| **Scalability** | 🟡 Manual (Requires K8s scaling policies) | 🟢 Instant (Serverless backend & global Edge frontend) |

---

## Recommended Tech Stack

For a robust production deployment that balances speed, cost, and reliability, we recommend the **Hybrid Managed Cloud (Approach B)**:

1. **Blockchain:** Hyperledger Besu on **Kaleido** (Zero Gas Price config).
2. **Backend Engine:** **AWS ECS (Fargate)** with FastAPI.
3. **Frontend Dashboard:** **Vercel** connected to GitHub.
4. **Relational Database:** **AWS RDS PostgreSQL** (standard db setup).
5. **Secret Management:** **AWS Secrets Manager** (storing JWT secrets, MFA keys, PQC seeds, and Besu private keys).

---

## Action Plan

### 1. Database Migration (FastAPI Backend)
Modify database adapters to support PostgreSQL instead of SQLite.
- Update `backend/app/config.py` to parse PostgreSQL URL.
- Install dependencies: `pip install psycopg2-binary`.
- Modify `backend/app/db.py` to use PostgreSQL connection pooling.

### 2. Environment Variables & Secret Configuration
Set up the production environment file:
```ini
# Production API Config
DATABASE_URL=postgresql://db_user:password@rds-instance-endpoint:5432/blockspark
JWT_SECRET=super_secure_random_key
ADMIN_USERNAME=admin
ADMIN_PASSWORD=admin_secure_pass
ADMIN_MFA_SECRET=JBSWY3DPEHPK3PXP

# Production Blockchain Config
BESU_RPC_URL=https://node-endpoint.kaleido.io/json-rpc
BESU_PRIVATE_KEY=0x_backend_signer_private_key
BESU_CONTRACT_ADDRESS=0x_deployed_audit_log_address
```

### 3. Containerization & CI/CD
- **Dockerfiles** already exist in the repository for `/backend` and `/frontend`.
- Set up a GitHub Action workflow to build and push backend images to AWS ECR and trigger an ECS deployment.
- Configure Vercel integrations for the `/frontend` subdirectory.

---

## Rollback Plan
1. **Contract Failure:** Keep the backend's logging fallback active (log to local database and queue failed anchors for asynchronous retrying when RPC endpoints recover).
2. **Deployment Rollback:** Vercel supports instant deployment reversion to previous commits. AWS ECS task definitions can be rolled back to the previous stable Docker image version.

---

## Security Checklist
- [ ] Enable TLS/HTTPS on all endpoints.
- [ ] Configure CORS rules on the FastAPI backend to only accept requests from the production frontend domain.
- [ ] Encrypt all environment variables using AWS Secrets Manager.
- [ ] Set up database row backups and point-in-time recovery on RDS.
- [ ] Lock down Besu JSON-RPC endpoints using basic authentication headers or VPC peering/private links.
- [ ] Implement rate-limiting on `/token` and `/events/{event_id}/tamper` endpoints to mitigate brute force attacks.

---

## Next Steps
Ready? Run:
```bash
# To create target plans directory and review deployment configurations
```
