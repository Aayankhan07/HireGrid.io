import pytest
import sys
import os
from fastapi.testclient import TestClient

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app import app

client = TestClient(app)

def test_signup_and_login_flow():
    test_email = "testuser_qa@hiregrid.io"
    test_password = "password123"
    
    # 1. Signup
    signup_payload = {
        "email": test_email,
        "password": test_password,
        "name": "QA Tester",
        "role": "Recruitment Lead"
    }
    signup_resp = client.post("/api/auth/signup", json=signup_payload)
    # 201 or 400 if already exists in local test DB
    assert signup_resp.status_code in [201, 400]
    
    # 2. Login
    login_payload = {
        "email": test_email,
        "password": test_password
    }
    login_resp = client.post("/api/auth/login", json=login_payload)
    assert login_resp.status_code == 200
    data = login_resp.json()
    assert "token" in data
    assert data["email"] == test_email
    
    token = data["token"]
    headers = {"Authorization": f"Bearer {token}"}
    
    # 3. List Screenings (Protected Endpoint)
    screenings_resp = client.get("/api/screenings", headers=headers)
    assert screenings_resp.status_code == 200
    assert isinstance(screenings_resp.json(), list)
    
    # 4. Analytics Endpoint
    analytics_resp = client.get("/api/analytics", headers=headers)
    assert analytics_resp.status_code == 200
    analytics_data = analytics_resp.json()
    assert "total_screenings" in analytics_data
    assert "total_candidates" in analytics_data

def test_unauthorized_access():
    resp = client.get("/api/screenings")
    assert resp.status_code == 401
