# BlockSpark — System Security Manual & Platform Documentation

**Document Class:** System Architecture & Operations Manual  
**Project:** BlockSpark Insider Threat Intelligence Platform  
**Target Event:** FinSpark'26 · COEP Technological University, Pune, India  
**Status:** Release Ready (POC)  

---

## 1. Executive Summary

The BlockSpark platform is an enterprise-grade security intelligence solution designed to mitigate internal threat vectors in financial institutions. Traditional security log stores are vulnerable to root database administrators or privileged attackers who can directly modify database rows to cover their tracks. 

BlockSpark establishes a trustless audit trail. By combining real-time machine learning behavioral anomaly detection, post-quantum cryptography (PQC), and immutable blockchain ledger anchoring, the platform makes unauthorized database modifications instantly detectable and auditable.

---

## 2. Core Security Engineering Pipeline

Every log generated in the system goes through a five-stage processing pipeline to ensure behavior is analyzed, signed, and anchored safely:

### 2.1 Behavioral Analysis (Machine Learning)
- **Model:** An Isolation Forest anomaly detection model trained on historical baseline vectors.
- **Features:** Integrates user personalization features (per-user z-scores tracking action frequency, record volumes, and bytes transferred) along with cyclical time encoding (`hour_sin` / `hour_cos`) to identify deviations from standard user habits.
- **Calibration:** Blends rule-based threat flags (off-hours, bulk exports, log destruction) and ML anomaly scores 50/50 to generate a calibrated risk score (0-100).

### 2.2 Post-Quantum Cryptographic Signatures (PQC)
- **Algorithm:** Implements a FIPS 204 compliant **ML-DSA (Crystals-Dilithium)** lattice-based signature scheme.
- **Execution:** During ingestion, the backend computes the SHA-256 hash of the event, signs it using the platform's private key, and attaches the signature and public key metadata directly to the record. This prevents historical decryption attacks by future quantum computers.

### 2.3 Immutable Ledger Anchoring
- **Mechanism:** The SHA-256 hash of the canonical JSON log is anchored on a smart contract (`AuditLog.sol`) using Web3.py.
- **Compatibility:** Optimized for zero-gas private chains (like Hyperledger Besu) utilizing PoA middleware configurations.

### 2.4 Live Database Tampering Detection
- **Ground Truth Validation:** The application constantly compares the SHA-256 hash of the local database records against the immutable transaction hash anchored on the blockchain. 
- **Response:** Any column modification (e.g., changing the username or decreasing record counts in SQLite/PostgreSQL) triggers a mismatch, displaying an automated warning alert block on the dashboard.

---

## 3. Platform Setup & Operations Guide

### 3.1 Developer Sandbox Environment
To compile the smart contracts, initialize the virtual environment, seed normal baselines, train the Isolation Forest, and start the local services:

```bash
# Install required dependencies
make install

# Start the full stack (chain + API + frontend)
make run
```
Access the console at **`http://localhost:3000`** with:
- **Username:** `admin` | **Password:** `admin123`
- **MFA Token Seed:** `JBSWY3DPEHPK3PXP` (for Google Authenticator)

### 3.2 Production Subnet Integration (Besu Node)
To deploy the backend and frontend pointing to an external Hyperledger Besu network, configure the environment variables in your `backend/.env` file:

```ini
RPC_URL="http://<your-besu-node-ip>:8545"
CONTRACT_ADDRESS="0x<deployed-contract-address>"
CHAIN_PRIVATE_KEY="0x<backend-signer-private-key>"
CHAIN_ENABLED=true
EXTERNAL_CHAIN=true
SKIP_CHAIN_WAIT=true
```
Then, execute the launch target:
```bash
make up
```

---

## 4. Threat Scenario Demonstration Suite

The platform includes five pre-scripted scenarios to test the security engine's detection capabilities. You can trigger them from your terminal:

* **`make scenario-normal`**  
  Simulates a normal teller query and record view. Expected output: **Low Risk (0-39)**.
* **`make scenario-negligent`**  
  Simulates a user exporting records without a corresponding ticket ID. Expected output: **Medium Risk (40-69)**.
* **`make scenario-compromised`**  
  Simulates a user logging in from a new device and an impossible geographic location. Expected output: **High Risk (70-100)**.
* **`make scenario-malicious-exfil`**  
  Simulates a bulk download of sensitive financial records. Expected output: **High Risk (70-100)**.
* **`make scenario-malicious-destroy`**  
  Simulates an administrator executing log deletion commands. Expected output: **High Risk (70-100)**.

---

## 5. Future Scope & Production Roadmap

* **Deep Predictive Analytics & AI Sequence Tracking:** Graduate from the initial lightweight Isolation Forest model to full **LSTM or Transformer neural networks** to map complex chronological actions over time. This will allow the system to catch subtle lateral movement and privilege escalation patterns across the bank's network that flat rules miss entirely.
* **Graph Neural Network (GNN) Intelligence:** Integrate graph database tracking (such as Neo4j) to build real-time asset-user relationship models. The engine will dynamically flag anomalies based on graph distance path shifts whenever users try to touch infrastructure resource zones they have no business mapping out.
* **Enterprise Post-Quantum Cryptography Migration:** Expand beyond using ML-DSA (Dilithium) solely for event logs and signatures. Incorporate **ML-KEM (Kyber-768/1024)** for complete key encapsulation to fully protect archived user profiles, database backups, and central credential storage pools against the threat of future quantum data harvesting ("Harvest Now, Decrypt Later").
* **Server-Side Watermark Injections:** Replace the client-side canvas/CSS visual overlays to ensure tech-savvy internal threats cannot bypass the system by deleting browser DOM elements in DevTools. The future architecture will dynamically inject unalterable, unique metadata markers into protected documents and image streams directly from the backend server space.
* **Automated CCTV & Web Cam Analytics:** Connect data visibility gates to edge AI camera processors. The terminal application will automatically blur sensitive screen content or trigger an immediate session block if a physical smartphone camera lens or unauthorized onlooker is detected in the operator's immediate secure zone.
* **Federated Learning Across Financial Institutions:** Train behavioral and operational security models collaboratively across distinct bank sub-networks or separate sovereign financial entities using privacy-preserving Federated Learning, optimizing threat signatures without ever exposing private customer banking metadata.
* **Inter-Bank Blockchain Network Consortium:** Expand the local private ledger instance into a secure consortium blockchain network linking major Indian banking institutions. This will create a tamper-proof, shared registry of compromised internal access patterns to instantly halt threat vectors trying to leap between different institutional perimeters.

---

*BlockSpark · Technical Operations & Systems Security Team · FinSpark'26*
