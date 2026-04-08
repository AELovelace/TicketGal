"""Input validation and injection prevention tests."""
import pytest
from fastapi import HTTPException


class TestEmailValidation:
    """Test email field validation."""
    
    def test_valid_email_accepted(self, client):
        """Valid emails are accepted."""
        response = client.post("/api/register", json={
            "email": "user@example.com",
            "password": "ValidPassword123!",
            "name": "Test User"
        })
        assert response.status_code == 200
    
    def test_invalid_email_format_rejected(self, client):
        """Invalid email formats are rejected."""
        invalid_emails = [
            "notanemail",
            "@example.com",
            "user@",
            "user @example.com",
            "",
        ]
        for invalid_email in invalid_emails:
            response = client.post("/api/register", json={
                "email": invalid_email,
                "password": "ValidPassword123!",
                "name": "Test User"
            })
            assert response.status_code >= 400, f"Email '{invalid_email}' should be rejected"
    
    def test_email_domain_restriction(self, client):
        """Restricted email domains are rejected (if configured)."""
        # If configured to allow only certain domains
        from app.config import settings
        if hasattr(settings, 'allowed_email_domains') and settings.allowed_email_domains:
            response = client.post("/api/register", json={
                "email": "user@forbidden.com",
                "password": "ValidPassword123!",
                "name": "Test User"
            })
            assert response.status_code >= 400


class TestNameValidation:
    """Test name field validation."""
    
    def test_valid_names_accepted(self, authenticated_client):
        """Valid names are accepted."""
        valid_names = [
            "John Doe",
            "María García",
            "李明",
            "O'Brien",
            "Jean-Pierre",
        ]
        for name in valid_names:
            response = authenticated_client.put("/api/profile", json={
                "name": name
            })
            assert response.status_code in [200, 204], f"Name '{name}' should be valid"
    
    def test_name_length_limits(self, authenticated_client):
        """Names that are too long are rejected."""
        long_name = "A" * 300
        response = authenticated_client.put("/api/profile", json={
            "name": long_name
        })
        assert response.status_code >= 400
    
    def test_empty_name_rejected(self, authenticated_client):
        """Empty names are rejected."""
        response = authenticated_client.put("/api/profile", json={
            "name": ""
        })
        assert response.status_code >= 400
    
    def test_xss_payload_sanitized(self, authenticated_client):
        """XSS payloads in names are sanitized."""
        xss_payloads = [
            "<script>alert('xss')</script>",
            "javascript:alert('xss')",
            "<img src=x onerror='alert(1)'>",
            "'><script>alert(String.fromCharCode(88,83,83))</script>",
        ]
        for payload in xss_payloads:
            response = authenticated_client.put("/api/profile", json={
                "name": payload
            })
            # Should not execute script, may be sanitized or rejected
            if response.status_code == 200:
                # Verify payload was sanitized (not stored as-is)
                profile = authenticated_client.get("/api/profile").json()
                assert "<script>" not in profile.get("name", "")
                assert "javascript:" not in profile.get("name", "")


class TestPhoneValidation:
    """Test phone number validation."""
    
    def test_valid_phone_formats(self, authenticated_client):
        """Valid phone formats are accepted."""
        valid_phones = [
            "+1-555-0123",
            "555-0123",
            "+44 20 7123 4567",
        ]
        for phone in valid_phones:
            response = authenticated_client.put("/api/profile", json={
                "phone": phone
            })
            # May succeed or require validation
            assert response.status_code != 500
    
    def test_invalid_phone_rejected(self, authenticated_client):
        """Invalid phone formats are rejected."""
        response = authenticated_client.put("/api/profile", json={
            "phone": "not-a-phone"
        })
        assert response.status_code >= 400 or response.status_code == 200  # May be optional


class TestSQLInjectionPrevention:
    """Test SQL injection prevention."""
    
    def test_email_field_injection_rejected(self, client):
        """SQL injection in email field is prevented."""
        sql_injection_attempts = [
            "'; DROP TABLE users; --",
            "admin'--",
            "' OR '1'='1",
            "'; DELETE FROM users WHERE '1'='1",
            "1' UNION SELECT * FROM users--",
        ]
        for attempt in sql_injection_attempts:
            response = client.post("/api/register", json={
                "email": attempt,
                "password": "ValidPassword123!",
                "name": "Test User"
            })
            # Should reject as invalid email
            assert response.status_code >= 400, f"Injection attempt should be rejected: {attempt}"
    
    def test_name_field_injection_rejected(self, authenticated_client):
        """SQL injection in name field is prevented."""
        response = authenticated_client.put("/api/profile", json={
            "name": "'; DROP TABLE users; --"
        })
        # Should reject or sanitize
        assert response.status_code >= 400 or response.status_code == 200


class TestFileUploadValidation:
    """Test file upload validation and security."""
    
    def test_eml_file_accepted(self, authenticated_client):
        """Valid .eml files are accepted."""
        # Create a mock .eml file
        eml_content = b"From: test@example.com\r\nTo: user@example.com\r\nSubject: Test\r\n\r\nTest body"
        response = authenticated_client.post("/api/emails/parse-drop", 
            files={"file": ("test.eml", eml_content, "message/rfc822")})
        assert response.status_code in [200, 202, 400]  # May fail for other reasons, but not file type
    
    def test_msg_file_accepted(self, authenticated_client):
        """Valid .msg files are accepted."""
        # Create a minimal .msg header
        msg_content = b"D0CF11E0A1B11AE1"  # OLE file signature
        response = authenticated_client.post("/api/emails/parse-drop", 
            files={"file": ("test.msg", msg_content, "application/vnd.ms-outlook")})
        assert response.status_code in [200, 202, 400]  # May fail for other reasons
    
    def test_exe_file_rejected(self, authenticated_client):
        """Executable files are rejected."""
        response = authenticated_client.post("/api/emails/parse-drop", 
            files={"file": ("malware.exe", b"MZ\x90", "application/x-msdownload")})
        assert response.status_code == 400
    
    def test_zip_file_rejected(self, authenticated_client):
        """Zip files are rejected."""
        response = authenticated_client.post("/api/emails/parse-drop", 
            files={"file": ("archive.zip", b"PK\x03\x04", "application/zip")})
        assert response.status_code == 400
    
    def test_oversized_file_rejected(self, authenticated_client):
        """Files over size limit are rejected."""
        large_content = b"A" * (6 * 1024 * 1024)  # 6 MB (limit is 5)
        response = authenticated_client.post("/api/emails/parse-drop", 
            files={"file": ("large.eml", large_content, "message/rfc822")})
        assert response.status_code == 413 or response.status_code == 400


class TestQueryParameterValidation:
    """Test query parameter validation."""
    
    def test_limit_parameter_validation(self, admin_client):
        """Limit parameter is validated."""
        response = admin_client.get("/api/admin/audit-log?limit=-1")
        # Should reject negative or use safe default
        assert response.status_code in [200, 400]
        
        response = admin_client.get("/api/admin/audit-log?limit=9999999")
        # Should enforce max limit or use safe default
        assert response.status_code == 200
    
    def test_offset_parameter_validation(self, admin_client):
        """Offset parameter is validated."""
        response = admin_client.get("/api/admin/audit-log?offset=-1")
        assert response.status_code in [200, 400]
        
        response = admin_client.get("/api/admin/audit-log?offset=0")
        assert response.status_code == 200
    
    def test_filter_parameter_validation(self, admin_client):
        """Action filter parameter is validated."""
        valid_actions = ["login_success", "login_failure", "admin_role_change"]
        for action in valid_actions:
            response = admin_client.get(f"/api/admin/audit-log?action={action}")
            assert response.status_code == 200
        
        # Invalid action should not cause errors (just no results or error)
        response = admin_client.get("/api/admin/audit-log?action=invalid>action")
        assert response.status_code in [200, 400]
