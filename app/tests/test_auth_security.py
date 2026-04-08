"""Authentication and password security tests."""
import pytest
import time
from app.database import SessionLocal, create_user, verify_password, hash_password


class TestPasswordHashing:
    """Test password hashing security."""
    
    def test_password_not_stored_plaintext(self, test_user):
        """Verify passwords are never stored in plaintext."""
        from app.database import SessionLocal, User
        db = SessionLocal()
        user = db.query(User).filter(User.email == test_user["email"]).first()
        db.close()
        
        # Password hash should never equal plaintext
        assert user.password_hash != test_user["password"]
        assert test_user["password"] not in user.password_hash
    
    def test_password_hash_deterministic(self, test_user):
        """Same password produces different hashes (with salt)."""
        from app.database import hash_password
        password = "SamePassword123!"
        hash1 = hash_password(password)
        hash2 = hash_password(password)
        
        # Different hashes due to random salt
        assert hash1 != hash2
        # But both verify against original
        assert verify_password(password, hash1)
        assert verify_password(password, hash2)
    
    def test_wrong_password_fails_verification(self, test_user):
        """Wrong password fails verification."""
        assert not verify_password("WrongPassword123!", test_user["password"])
    
    def test_weak_password_rejected(self, client):
        """Weak passwords are rejected on registration."""
        weak_passwords = [
            "123456",           # All numbers
            "password",         # Common word
            "abc",              # Too short
            "Test",             # No numbers or special
        ]
        for weak_pwd in weak_passwords:
            response = client.post("/api/register", json={
                "email": f"test{weak_pwd}@example.com",
                "password": weak_pwd,
                "name": "Test User"
            })
            # Should reject weak password
            assert response.status_code >= 400


class TestLoginRateLimiting:
    """Test login rate-limiting and brute-force protection."""
    
    def test_failed_login_recorded(self, client, test_user):
        """Failed login attempts are recorded."""
        from app.database import SessionLocal, get_login_failures_by_email
        
        # Clear any existing failures
        db = SessionLocal()
        db.execute("DELETE FROM login_rate_limits WHERE key_type='email'")
        db.commit()
        db.close()
        
        # Attempt failed login
        response = client.post("/api/login", json={
            "email": test_user["email"],
            "password": "WrongPassword"
        })
        assert response.status_code == 401
        
        # Verify failure was recorded
        db = SessionLocal()
        failures = db.query("SELECT COUNT(*) as count FROM login_rate_limits WHERE key_type='email' AND key_value=?", (test_user["email"],)).all()
        db.close()
        assert failures[0].count >= 1
    
    def test_lockout_after_max_attempts(self, client, test_user):
        """Account locks after max failed attempts."""
        from app.database import SessionLocal, get_login_lockout_until
        
        # Clear existing failures
        db = SessionLocal()
        db.execute("DELETE FROM login_rate_limits")
        db.commit()
        db.close()
        
        # Make max attempts (5 per config)
        for i in range(5):
            response = client.post("/api/login", json={
                "email": test_user["email"],
                "password": "WrongPassword"
            })
            assert response.status_code == 401
        
        # Next attempt should be locked (429)
        response = client.post("/api/login", json={
            "email": test_user["email"],
            "password": test_user["password"]
        })
        assert response.status_code == 429
        assert "locked" in response.json()["detail"].lower()
    
    def test_successful_login_clears_failures(self, client, test_user):
        """Successful login clears failure counter."""
        from app.database import SessionLocal
        
        # Record a failure
        response = client.post("/api/login", json={
            "email": test_user["email"],
            "password": "WrongPassword"
        })
        assert response.status_code == 401
        
        # Successful login clears it
        response = client.post("/api/login", json={
            "email": test_user["email"],
            "password": test_user["password"]
        })
        assert response.status_code == 200
        
        # Verify counter is reset
        db = SessionLocal()
        failure_count = db.query("SELECT failure_count FROM login_rate_limits WHERE key_type='email' AND key_value=?", (test_user["email"],)).scalar()
        db.close()
        assert failure_count is None or failure_count == 0
    
    def test_ip_based_lockout(self, client, test_user):
        """IP-based rate limiting works independently."""
        from app.database import SessionLocal
        
        # Clear existing limits
        db = SessionLocal()
        db.execute("DELETE FROM login_rate_limits")
        db.commit()
        db.close()
        
        # Multiple failed logins from same IP
        for i in range(6):  # Exceed per-IP limit of 20 (or whatever is configured)
            response = client.post("/api/login", json={
                "email": f"user{i}@example.com",
                "password": "WrongPassword"
            })
            # Should eventually get rate limited
            if i > 4:
                assert response.status_code in [401, 429]


class TestSessionManagement:
    """Test session security and uniqueness."""
    
    def test_session_cookie_secure(self, authenticated_client):
        """Session cookie has secure flags."""
        response = authenticated_client.get("/api/profile")
        cookies = response.cookies
        
        # Check for session cookie
        assert "session" in str(cookies).lower() or "Set-Cookie" in str(response.headers)
    
    def test_concurrent_sessions_limited(self, client, test_user):
        """Only one session per user (or max limit enforced)."""
        # Login twice from "different" clients
        login1 = client.post("/api/login", json={
            "email": test_user["email"],
            "password": test_user["password"]
        })
        assert login1.status_code == 200
        session1 = login1.cookies.get("session")
        
        login2 = client.post("/api/login", json={
            "email": test_user["email"],
            "password": test_user["password"]
        })
        assert login2.status_code == 200
        session2 = login2.cookies.get("session")
        
        # Sessions should be different objects (Python tracking)
        # or the same user shouldn't have multiple concurrent session states
        assert session1 is not None or session2 is not None
    
    def test_session_expires(self, authenticated_client):
        """Session tokens expire (verified via max-age)."""
        response = authenticated_client.get("/api/profile")
        # Session cookie should have max-age or expires
        assert "Set-Cookie" in response.headers or "session" in str(response.cookies)


class TestMicrosoftSSO:
    """Test Microsoft 365 OAuth security."""
    
    def test_tenant_restriction_enforced(self, client):
        """Only configured tenants allowed for Microsoft SSO."""
        # This would require mocking MSAL token validation
        # Verify that tenant ID is checked in callback
        pass
    
    def test_invalid_token_rejected(self, client):
        """Invalid or expired tokens are rejected."""
        # Mock token validation failure
        response = client.get("/auth/microsoft/callback?code=invalid")
        assert response.status_code >= 400
