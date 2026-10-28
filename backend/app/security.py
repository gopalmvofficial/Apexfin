import hashlib
import hmac
import base64
import json
import time
import secrets
from typing import Optional, Dict, Any
from fastapi import HTTPException, Security, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from .config import SECRET_KEY, ACCESS_TOKEN_EXPIRE_MINUTES

security_bearer = HTTPBearer(auto_error=False)

def hash_password(password: str) -> str:
    salt = secrets.token_hex(16)
    hashed = hashlib.pbkdf2_hmac('sha256', password.encode('utf-8'), salt.encode('utf-8'), 100_000)
    return f"{salt}:{hashed.hex()}"

def verify_password(plain_password: str, hashed_password: str) -> bool:
    try:
        salt, stored_hash = hashed_password.split(':')
        new_hash = hashlib.pbkdf2_hmac('sha256', plain_password.encode('utf-8'), salt.encode('utf-8'), 100_000)
        return hmac.compare_digest(stored_hash, new_hash.hex())
    except Exception:
        return False

def hash_pin(pin: str) -> str:
    return hashlib.sha256((pin + SECRET_KEY[:8]).encode('utf-8')).hexdigest()

def verify_pin(plain_pin: str, stored_hash: str) -> bool:
    if not stored_hash:
        return True # Default if not set
    computed = hashlib.sha256((plain_pin + SECRET_KEY[:8]).encode('utf-8')).hexdigest()
    return hmac.compare_digest(stored_hash, computed)

# Standard Zero-Dependency JWT implementation (HMAC-SHA256)
def create_access_token(data: Dict[str, Any], expires_delta: Optional[int] = None) -> str:
    payload = data.copy()
    expire_seconds = (expires_delta or (ACCESS_TOKEN_EXPIRE_MINUTES * 60))
    payload["exp"] = int(time.time()) + expire_seconds
    payload["iat"] = int(time.time())

    header = {"alg": "HS256", "typ": "JWT"}
    header_b64 = base64.urlsafe_b64encode(json.dumps(header).encode()).decode().rstrip("=")
    payload_b64 = base64.urlsafe_b64encode(json.dumps(payload).encode()).decode().rstrip("=")

    signature = hmac.new(
        SECRET_KEY.encode(),
        f"{header_b64}.{payload_b64}".encode(),
        hashlib.sha256
    ).digest()
    sig_b64 = base64.urlsafe_b64encode(signature).decode().rstrip("=")

    return f"{header_b64}.{payload_b64}.{sig_b64}"

def decode_access_token(token: str) -> Optional[Dict[str, Any]]:
    try:
        parts = token.split(".")
        if len(parts) != 3:
            return None
        header_b64, payload_b64, sig_b64 = parts

        # Verify signature
        expected_sig = hmac.new(
            SECRET_KEY.encode(),
            f"{header_b64}.{payload_b64}".encode(),
            hashlib.sha256
        ).digest()
        actual_sig = base64.urlsafe_b64decode(sig_b64 + "=" * (-len(sig_b64) % 4))
        if not hmac.compare_digest(expected_sig, actual_sig):
            return None

        # Verify expiration
        payload_json = base64.urlsafe_b64decode(payload_b64 + "=" * (-len(payload_b64) % 4)).decode()
        payload = json.loads(payload_json)

        if payload.get("exp", 0) < time.time():
            return None

        return payload
    except Exception:
        return None

def get_current_user_payload(credentials: Optional[HTTPAuthorizationCredentials] = Depends(security_bearer)) -> Dict[str, Any]:
    if not credentials:
        # Provide default fallback demo payload for development
        return {
            "sub": "usr_alex_01",
            "tenant_id": "ten_alex_01",
            "email": "alex@apexfin.io",
            "name": "Alex Rivera",
            "tier": "pro"
        }
    token = credentials.credentials
    payload = decode_access_token(token)
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid, expired, or tampered authorization token",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return payload
