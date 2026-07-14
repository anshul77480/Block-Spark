"""web3.py client for the local Hardhat AuditLog contract.

Computes SHA-256 over canonical event JSON and anchors it on-chain. If the chain
is unavailable or disabled, degrades gracefully (anchored=False) so the demo runs.

README note: for the POC we anchor one hash per event. Production would batch
event hashes into a Merkle root and anchor the root periodically.
"""
from __future__ import annotations

import hashlib
import json
import os
from typing import Optional

from .config import settings

_ABI = [
    {
        "inputs": [
            {"internalType": "bytes32", "name": "eventHash", "type": "bytes32"},
            {"internalType": "string", "name": "metadata", "type": "string"},
        ],
        "name": "anchorEvent",
        "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
        "stateMutability": "nonpayable",
        "type": "function",
    },
    {
        "inputs": [{"internalType": "uint256", "name": "index", "type": "uint256"}],
        "name": "getRecord",
        "outputs": [
            {"internalType": "bytes32", "name": "", "type": "bytes32"},
            {"internalType": "uint256", "name": "", "type": "uint256"},
            {"internalType": "address", "name": "", "type": "address"},
            {"internalType": "string", "name": "", "type": "string"},
        ],
        "stateMutability": "view",
        "type": "function",
    },
    {
        "inputs": [],
        "name": "totalRecords",
        "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
        "stateMutability": "view",
        "type": "function",
    },
    {
        "anonymous": False,
        "inputs": [
            {"indexed": True, "internalType": "uint256", "name": "index", "type": "uint256"},
            {"indexed": True, "internalType": "bytes32", "name": "eventHash", "type": "bytes32"},
            {"indexed": False, "internalType": "uint256", "name": "timestamp", "type": "uint256"},
            {"indexed": True, "internalType": "address", "name": "recorder", "type": "address"},
        ],
        "name": "EventAnchored",
        "type": "event",
    },
]


def canonical_hash(event: dict) -> str:
    """Deterministic SHA-256 over the canonical event JSON (hex string)."""
    canonical = json.dumps(event, sort_keys=True, separators=(",", ":"), default=str)
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


class ChainClient:
    def __init__(self):
        self.enabled = settings.CHAIN_ENABLED
        self.w3 = None
        self.contract = None
        self.account = None
        self.address = None
        self.status = "disabled"
        if self.enabled:
            self._connect()

    def _resolve_address(self) -> Optional[str]:
        if settings.CONTRACT_ADDRESS:
            return settings.CONTRACT_ADDRESS
        path = settings.CONTRACT_ADDRESS_FILE
        candidates = [path, os.path.join(os.path.dirname(os.path.dirname(__file__)), path)]
        for c in candidates:
            if c and os.path.exists(c):
                with open(c) as f:
                    return f.read().strip()
        return None

    def _connect(self):
        try:
            from web3 import Web3

            self.w3 = Web3(Web3.HTTPProvider(settings.RPC_URL, request_kwargs={"timeout": 10}))
            if not self.w3.is_connected():
                self.status = "node_unreachable"
                return
            self.address = self._resolve_address()
            if not self.address:
                self.status = "no_contract_address"
                return
            self.address = Web3.to_checksum_address(self.address)
            self.contract = self.w3.eth.contract(address=self.address, abi=_ABI)
            
            if settings.PRIVATE_KEY:
                # Use private key for signing transactions (needed for remote nodes like Besu)
                self.account = self.w3.eth.account.from_key(settings.PRIVATE_KEY)
            else:
                # Fallback to unlocked node account (local Hardhat)
                if not self.w3.eth.accounts:
                    self.status = "no_accounts_available"
                    return
                self.account = self.w3.eth.accounts[0]
                
            self.status = "connected"
        except Exception as e:  # noqa: BLE001
            self.status = f"error: {e}"

    def anchor(self, event: dict, metadata: str = "") -> dict:
        """Return {event_hash, anchor_tx, anchored, status}."""
        h = canonical_hash(event)
        result = {"event_hash": h, "anchor_tx": None, "anchored": False, "status": self.status}
        if self.status != "connected":
            return result
        try:
            from web3 import Web3

            hash_bytes = Web3.to_bytes(hexstr="0x" + h)
            
            # Check if using private key for local signing
            if settings.PRIVATE_KEY and hasattr(self.account, "address"):
                sender_address = self.account.address
                # Get chainId, fallback to 1337 if not available or fails
                try:
                    chain_id = self.w3.eth.chain_id
                except Exception:
                    chain_id = 1337
                
                # Build transaction
                tx_build = self.contract.functions.anchorEvent(hash_bytes, metadata).build_transaction({
                    "from": sender_address,
                    "nonce": self.w3.eth.get_transaction_count(sender_address),
                    "gasPrice": self.w3.eth.gas_price,
                    "chainId": chain_id,
                })
                # Sign transaction locally
                signed_tx = self.w3.eth.account.sign_transaction(tx_build, private_key=settings.PRIVATE_KEY)
                # Send raw transaction
                tx = self.w3.eth.send_raw_transaction(signed_tx.raw_transaction)
            else:
                # Fallback to unlocked account transact
                tx = self.contract.functions.anchorEvent(hash_bytes, metadata).transact(
                    {"from": self.account}
                )
                
            receipt = self.w3.eth.wait_for_transaction_receipt(tx, timeout=30)
            tx_hex = receipt.transactionHash.hex()
            result["anchor_tx"] = tx_hex if tx_hex.startswith("0x") else "0x" + tx_hex
            result["anchored"] = True
            result["status"] = "anchored"
        except Exception as e:  # noqa: BLE001
            result["status"] = f"anchor_failed: {e}"
        return result

    def total_records(self) -> int:
        if self.status != "connected":
            return 0
        try:
            return int(self.contract.functions.totalRecords().call())
        except Exception:
            return 0


# module-level singleton (lazily reconnects if address appears later)
_client: Optional[ChainClient] = None


def get_chain() -> ChainClient:
    global _client
    if _client is None:
        _client = ChainClient()
    elif _client.status in {"no_contract_address", "node_unreachable"} and _client.enabled:
        _client._connect()  # retry — deploy may have finished after startup
    return _client
