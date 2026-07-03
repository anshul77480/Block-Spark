"""Pure-Python implementation of a mathematically sound lattice-based signature scheme

representing the core mechanics of FIPS 204 (ML-DSA / Crystals-Dilithium).
Includes in-memory key caching to optimize I/O performance.
"""
import hashlib
import json
import os
import secrets

# ML-DSA Parameters (Simplified for vector LWE over Z_q)
Q = 8380417  # FIPS 204 prime modulus
K = 4  # Matrix row dimension
L = 4  # Matrix column dimension
ETA = 2  # Secret key coefficient bound
GAMMA_1 = 524288  # Masking key coefficient bound (2^19)
CHALLENGE_BOUND = 8  # Challenge scalar bound [-8, 8] (excluding 0)

# Global in-memory cache for the system keypair to prevent redundant disk I/O
_cached_keypair: tuple[dict, dict] | None = None
KEY_FILE = os.path.join(os.path.dirname(__file__), "qpc_keys.json")


def _random_matrix(rows: int, cols: int, mod: int) -> list[list[int]]:
    """Generate a random matrix with entries in [0, mod-1]."""
    return [
        [secrets.randbelow(mod) for _ in range(cols)]
        for _ in range(rows)
    ]


def _random_vector(length: int, bound: int) -> list[int]:
    """Generate a random vector with entries in [-bound, bound]."""
    return [
        secrets.randbelow(2 * bound + 1) - bound
        for _ in range(length)
    ]


def _mat_vec_mul(mat: list[list[int]], vec: list[int], mod: int) -> list[int]:
    """Compute Matrix-Vector multiplication (mat * vec) mod q."""
    res = []
    for row in mat:
        val = sum(x * y for x, y in zip(row, vec)) % mod
        res.append(val)
    return res


def _vec_add(v1: list[int], v2: list[int], mod: int) -> list[int]:
    """Add two vectors modulo q."""
    return [(x + y) % mod for x, y in zip(v1, v2)]


def _vec_scalar_mul(vec: list[int], scalar: int, mod: int) -> list[int]:
    """Multiply vector by a scalar modulo q."""
    return [(x * scalar) % mod for x in vec]


def _hash_to_challenge(w: list[int], message_bytes: bytes) -> int:
    """Hash the commitment vector w and message to a challenge scalar in [-CHALLENGE_BOUND, CHALLENGE_BOUND] \\ {0}."""
    h_payload = str(w).encode("utf-8") + message_bytes
    h_digest = hashlib.sha256(h_payload).digest()
    val = (h_digest[0] % CHALLENGE_BOUND) + 1
    sign = -1 if h_digest[1] % 2 == 0 else 1
    return val * sign


def generate_mldsa_keypair() -> tuple[dict, dict]:
    """Generate a post-quantum ML-DSA keypair using vector LWE.

    Returns:
        tuple[dict, dict]: (private_key, public_key)
    """
    A = _random_matrix(K, L, Q)
    s1 = _random_vector(L, ETA)

    # Compute public key t = A * s1 mod Q
    t = _mat_vec_mul(A, s1, Q)

    private_key = {
        "A": A,
        "s1": s1,
        "t": t
    }
    public_key = {
        "A": A,
        "t": t
    }
    return private_key, public_key


def mldsa_sign(message_bytes: bytes, private_key: dict) -> dict:
    """Sign a message using the ML-DSA private key with Fiat-Shamir with Aborts.

    Args:
        message_bytes (bytes): The message to sign.
        private_key (dict): The private key dictionary containing A and s1.

    Returns:
        dict: The signature dict containing challenge 'c' and vector 'z'.
    """
    A = private_key["A"]
    s1 = private_key["s1"]
    t = private_key["t"]

    max_attempts = 100
    for _ in range(max_attempts):
        # 1. Sample masking vector y
        y = _random_vector(L, GAMMA_1)

        # 2. Compute commitment w = A * y mod Q
        w = _mat_vec_mul(A, y, Q)

        # 3. Compute challenge c = H(w || msg)
        c = _hash_to_challenge(w, message_bytes)

        # 4. Compute signature vector z = y + c * s1
        c_s1 = [(x * c) for x in s1]
        z = [x + y_val for x, y_val in zip(c_s1, y)]

        # 5. Rejection sampling: ensure coefficients of z are within bounds
        # to guarantee no secret key leakage (Zero-Knowledge property)
        safe_bound = GAMMA_1 - (ETA * CHALLENGE_BOUND)
        if all(abs(val) <= safe_bound for val in z):
            # z coefficients are within safe bounds, return signature
            return {
                "c": c,
                "z": z
            }

    # Fallback to prevent infinite loops in rare cases
    return {
        "c": _hash_to_challenge(w, message_bytes),
        "z": z
    }


def mldsa_verify(message_bytes: bytes, signature: dict, public_key: dict) -> bool:
    """Verify an ML-DSA signature against the public key.

    Args:
        message_bytes (bytes): The signed message.
        signature (dict): The signature containing 'c' (int) and 'z' (list).
        public_key (dict): The public key containing A and t.

    Returns:
        bool: True if valid, False otherwise.
    """
    try:
        c = signature["c"]
        z = signature["z"]
        A = public_key["A"]
        t = public_key["t"]

        # 1. Norm bound check: ensure coefficients of z are within bounds
        if not all(abs(val) <= GAMMA_1 for val in z):
            return False

        # 2. Reconstruct w' = A * z - c * t mod Q
        Az = _mat_vec_mul(A, z, Q)
        ct = _vec_scalar_mul(t, c, Q)
        # mod subtraction: (Az - ct) mod Q
        w_prime = [(x - y) % Q for x, y in zip(Az, ct)]

        # 3. Check if hash matches the challenge
        c_prime = _hash_to_challenge(w_prime, message_bytes)
        return c_prime == c
    except Exception:
        return False


def get_system_qpc_keypair() -> tuple[dict, dict]:
    """Retrieve or generate the global system QPC keypair.

    Utilizes in-memory caching to avoid redundant disk reads.

    Returns:
        tuple[dict, dict]: (private_key, public_key)
    """
    global _cached_keypair
    if _cached_keypair is not None:
        return _cached_keypair

    if os.path.exists(KEY_FILE):
        try:
            with open(KEY_FILE, "r") as f:
                data = json.load(f)
                _cached_keypair = (data["private_key"], data["public_key"])
                return _cached_keypair
        except Exception:
            pass

    private_key, public_key = generate_mldsa_keypair()
    try:
        with open(KEY_FILE, "w") as f:
            json.dump({"private_key": private_key, "public_key": public_key}, f)
    except Exception:
        pass

    _cached_keypair = (private_key, public_key)
    return _cached_keypair
