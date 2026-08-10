import hashlib
import os
import hmac

ITERATIONS = 100000
HASH_NAME = "sha256"

def hash_password(password: str, salt_hex: str = None) -> tuple:
    """
    Hash a password using PBKDF2-HMAC-SHA256.
    If salt_hex is not provided, a new cryptographically-secure salt is generated.
    Returns:
        (hash_hex, salt_hex)
    """
    if salt_hex is None:
        # Generate 32-byte cryptographically-secure salt
        salt_bytes = os.urandom(32)
        salt_hex = salt_bytes.hex()
    else:
        salt_bytes = bytes.fromhex(salt_hex)
        
    password_bytes = password.encode('utf-8')
    dk = hashlib.pbkdf2_hmac(HASH_NAME, password_bytes, salt_bytes, ITERATIONS)
    return dk.hex(), salt_hex

def verify_password(password: str, saved_hash_hex: str, saved_salt_hex: str) -> bool:
    """
    Verify a password against a saved PBKDF2 hash and salt.
    Uses hmac.compare_digest to prevent timing attacks.
    """
    computed_hash_hex, _ = hash_password(password, saved_salt_hex)
    return hmac.compare_digest(computed_hash_hex, saved_hash_hex)

import base64
import json
import time

def _load_secret_key() -> str:
    """
    Resolve the token signing key.

    A shipped default would let anyone forge a session token, so there is no
    fallback in production. Outside production a random per-process key is
    generated instead: tokens stop working across restarts, which is annoying
    enough to notice but never silently insecure.
    """
    secret = os.environ.get("JWT_SECRET", "").strip()
    if secret:
        return secret

    if os.environ.get("ENV", "development").strip().lower() == "production":
        raise RuntimeError(
            "JWT_SECRET must be set when ENV=production. "
            "Generate one with: python -c \"import secrets; print(secrets.token_urlsafe(48))\""
        )

    import logging
    import secrets as _secrets
    logging.warning(
        "JWT_SECRET is not set. Using a random ephemeral key; sessions will not "
        "survive a restart. Set JWT_SECRET in your .env file."
    )
    return _secrets.token_urlsafe(48)


SECRET_KEY = _load_secret_key()

def generate_session_token(email: str, role: str) -> str:
    """
    Generate a secure HMAC-signed session token.
    """
    # Expiration set to 24 hours from now
    payload = {
        "email": email,
        "role": role,
        "exp": int(time.time()) + 86400
    }
    payload_json = json.dumps(payload, separators=(',', ':'))
    payload_b64 = base64.urlsafe_b64encode(payload_json.encode('utf-8')).decode('utf-8').rstrip('=')
    
    # Sign the payload
    signature = hmac.new(SECRET_KEY.encode('utf-8'), payload_b64.encode('utf-8'), hashlib.sha256).digest()
    sig_b64 = base64.urlsafe_b64encode(signature).decode('utf-8').rstrip('=')
    
    return f"{payload_b64}.{sig_b64}"

def verify_session_token(token: str) -> dict:
    """
    Verify the HMAC signature of a session token and return the payload.
    Returns None if signature is invalid or token is expired.
    """
    try:
        parts = token.split(".")
        if len(parts) != 2:
            return None
            
        payload_b64, sig_b64 = parts
        
        # Verify the signature first
        expected_signature = hmac.new(SECRET_KEY.encode('utf-8'), payload_b64.encode('utf-8'), hashlib.sha256).digest()
        expected_sig_b64 = base64.urlsafe_b64encode(expected_signature).decode('utf-8').rstrip('=')
        
        if not hmac.compare_digest(sig_b64, expected_sig_b64):
            return None
            
        # Decode the payload
        padding_needed = 4 - (len(payload_b64) % 4)
        if padding_needed < 4:
            payload_b64_padded = payload_b64 + ("=" * padding_needed)
        else:
            payload_b64_padded = payload_b64
            
        payload_bytes = base64.urlsafe_b64decode(payload_b64_padded.encode('utf-8'))
        payload = json.loads(payload_bytes.decode('utf-8'))
        
        # Check expiration
        if payload.get("exp", 0) < time.time():
            return None
            
        return payload
    except Exception:
        return None

