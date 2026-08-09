import pytest
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from core.auth import (
    hash_password,
    verify_password,
    generate_session_token,
    verify_session_token
)

def test_password_hashing():
    raw_pass = "SecureP@ssw0rd!"
    p_hash, p_salt = hash_password(raw_pass)
    
    assert p_hash is not None and len(p_hash) > 0
    assert p_salt is not None and len(p_salt) > 0
    
    # Verification should succeed with correct password
    assert verify_password(raw_pass, p_hash, p_salt) is True
    
    # Verification should fail with incorrect password
    assert verify_password("WrongPassword", p_hash, p_salt) is False

def test_session_token_generation_and_verification():
    email = "test.recruiter@hiregrid.io"
    role = "Recruitment Lead"
    
    token = generate_session_token(email, role)
    assert token is not None and len(token) > 0
    
    payload = verify_session_token(token)
    assert payload is not None
    assert payload.get("email") == email
    assert payload.get("role") == role

def test_verify_invalid_session_token():
    assert verify_session_token("invalid.token.string") is None
    assert verify_session_token("") is None
