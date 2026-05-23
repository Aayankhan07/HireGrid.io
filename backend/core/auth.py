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
