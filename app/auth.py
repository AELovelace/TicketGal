import hashlib
import hmac
import secrets
from typing import Any, Dict, Optional

from fastapi import HTTPException, Request

from .config import settings
from .database import get_session, get_user_by_id


def hash_password(password: str) -> str:
    salt = secrets.token_bytes(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, 200000)
    return f"pbkdf2_sha256${salt.hex()}${digest.hex()}"


def verify_password(password: str, stored: str) -> bool:
    try:
        algorithm, salt_hex, digest_hex = stored.split("$", 2)
        if algorithm != "pbkdf2_sha256":
            return False
        salt = bytes.fromhex(salt_hex)
        expected = bytes.fromhex(digest_hex)
        actual = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, 200000)
        return hmac.compare_digest(actual, expected)
    except Exception:
        return False


def create_session_token() -> str:
    return secrets.token_urlsafe(48)


def normalize_email(email: str) -> str:
    return email.strip().lower()


def allowed_email_domain(email: str) -> bool:
    em = normalize_email(email)
    return any(em.endswith(domain) for domain in settings.allowed_domains)


def sanitize_user(user: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "id": user["id"],
        "email": user["email"],
        "role": user["role"],
        "approved": bool(user["approved"]),
        "is_active": bool(user["is_active"]),
        "created_at": user["created_at"],
        "approved_at": user["approved_at"],
        "property_customer_id": user.get("property_customer_id"),
        "property_name": user.get("property_name"),
    }


def get_current_user(request: Request) -> Dict[str, Any]:
    token = request.cookies.get(settings.session_cookie_name)
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")

    session = get_session(token)
    if not session:
        raise HTTPException(status_code=401, detail="Session expired or invalid")

    user = get_user_by_id(int(session["user_id"]))
    if not user or not bool(user["is_active"]):
        raise HTTPException(status_code=401, detail="User is inactive")

    if not bool(user["approved"]):
        raise HTTPException(status_code=403, detail="Account pending admin approval")

    return user


def require_admin(user: Dict[str, Any]) -> None:
    if user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")


def ensure_ticket_owner_or_admin(user: Dict[str, Any], ticket: Dict[str, Any]) -> None:
    if user["role"] == "admin":
        return

    ticket_email = (ticket.get("EndUserEmail") or "").strip().lower()
    if ticket_email != user["email"]:
        raise HTTPException(status_code=403, detail="You can only access your own tickets")
