"""JWT auth + password hashing + FastAPI dependencies with role checks."""
from datetime import datetime, timedelta, timezone
from typing import Optional

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from passlib.context import CryptContext
from sqlalchemy.orm import Session

from .config import settings
from .db import get_db
from .models import User

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="auth/login")


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


def create_access_token(subject: str, role: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    payload = {"sub": subject, "role": role, "exp": expire}
    return jwt.encode(payload, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)


def decode_token(token: str) -> dict:
    try:
        return jwt.decode(token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Invalid token")


def authenticate_user(db: Session, username: str, password: str) -> Optional[User]:
    user = db.query(User).filter(User.username == username).first()
    if not user or not verify_password(password, user.hashed_password):
        return None
    return user


def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)) -> User:
    payload = decode_token(token)
    username = payload.get("sub")
    user = db.query(User).filter(User.username == username).first()
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user


def require_admin(user: User = Depends(get_current_user)) -> User:
    if user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin role required for this action",
        )
    return user


# ---- Multi-Factor Authentication (MFA / 2FA) helpers ----
import base64
import hashlib
import hmac
import secrets
import struct
import time


def generate_totp_secret() -> str:
    """Generate a standard 16-character base32 secret key."""
    base32_alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567"
    return "".join(secrets.choice(base32_alphabet) for _ in range(16))


def verify_totp(secret: str, code: str, window: int = 1) -> bool:
    """Verify a TOTP 6-digit code against a base32-encoded secret.

    Supports a window of +/- 30s to handle minor client/server clock drifts.
    """
    if not secret or not code:
        return False
    try:
        secret = secret.strip().replace(" ", "")
        missing_padding = len(secret) % 8
        if missing_padding:
            secret += "=" * (8 - missing_padding)
        key = base64.b32decode(secret, casefold=True)

        current_time = int(time.time())
        time_step = 30

        for w in range(-window, window + 1):
            counter = (current_time // time_step) + w
            counter_bytes = struct.pack(">Q", counter)

            h = hmac.new(key, counter_bytes, hashlib.sha1).digest()
            offset = h[-1] & 0x0F
            truncated_hash = struct.unpack(">I", h[offset : offset + 4])[0] & 0x7FFFFFFF
            computed_code = f"{truncated_hash % 1000000:06d}"

            if computed_code == code:
                return True
        return False
    except Exception:
        return False

