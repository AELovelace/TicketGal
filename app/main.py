import os
import json
import re
import secrets
import math
import time
import asyncio
import tempfile
from urllib.parse import urlencode
from email import policy
from email.parser import BytesParser
from email.utils import parseaddr
from html import unescape
from pathlib import Path
from typing import Any, Dict, List, Optional

import httpx
import msal
from fastapi import Depends, FastAPI, File, HTTPException, Query, Request, Response, UploadFile
from fastapi.responses import FileResponse, JSONResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles

from .atera_client import AteraApiError, AteraClient
from .auth import (
    allowed_email_domain,
    create_session_token,
    ensure_ticket_owner_or_admin,
    get_current_user,
    hash_password,
    normalize_email,
    require_admin,
    sanitize_user,
    verify_password,
)
from .config import settings
from .database import (
    approve_user,
    assign_user_property,
    create_session,
    create_user,
    delete_user,
    delete_session,
    get_session,
    get_signups_enabled,
    get_user_by_email,
    get_user_by_id,
    get_user_by_microsoft_identity,
    get_user_theme_enabled,
    init_db,
    list_cached_tickets,
    link_user_microsoft_account,
    list_users,
    log_audit_event,
    replace_ticket_cache_snapshot,
    reset_user_password,
    seed_admin,
    set_site_setting,
    set_signups_enabled,
    set_user_theme_enabled,
    update_user_role,
)
from .schemas import (
    AddTicketCommentRequest,
    AdminAssignPropertyRequest,
    AdminResetPasswordRequest,
    AdminUpdateRoleRequest,
    CreateTicketRequest,
    LoginRequest,
    RegisterRequest,
    TicketAiAssistRequest,
    TicketAiAssistResponse,
    TicketStatusUpdateRequest,
)


ADMIN_ALLOWED_STATUSES = {"Open", "Pending", "Closed", "Resolved"}
USER_ALLOWED_STATUSES = {"Open", "Resolved"}
USER_LOCKED_STATUSES = {"pending", "closed", "pending closed"}
TICKETGAL_NEWLINE_DELIMITER = "¥"

MICROSOFT_STATE_COOKIE = "ticketgal_ms_state"
MICROSOFT_NONCE_COOKIE = "ticketgal_ms_nonce"
MICROSOFT_FLOW_COOKIE_MAX_AGE = 600
MICROSOFT_RESERVED_SCOPES = {"openid", "profile", "offline_access"}
CSRF_COOKIE_NAME = "ticketgal_csrf"
CSRF_HEADER_NAME = "x-csrf-token"
CSRF_EXEMPT_PATHS = {
    "/auth/login",
    "/auth/register",
    "/auth/microsoft/login",
    "/auth/logout",
}
CONTENT_SECURITY_POLICY = "; ".join(
    [
        "default-src 'self'",
        "base-uri 'self'",
        "frame-ancestors 'none'",
        "object-src 'none'",
        "script-src 'self'",
        "style-src 'self'",
        "img-src 'self' data:",
        "connect-src 'self'",
        "font-src 'self'",
        "form-action 'self'",
        "upgrade-insecure-requests",
    ]
)

TICKET_CACHE_PAGE_SIZE = 50
STARTUP_TICKET_RATE_LIMIT_PER_MINUTE = 500
REFRESH_REQUESTS_PER_MINUTE = 200
REFRESH_INTERVAL_SECONDS = 60

ticket_cache_refresh_task: Optional[asyncio.Task[Any]] = None
ticket_cache_sync_lock = asyncio.Lock()


async def run_initial_ticket_cache_sync() -> None:
    try:
        await sync_ticket_cache_full(request_limit_per_minute=_startup_requests_per_minute())
    except Exception as exc:
        set_site_setting("ticket_cache_last_error", f"Startup sync failed: {exc}")


app = FastAPI(title="TicketGal", version="0.2.0")
client = AteraClient()

static_dir = Path(__file__).parent / "static"
app.mount("/static", StaticFiles(directory=str(static_dir)), name="static")


class MinuteRateLimiter:
    def __init__(self, limit_per_minute: int) -> None:
        self.limit_per_minute = max(1, int(limit_per_minute))
        self.window_started = time.monotonic()
        self.used_in_window = 0

    async def wait_for_slot(self) -> None:
        now = time.monotonic()
        elapsed = now - self.window_started
        if elapsed >= 60:
            self.window_started = now
            self.used_in_window = 0

        if self.used_in_window >= self.limit_per_minute:
            sleep_for = max(0.0, 60.0 - elapsed)
            if sleep_for > 0:
                await asyncio.sleep(sleep_for)
            self.window_started = time.monotonic()
            self.used_in_window = 0

        self.used_in_window += 1


def _startup_requests_per_minute() -> int:
    return max(1, math.ceil(STARTUP_TICKET_RATE_LIMIT_PER_MINUTE / TICKET_CACHE_PAGE_SIZE))


async def sync_ticket_cache_full(request_limit_per_minute: int) -> Dict[str, Any]:
    async with ticket_cache_sync_lock:
        limiter = MinuteRateLimiter(request_limit_per_minute)

        all_tickets: List[Dict[str, Any]] = []
        seen_ids: set[int] = set()
        page = 1
        requests_made = 0
        max_pages = 2000

        while page <= max_pages:
            await limiter.wait_for_slot()
            result = await client.list_tickets(
                page=page,
                items_in_page=TICKET_CACHE_PAGE_SIZE,
                customer_id=None,
                ticket_status=None,
                include_relations=False,
            )
            requests_made += 1

            items = result.get("items", []) if isinstance(result, dict) else []
            if not items:
                break

            for ticket in items:
                ticket_id_raw = ticket.get("TicketID")
                try:
                    ticket_id = int(ticket_id_raw)
                except (TypeError, ValueError):
                    continue
                if ticket_id in seen_ids:
                    continue
                seen_ids.add(ticket_id)
                all_tickets.append(ticket)

            if len(items) < TICKET_CACHE_PAGE_SIZE:
                break

            page += 1

        cached_count = replace_ticket_cache_snapshot(all_tickets)
        set_site_setting("ticket_cache_last_success_at", str(time.time()))
        set_site_setting("ticket_cache_last_error", "")

        return {
            "cached_count": cached_count,
            "requests_made": requests_made,
        }


async def ticket_cache_refresh_loop() -> None:
    while True:
        await asyncio.sleep(REFRESH_INTERVAL_SECONDS)
        try:
            await sync_ticket_cache_full(request_limit_per_minute=REFRESH_REQUESTS_PER_MINUTE)
        except Exception as exc:
            set_site_setting("ticket_cache_last_error", str(exc))


@app.middleware("http")
async def csrf_protect(request: Request, call_next: Any) -> Response:
    if request.method.upper() in {"POST", "PUT", "PATCH", "DELETE"}:
        path = request.url.path
        session_token = request.cookies.get(settings.session_cookie_name)
        exempt = path in CSRF_EXEMPT_PATHS or path == settings.microsoft_redirect_path

        if session_token and not exempt:
            csrf_cookie = request.cookies.get(CSRF_COOKIE_NAME)
            csrf_header = request.headers.get(CSRF_HEADER_NAME, "")
            if not csrf_cookie or not csrf_header or not secrets.compare_digest(csrf_cookie, csrf_header):
                return JSONResponse(status_code=403, content={"detail": "CSRF validation failed"})

    return await call_next(request)


@app.middleware("http")
async def security_headers(request: Request, call_next: Any) -> Response:
    response = await call_next(request)
    response.headers["Content-Security-Policy"] = CONTENT_SECURITY_POLICY
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"
    if _session_cookie_secure(request):
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    return response


def _session_cookie_secure(request: Request) -> bool:
    if settings.public_base_url:
        return settings.public_base_url.lower().startswith("https://")
    forwarded_proto = request.headers.get("x-forwarded-proto", "")
    if forwarded_proto:
        return forwarded_proto.split(",", 1)[0].strip().lower() == "https"
    return request.url.scheme == "https"


def _set_user_session(response: Response, request: Request, user: Dict[str, Any]) -> None:
    token = create_session_token()
    session = create_session(int(user["id"]), token)
    secure = _session_cookie_secure(request)
    response.set_cookie(
        key=settings.session_cookie_name,
        value=session["token"],
        httponly=True,
        secure=secure,
        samesite="lax",
        max_age=settings.session_hours * 3600,
    )
    response.set_cookie(
        key=CSRF_COOKIE_NAME,
        value=secrets.token_urlsafe(32),
        httponly=False,
        secure=secure,
        samesite="lax",
        max_age=settings.session_hours * 3600,
    )


def _microsoft_authority() -> str:
    return f"https://login.microsoftonline.com/{settings.microsoft_tenant_id}"


def _require_microsoft_auth() -> None:
    if not settings.microsoft_enabled:
        raise HTTPException(status_code=503, detail="Microsoft 365 authentication is not configured")


def _get_microsoft_app() -> msal.ConfidentialClientApplication:
    _require_microsoft_auth()
    return msal.ConfidentialClientApplication(
        settings.microsoft_client_id,
        authority=_microsoft_authority(),
        client_credential=settings.microsoft_client_secret,
    )


def _get_public_base_url(request: Request) -> str:
    if settings.public_base_url:
        return settings.public_base_url
    return str(request.base_url).rstrip("/")


def _get_microsoft_redirect_uri(request: Request) -> str:
    return f"{_get_public_base_url(request)}{settings.microsoft_redirect_path}"


def _get_microsoft_auth_scopes() -> List[str]:
    scopes = [scope for scope in settings.microsoft_scopes if scope.lower() not in MICROSOFT_RESERVED_SCOPES]
    if scopes:
        return scopes
    # Keep at least one non-reserved delegated scope so MSAL can build the request URL.
    return ["User.Read"]


def _microsoft_tenant_allowed(microsoft_tenant_id: Optional[str]) -> bool:
    allowed_tenants = settings.allowed_microsoft_tenant_ids
    if not allowed_tenants:
        return True
    if not microsoft_tenant_id:
        return False
    return microsoft_tenant_id in allowed_tenants


def _clear_microsoft_oauth_cookies(response: Response) -> None:
    response.delete_cookie(MICROSOFT_STATE_COOKIE)
    response.delete_cookie(MICROSOFT_NONCE_COOKIE)


def _build_auth_redirect(message: Optional[str] = None, success: Optional[str] = None) -> RedirectResponse:
    query: Dict[str, str] = {}
    if message:
        query["auth_error"] = message
    if success:
        query["auth_success"] = success

    url = "/"
    if query:
        url = f"/?{urlencode(query)}"

    response = RedirectResponse(url=url, status_code=303)
    _clear_microsoft_oauth_cookies(response)
    return response


def _extract_microsoft_email(claims: Dict[str, Any]) -> str:
    candidates: List[Any] = [
        claims.get("preferred_username"),
        claims.get("email"),
    ]
    emails = claims.get("emails")
    if isinstance(emails, list):
        candidates.extend(emails)

    for candidate in candidates:
        text = normalize_email(str(candidate or ""))
        if text and "@" in text:
            return text
    return ""


def _claims_indicate_mfa(claims: Dict[str, Any]) -> Optional[bool]:
    amr = claims.get("amr")
    if isinstance(amr, list):
        values = {str(item).strip().lower() for item in amr}
        return "mfa" in values

    acrs = claims.get("acrs")
    if isinstance(acrs, list):
        values = {str(item).strip().lower() for item in acrs}
        return "c1" in values

    # No explicit MFA evidence in token claims; treat as unknown instead of hard-fail.
    return None


def _audit(actor_user_id: Optional[int], action: str, target_user_id: Optional[int] = None, metadata: Optional[Dict[str, Any]] = None) -> None:
    metadata_json = json.dumps(metadata, separators=(",", ":"), sort_keys=True) if metadata else None
    log_audit_event(actor_user_id=actor_user_id, action=action, target_user_id=target_user_id, metadata_json=metadata_json)


def _resolve_microsoft_user(email: str, microsoft_oid: str, microsoft_tenant_id: Optional[str]) -> Dict[str, Any]:
    linked_user = get_user_by_microsoft_identity(microsoft_oid, microsoft_tenant_id)
    email_user = get_user_by_email(email)

    if linked_user and email_user and int(linked_user["id"]) != int(email_user["id"]):
        raise HTTPException(status_code=409, detail="Microsoft account is already linked to a different TicketGal user")

    user = linked_user or email_user
    if user:
        existing_oid = (user.get("microsoft_oid") or "").strip()
        existing_tid = (user.get("microsoft_tenant_id") or "").strip()
        if existing_oid:
            if existing_oid != microsoft_oid:
                raise HTTPException(status_code=403, detail="Microsoft account does not match the linked TicketGal user")
            if existing_tid and microsoft_tenant_id and existing_tid != microsoft_tenant_id:
                raise HTTPException(status_code=403, detail="Microsoft tenant does not match the linked TicketGal user")
        elif not link_user_microsoft_account(int(user["id"]), microsoft_oid, microsoft_tenant_id):
            raise HTTPException(status_code=500, detail="Failed to link Microsoft account")

        refreshed_user = get_user_by_id(int(user["id"]))
        if not refreshed_user:
            raise HTTPException(status_code=500, detail="Linked user could not be reloaded")
        return refreshed_user

    if not allowed_email_domain(email):
        raise HTTPException(status_code=403, detail="Microsoft account email is not allowed for this portal")

    if not get_signups_enabled():
        raise HTTPException(status_code=403, detail="New user signups are currently disabled")

    return create_user(
        email=email,
        role="user",
        password_hash=None,
        approved=False,
        microsoft_oid=microsoft_oid,
        microsoft_tenant_id=microsoft_tenant_id,
    )


@app.on_event("startup")
async def startup() -> None:
    global ticket_cache_refresh_task

    init_db()
    if settings.admin_email and settings.admin_password:
        seed_admin(settings.admin_email, hash_password(settings.admin_password))

    asyncio.create_task(run_initial_ticket_cache_sync())

    ticket_cache_refresh_task = asyncio.create_task(ticket_cache_refresh_loop())


@app.on_event("shutdown")
async def shutdown() -> None:
    global ticket_cache_refresh_task

    if ticket_cache_refresh_task:
        ticket_cache_refresh_task.cancel()
        try:
            await ticket_cache_refresh_task
        except asyncio.CancelledError:
            pass
        ticket_cache_refresh_task = None


@app.get("/")
async def index() -> FileResponse:
    return FileResponse(static_dir / "index.html")


@app.get("/register")
async def register_page() -> FileResponse:
    return FileResponse(static_dir / "register.html")


@app.get("/health")
async def health() -> Dict[str, str]:
    return {"status": "ok"}


@app.get("/auth/providers")
def auth_providers() -> Dict[str, Any]:
    return {
        "microsoft_enabled": settings.microsoft_enabled,
        "microsoft_label": "Sign in with Microsoft 365",
        "user_password_auth_enabled": settings.user_password_auth_enabled,
        "password_login_admin_only": not settings.user_password_auth_enabled,
    }


@app.post("/auth/register")
def register(request: RegisterRequest) -> Dict[str, Any]:
    if not settings.user_password_auth_enabled:
        raise HTTPException(
            status_code=403,
            detail="User password registration is disabled. Use Microsoft 365 sign-in.",
        )

    if not get_signups_enabled():
        raise HTTPException(status_code=403, detail="New user registration is currently disabled by the administrator.")

    email = normalize_email(request.email)

    if not allowed_email_domain(email):
        raise HTTPException(
            status_code=400,
            detail="Registration email must use @eternalhotels.com or @redlionpasco.com",
        )

    existing = get_user_by_email(email)
    if existing:
        raise HTTPException(status_code=409, detail="Account already exists")

    user = create_user(
        email=email,
        role="user",
        password_hash=hash_password(request.password),
        approved=False,
    )

    return {
        "message": "Registration submitted. An administrator must approve your account.",
        "user": sanitize_user(user),
    }


@app.post("/auth/login")
def login(login_request: LoginRequest, request: Request, response: Response) -> Dict[str, Any]:
    email = normalize_email(login_request.email)
    user = get_user_by_email(email)
    if not user:
        _audit(None, "auth.login.failed", metadata={"email": email, "reason": "unknown_user"})
        raise HTTPException(status_code=401, detail="Invalid credentials")

    if user.get("role") != "admin" and not settings.user_password_auth_enabled:
        raise HTTPException(
            status_code=403,
            detail="User password login is disabled. Sign in with Microsoft 365.",
        )

    if not bool(user["is_active"]):
        raise HTTPException(status_code=403, detail="Account is inactive")

    if not bool(user["approved"]):
        raise HTTPException(status_code=403, detail="Account pending admin approval")

    if not user["password_hash"]:
        raise HTTPException(status_code=401, detail="Account password is not configured")

    if not verify_password(login_request.password, user["password_hash"]):
        _audit(int(user["id"]), "auth.login.failed", metadata={"email": email, "reason": "bad_password"})
        raise HTTPException(status_code=401, detail="Invalid credentials")

    _set_user_session(response, request, user)
    _audit(int(user["id"]), "auth.login.success", metadata={"method": "password"})

    return {"message": "Logged in", "user": sanitize_user(user)}


@app.get("/auth/microsoft/login")
def microsoft_login(request: Request) -> RedirectResponse:
    app_client = _get_microsoft_app()
    state = secrets.token_urlsafe(24)
    nonce = secrets.token_urlsafe(24)
    request_url_kwargs: Dict[str, Any] = {
        "scopes": _get_microsoft_auth_scopes(),
        "state": state,
        "nonce": nonce,
        "redirect_uri": _get_microsoft_redirect_uri(request),
        "response_mode": "query",
    }
    if settings.microsoft_prompt:
        request_url_kwargs["prompt"] = settings.microsoft_prompt

    try:
        auth_url = app_client.get_authorization_request_url(**request_url_kwargs)
    except ValueError:
        return _build_auth_redirect(message="Microsoft scopes are invalid. Check MICROSOFT_SCOPES.")

    response = RedirectResponse(url=auth_url, status_code=303)
    secure = _session_cookie_secure(request)
    response.set_cookie(
        MICROSOFT_STATE_COOKIE,
        state,
        httponly=True,
        secure=secure,
        samesite="lax",
        max_age=MICROSOFT_FLOW_COOKIE_MAX_AGE,
    )
    response.set_cookie(
        MICROSOFT_NONCE_COOKIE,
        nonce,
        httponly=True,
        secure=secure,
        samesite="lax",
        max_age=MICROSOFT_FLOW_COOKIE_MAX_AGE,
    )
    return response


@app.get(settings.microsoft_redirect_path)
def microsoft_callback(
    request: Request,
    code: Optional[str] = None,
    state: Optional[str] = None,
    error: Optional[str] = None,
    error_description: Optional[str] = None,
) -> RedirectResponse:
    _require_microsoft_auth()

    if error:
        message = "Microsoft sign-in was cancelled"
        if error not in {"access_denied", "user_cancelled"}:
            message = error_description or "Microsoft sign-in failed"
        return _build_auth_redirect(message=message)

    expected_state = request.cookies.get(MICROSOFT_STATE_COOKIE)
    nonce = request.cookies.get(MICROSOFT_NONCE_COOKIE)
    if not state or not expected_state or not secrets.compare_digest(state, expected_state):
        return _build_auth_redirect(message="Microsoft sign-in state validation failed")

    if not code or not nonce:
        return _build_auth_redirect(message="Microsoft sign-in response was incomplete")

    app_client = _get_microsoft_app()
    result = app_client.acquire_token_by_authorization_code(
        code=code,
        scopes=_get_microsoft_auth_scopes(),
        redirect_uri=_get_microsoft_redirect_uri(request),
        nonce=nonce,
    )

    if "error" in result:
        message = str(result.get("error_description") or result.get("error") or "Microsoft sign-in failed")
        return _build_auth_redirect(message=message)

    claims = result.get("id_token_claims") if isinstance(result, dict) else None
    if not isinstance(claims, dict):
        return _build_auth_redirect(message="Microsoft sign-in did not return identity claims")

    email = _extract_microsoft_email(claims)
    microsoft_oid = str(claims.get("oid") or claims.get("sub") or "").strip()
    microsoft_tenant_id = str(claims.get("tid") or "").strip() or None

    if not email:
        return _build_auth_redirect(message="Microsoft account did not provide an email address")
    if not microsoft_oid:
        return _build_auth_redirect(message="Microsoft account did not provide a stable identity")
    if not _microsoft_tenant_allowed(microsoft_tenant_id):
        return _build_auth_redirect(message="Microsoft tenant is not allowed for this portal")
    mfa_claim = _claims_indicate_mfa(claims)
    if settings.microsoft_require_mfa and mfa_claim is False:
        return _build_auth_redirect(message="Microsoft sign-in must complete MFA to access this portal")

    try:
        user = _resolve_microsoft_user(email, microsoft_oid, microsoft_tenant_id)
    except HTTPException as exc:
        return _build_auth_redirect(message=str(exc.detail))

    # Keep configured bootstrap admin identity authoritative even if this account
    # was previously created as a standard user before admin seeding finalized.
    if settings.admin_email and normalize_email(email) == normalize_email(settings.admin_email):
        if user.get("role") != "admin":
            update_user_role(int(user["id"]), "admin")
        if not bool(user.get("approved")):
            approve_user(int(user["id"]))
        refreshed = get_user_by_id(int(user["id"]))
        if refreshed:
            user = refreshed

    if not bool(user.get("is_active")):
        return _build_auth_redirect(message="Account is inactive")

    if not bool(user.get("approved")):
        return _build_auth_redirect(message="Account pending admin approval")

    response = _build_auth_redirect(success="microsoft")
    _set_user_session(response, request, user)
    _audit(int(user["id"]), "auth.login.success", metadata={"method": "microsoft"})
    return response


@app.post("/auth/logout")
def logout(request: Request, response: Response) -> Dict[str, str]:
    token = request.cookies.get(settings.session_cookie_name)
    actor_user_id: Optional[int] = None
    if token:
        session = get_session(token)
        if session:
            actor_user_id = int(session.get("user_id"))
    if token:
        delete_session(token)

    response.delete_cookie(settings.session_cookie_name)
    response.delete_cookie(CSRF_COOKIE_NAME)
    _audit(actor_user_id, "auth.logout")
    return {"message": "Logged out"}


@app.get("/auth/me")
def auth_me(user: Dict[str, Any] = Depends(get_current_user)) -> Dict[str, Any]:
    return {"user": sanitize_user(user)}


@app.get("/api/admin/users")
def admin_users(
    pending_only: bool = Query(False),
    user: Dict[str, Any] = Depends(get_current_user),
) -> Dict[str, List[Dict[str, Any]]]:
    require_admin(user)
    users = [sanitize_user(item) for item in list_users(pending_only)]
    return {"items": users}


@app.post("/api/admin/users/{user_id}/approve")
def admin_approve_user(user_id: int, user: Dict[str, Any] = Depends(get_current_user)) -> Dict[str, str]:
    require_admin(user)
    if not approve_user(user_id):
        raise HTTPException(status_code=404, detail="User not found")
    _audit(int(user["id"]), "admin.user.approve", target_user_id=user_id)
    return {"message": "User approved"}


@app.patch("/api/admin/users/{user_id}/role")
def admin_update_user_role(
    user_id: int,
    request: AdminUpdateRoleRequest,
    user: Dict[str, Any] = Depends(get_current_user),
) -> Dict[str, str]:
    require_admin(user)
    if not update_user_role(user_id, request.role):
        raise HTTPException(status_code=404, detail="User not found")
    _audit(int(user["id"]), "admin.user.role_update", target_user_id=user_id, metadata={"role": request.role})
    return {"message": "User role updated"}


@app.delete("/api/admin/users/{user_id}")
def admin_delete_user(user_id: int, user: Dict[str, Any] = Depends(get_current_user)) -> Dict[str, str]:
    require_admin(user)
    if int(user["id"]) == user_id:
        raise HTTPException(status_code=400, detail="Cannot delete your own account")
    if not delete_user(user_id):
        raise HTTPException(status_code=404, detail="User not found")
    _audit(int(user["id"]), "admin.user.delete", target_user_id=user_id)
    return {"message": "User deleted"}


@app.post("/api/admin/users/{user_id}/reset-password")
def admin_reset_user_password(
    user_id: int,
    request: AdminResetPasswordRequest,
    user: Dict[str, Any] = Depends(get_current_user),
) -> Dict[str, str]:
    require_admin(user)

    if not reset_user_password(user_id, hash_password(request.new_password)):
        raise HTTPException(status_code=404, detail="User not found")

    _audit(int(user["id"]), "admin.user.password_reset", target_user_id=user_id)

    return {"message": "User password reset"}


@app.patch("/api/admin/theme")
def toggle_admin_theme(
    user: Dict[str, Any] = Depends(get_current_user),
) -> Dict[str, Any]:
    require_admin(user)
    user_id = int(user["id"])
    current_enabled = get_user_theme_enabled(user_id)
    new_enabled = not current_enabled
    set_user_theme_enabled(user_id, new_enabled)
    return {"theme_enabled": new_enabled, "message": "Theme preference updated"}


@app.get("/api/settings/signups")
def check_signups_status() -> Dict[str, Any]:
    return {"signups_enabled": get_signups_enabled()}


@app.patch("/api/admin/signups")
def toggle_signups(
    user: Dict[str, Any] = Depends(get_current_user),
) -> Dict[str, Any]:
    require_admin(user)
    current = get_signups_enabled()
    new_state = not current
    set_signups_enabled(new_state)
    _audit(int(user["id"]), "admin.signups.toggle", metadata={"enabled": new_state})
    return {"signups_enabled": new_state, "message": "Signups " + ("enabled" if new_state else "disabled")}


@app.get("/api/admin/properties")
async def admin_list_properties(user: Dict[str, Any] = Depends(get_current_user)) -> Dict[str, Any]:
    require_admin(user)
    try:
        result = await client.list_properties(page=1, items_in_page=500)
    except AteraApiError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc

    items = result.get("items", []) if isinstance(result, dict) else []
    mapped = [
        {
            "customer_id": item.get("CustomerID"),
            "customer_name": item.get("CustomerName"),
        }
        for item in items
        if item.get("CustomerID") is not None
    ]
    return {"items": mapped}


@app.patch("/api/admin/users/{user_id}/property")
async def admin_assign_user_property(
    user_id: int,
    request: AdminAssignPropertyRequest,
    user: Dict[str, Any] = Depends(get_current_user),
) -> Dict[str, str]:
    require_admin(user)

    if request.property_customer_id is None:
        if not assign_user_property(user_id, None, None):
            raise HTTPException(status_code=404, detail="User not found")
        return {"message": "Property assignment cleared"}

    try:
        properties = await client.list_properties(page=1, items_in_page=500)
    except AteraApiError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc

    items = properties.get("items", []) if isinstance(properties, dict) else []
    matched = next((item for item in items if item.get("CustomerID") == request.property_customer_id), None)
    if not matched:
        raise HTTPException(status_code=400, detail="Selected property not found in Atera")

    property_name = matched.get("CustomerName") or request.property_name or ""
    if not assign_user_property(user_id, request.property_customer_id, property_name):
        raise HTTPException(status_code=404, detail="User not found")

    return {"message": "User property assignment updated"}


def _normalize_status_input(status: str) -> str:
    cleaned = status.strip().lower()
    mapping = {
        "open": "Open",
        "pending": "Pending",
        "pending closed": "Pending",
        "closed": "Closed",
        "resolved": "Resolved",
    }
    normalized = mapping.get(cleaned)
    if not normalized:
        raise HTTPException(status_code=400, detail="Unsupported status value")
    return normalized


def _normalize_parsed_text(value: str) -> str:
    return re.sub(r"\n{3,}", "\n\n", value.replace("\r\n", "\n")).strip()


def _encode_ticketgal_newlines(value: Any) -> str:
    text = str(value or "")
    normalized = text.replace("\r\n", "\n").replace("\r", "\n")
    return normalized.replace("\n", TICKETGAL_NEWLINE_DELIMITER)


def _html_to_text(html: str) -> str:
    cleaned = re.sub(r"<script[\s\S]*?</script>", "", html, flags=re.IGNORECASE)
    cleaned = re.sub(r"<style[\s\S]*?</style>", "", cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r"<(br|/p|/div|/li|/tr|/h[1-6])\b[^>]*>", "\n", cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r"<[^>]+>", "", cleaned)
    return _normalize_parsed_text(unescape(cleaned))


def _get_decoded_part_text(part: Any) -> str:
    payload = part.get_payload(decode=True)
    if payload is None:
        raw = part.get_payload()
        return _normalize_parsed_text(str(raw) if raw is not None else "")

    charset = part.get_content_charset() or "utf-8"
    try:
        return _normalize_parsed_text(payload.decode(charset, errors="replace"))
    except LookupError:
        return _normalize_parsed_text(payload.decode("utf-8", errors="replace"))


def _extract_eml_body(message: Any) -> str:
    plain_text = ""
    html_text = ""

    for part in message.walk() if message.is_multipart() else [message]:
        content_disposition = (part.get("Content-Disposition") or "").lower()
        if "attachment" in content_disposition:
            continue

        content_type = (part.get_content_type() or "").lower()
        if content_type == "text/plain" and not plain_text:
            plain_text = _get_decoded_part_text(part)
        elif content_type == "text/html" and not html_text:
            html_text = _html_to_text(_get_decoded_part_text(part))

    return plain_text or html_text


def _parse_eml_bytes(content: bytes) -> Dict[str, str]:
    message = BytesParser(policy=policy.default).parsebytes(content)
    from_header = str(message.get("from") or "")
    _, from_email = parseaddr(from_header)

    return {
        "subject": str(message.get("subject") or "").strip(),
        "from": (from_email or "").strip().lower(),
        "body": _extract_eml_body(message),
    }


def _parse_msg_bytes(content: bytes) -> Dict[str, str]:
    try:
        import extract_msg  # type: ignore
    except ImportError as exc:
        raise HTTPException(status_code=500, detail="MSG parser dependency not installed") from exc

    temp_path = ""
    msg_obj = None
    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=".msg") as temp_file:
            temp_file.write(content)
            temp_path = temp_file.name

        msg_obj = extract_msg.Message(temp_path)

        subject = str(getattr(msg_obj, "subject", "") or "").strip()

        sender_raw = (
            getattr(msg_obj, "sender", None)
            or getattr(msg_obj, "sender_email", None)
            or getattr(msg_obj, "senderEmail", None)
            or ""
        )
        _, from_email = parseaddr(str(sender_raw))

        body = str(getattr(msg_obj, "body", "") or "")
        if not body:
            html_body = getattr(msg_obj, "htmlBody", None)
            if isinstance(html_body, bytes):
                html_value = html_body.decode("utf-8", errors="replace")
            else:
                html_value = str(html_body or "")
            body = _html_to_text(html_value)

        return {
            "subject": subject,
            "from": (from_email or "").strip().lower(),
            "body": _normalize_parsed_text(body),
        }
    finally:
        if msg_obj and hasattr(msg_obj, "close"):
            try:
                msg_obj.close()
            except Exception:
                pass
        if temp_path:
            try:
                os.remove(temp_path)
            except OSError:
                pass


def _coerce_ai_text(value: Any, max_length: int = 4000) -> str:
    text = _normalize_parsed_text(str(value or ""))
    return text[:max_length]


def _coerce_ai_priority(value: Any) -> Optional[str]:
    normalized = str(value or "").strip().title()
    return normalized if normalized in {"Low", "Medium", "High", "Critical"} else None


def _coerce_ai_type(value: Any) -> Optional[str]:
    normalized = str(value or "").strip().title()
    return normalized if normalized in {"Incident", "Problem", "Request", "Change"} else None


def _extract_json_object(raw_content: str) -> Dict[str, Any]:
    value = raw_content.strip()
    if not value:
        return {}

    try:
        parsed = json.loads(value)
        return parsed if isinstance(parsed, dict) else {}
    except json.JSONDecodeError:
        pass

    start = value.find("{")
    end = value.rfind("}")
    if start == -1 or end == -1 or end <= start:
        return {}

    maybe_json = value[start : end + 1]
    try:
        parsed = json.loads(maybe_json)
        return parsed if isinstance(parsed, dict) else {}
    except json.JSONDecodeError:
        return {}


def _extract_ai_message_content(body: Any) -> str:
    if not isinstance(body, dict):
        return ""

    choices = body.get("choices")
    if isinstance(choices, list) and choices:
        message = choices[0].get("message", {}) if isinstance(choices[0], dict) else {}
        if isinstance(message, dict):
            content = message.get("content", "")
            if isinstance(content, list):
                return "\n".join(str(item.get("text", "")) for item in content if isinstance(item, dict))
            return str(content or "")

    message = body.get("message")
    if isinstance(message, dict):
        content = message.get("content", "")
        if content:
            return str(content)
        # qwen3 / reasoning models put output in 'thinking' when think:true and content is empty
        thinking = message.get("thinking", "")
        if thinking:
            return str(thinking)

    response = body.get("response")
    if response is not None:
        return str(response)

    return ""


def _looks_like_ollama_base_url(base_url: str) -> bool:
    lowered = base_url.strip().lower()
    return "11434" in lowered or "ollama" in lowered


def _provider_requires_api_key(base_url: str) -> bool:
    lowered = base_url.strip().lower()
    return "api.openai.com" in lowered


def _get_ollama_native_endpoint(base_url: str) -> str:
    normalized = base_url.rstrip("/")
    if normalized.endswith("/v1"):
        normalized = normalized[:-3]
    return f"{normalized}/api/chat"


def _sanitize_professional_language(text: str) -> str:
    cleaned = _normalize_parsed_text(text)
    replacements = [
        (r"\bfucked\s+up\b", "not functioning correctly"),
        (r"\bfuck(?:ing)?\b", ""),
        (r"\bfucked\b", "not functioning correctly"),
        (r"\bshit\b", "issue"),
        (r"\bcrap\b", "issue"),
        (r"\bdammit\b", ""),
        (r"\bdamn\b", ""),
        (r"\bpissed\s+off\b", "frustrated"),
        (r"\bsucks\b", "is not working well"),
        (r"\bwtf\b", "unexpected behavior"),
    ]

    for pattern, replacement in replacements:
        cleaned = re.sub(pattern, replacement, cleaned, flags=re.IGNORECASE)

    cleaned = re.sub(r"[!?.]{2,}", ".", cleaned)
    cleaned = re.sub(r"\s{2,}", " ", cleaned)
    cleaned = re.sub(r"\bASAP\b", "as soon as possible", cleaned, flags=re.IGNORECASE)
    return _normalize_parsed_text(cleaned)


def _rewrite_fallback_description(text: str) -> str:
    cleaned = _sanitize_professional_language(text)
    lowered = cleaned.lower()

    repeat_incident = bool(re.search(r"\bagain\b|\brepeat\b|\brecurring\b", lowered))

    if re.search(r"\bfork\b", lowered) and re.search(r"\boutlet\b|\bsocket\b", lowered):
        lines = [
            "Assist the user with diagnosing the computer after a fork was inserted into the electrical outlet.",
        ]
        if repeat_incident:
            lines.append("This appears to be a repeat incident.")
        return "\n".join(lines)

    if re.search(r"\bspill(?:ed|ing)?\b|\bwater\b|\bcoffee\b|\bliquid\b", lowered):
        lines = [
            "Assist the user with diagnosing the affected equipment after liquid exposure was reported.",
        ]
        if repeat_incident:
            lines.append("This appears to be a repeat incident.")
        return "\n".join(lines)

    lines = [line.strip(" -\t") for line in cleaned.split("\n") if line.strip()]
    if not lines:
        return ""

    rewritten_lines: List[str] = []
    for index, line in enumerate(lines):
        normalized_line = line
        normalized_line = re.sub(r"\bmy\b", "the user's", normalized_line, flags=re.IGNORECASE)
        normalized_line = re.sub(r"\buser says\b", "The user reports", normalized_line, flags=re.IGNORECASE)
        normalized_line = re.sub(r"\bcan'?t\b", "cannot", normalized_line, flags=re.IGNORECASE)
        normalized_line = re.sub(r"\bwon'?t\b", "will not", normalized_line, flags=re.IGNORECASE)
        normalized_line = re.sub(r"\bit'?s\b", "it is", normalized_line, flags=re.IGNORECASE)
        normalized_line = normalized_line.strip(" .")
        if not normalized_line:
            continue

        normalized_line = normalized_line[0].upper() + normalized_line[1:]
        if normalized_line[-1] not in ".!?":
            normalized_line = f"{normalized_line}."

        if index == 0 and not re.match(r"^(Assist|Diagnose|Investigate|Reported issue|Issue summary)\b", normalized_line, flags=re.IGNORECASE):
            normalized_line = f"Assist the user with diagnosing the issue: {normalized_line[0].lower() + normalized_line[1:]}"
            normalized_line = normalized_line[0].upper() + normalized_line[1:]

        rewritten_lines.append(normalized_line)

    if repeat_incident and not any("repeat incident" in line.lower() for line in rewritten_lines):
        rewritten_lines.append("This appears to be a repeat incident.")

    return "\n".join(rewritten_lines)


def _ensure_professional_description(text: str) -> str:
    return _rewrite_fallback_description(text)


def _infer_ticket_title(description: str, fallback_title: str) -> str:
    if fallback_title.strip():
        cleaned = _sanitize_professional_language(fallback_title).strip()
        words = cleaned.split()
        if len(words) > 5:
            cleaned = " ".join(words[:5]).rstrip(" ,;:-")
        return cleaned[:160]

    lowered = description.lower()
    if "fork" in lowered and ("outlet" in lowered or "socket" in lowered):
        return "Fork in Outlet Incident"
    if any(term in lowered for term in ["liquid", "water", "coffee", "spill"]):
        return "Equipment Liquid Exposure Incident"

    first_line = next((line.strip() for line in description.split("\n") if line.strip()), "")
    first_line = re.sub(r"^(Assist the user with diagnosing the issue:\s*|Assist the user with diagnosing\s*|Reported issue:|Issue summary:)\s*", "", first_line, flags=re.IGNORECASE).strip()
    if not first_line:
        return "Diagnose and Fix Reported Issue"

    sentence = re.split(r"[.!?]", first_line, maxsplit=1)[0].strip()
    sentence = re.sub(r"^the user\s+", "", sentence, flags=re.IGNORECASE)
    words = sentence.split()
    if len(words) > 2:
        sentence = " ".join(words[:2]).rstrip(" ,;:-")
    sentence = sentence[0].upper() + sentence[1:] if sentence else "Reported Issue"
    return f"Diagnose and Fix {sentence}"[:160]


def _infer_ticket_priority(description: str) -> Optional[str]:
    lowered = description.lower()
    if any(term in lowered for term in ["outage", "site down", "system down", "all users", "entire property", "everyone is affected"]):
        return "Critical"
    if any(term in lowered for term in ["cannot work", "can't work", "unable to", "down", "urgent", "as soon as possible", "blocked"]):
        return "High"
    if any(term in lowered for term in ["request", "access", "install", "setup", "password", "new user"]):
        return "Medium"
    return None


def _infer_ticket_type(description: str) -> Optional[str]:
    lowered = description.lower()
    if any(term in lowered for term in ["change window", "change request", "modify configuration", "update configuration"]):
        return "Change"
    if any(term in lowered for term in ["request", "need access", "new user", "install", "setup", "password reset"]):
        return "Request"
    if any(term in lowered for term in ["recurring", "keeps happening", "root cause", "intermittent over time"]):
        return "Problem"
    return "Incident"


@app.post("/api/emails/parse-drop")
async def parse_dropped_email(
    file: UploadFile = File(...),
    user: Dict[str, Any] = Depends(get_current_user),
) -> Dict[str, str]:
    _ = user

    filename = file.filename or ""
    extension = Path(filename).suffix.lower()
    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="Dropped file was empty")

    if extension == ".msg":
        parsed = _parse_msg_bytes(content)
    else:
        parsed = _parse_eml_bytes(content)

    if not parsed.get("subject") and filename:
        parsed["subject"] = Path(filename).stem

    return {
        "subject": _normalize_parsed_text(parsed.get("subject") or ""),
        "from": _normalize_parsed_text(parsed.get("from") or ""),
        "body": _normalize_parsed_text(parsed.get("body") or ""),
    }


@app.post("/api/tickets/ai-assist")
async def ai_assist_ticket(
    request: TicketAiAssistRequest,
    user: Dict[str, Any] = Depends(get_current_user),
) -> TicketAiAssistResponse:
    require_admin(user)

    description = _coerce_ai_text(request.description, max_length=6000)
    if not description:
        raise HTTPException(status_code=400, detail="Description is required")

    current_title = _coerce_ai_text(request.ticket_title or "", max_length=160)

    # Provide a graceful, deterministic fallback when using OpenAI-hosted endpoints
    # without credentials instead of bubbling raw provider errors to the UI.
    if _provider_requires_api_key(settings.openai_base_url) and not settings.openai_api_key:
        rewritten_description = _ensure_professional_description(description)
        return {
            "ticket_title": _infer_ticket_title(rewritten_description, current_title) or None,
            "description": rewritten_description,
            "ticket_priority": _infer_ticket_priority(rewritten_description),
            "ticket_type": _infer_ticket_type(rewritten_description),
            "fallback_used": True,
            "fallback_reason": "AI provider API key is not configured; using local fallback rewrite.",
        }

    user_prompt = (
        "Rewrite the ticket description in professional, concise IT helpdesk language and infer useful fields. "
        "Remove profanity, slang, insults, and emotionally charged wording while preserving the technical facts. "
        "Prefer action-oriented phrasing such as 'Diagnose and Fix ...' or 'Assist the user with diagnosing ...'. "
        "Do not include markdown. Return JSON only with these keys: "
        "ticket_title, description, ticket_priority, ticket_type. "
        "ticket_title must be 4 to 5 words maximum — short and action-oriented. "
        "Allowed ticket_priority values: Low, Medium, High, Critical, or empty string. "
        "Allowed ticket_type values: Incident, Problem, Request, Change, or empty string.\n\n"
        "Example rewrite style:\n"
        "Input: user stuck a fork in the outlet again\n"
        "Output description: Assist the user with diagnosing the computer after a fork was inserted into the electrical outlet. This appears to be a repeat incident.\n"
        "Output title: Fork in Outlet Repeat\n\n"
        f"Current title: {current_title or '(none)'}\n"
        f"Original description:\n{description}"
    )

    messages = [
        {
            "role": "system",
            "content": (
                "You are an IT service desk assistant. Produce a clean professional rewrite and infer fields "
                "from the user description. Never include status or end-user email in output. Return JSON only. "
                "ticket_title must be 4 to 5 words maximum."
            ),
        },
        {"role": "user", "content": user_prompt},
    ]

    payload: Dict[str, Any] = {
        "model": settings.openai_model,
        "messages": messages,
        "temperature": 0.2,
        "stream": False,
    }

    headers = {"Content-Type": "application/json"}
    if settings.openai_api_key:
        headers["Authorization"] = f"Bearer {settings.openai_api_key}"

    response: Optional[httpx.Response] = None
    body: Dict[str, Any] = {}

    try:
        async with httpx.AsyncClient(timeout=settings.openai_timeout_seconds) as http_client:
            if _looks_like_ollama_base_url(settings.openai_base_url):
                native_payload: Dict[str, Any] = {
                    "model": settings.openai_model,
                    "messages": messages,
                    "stream": False,
                    "format": "json",
                    "think": False,
                    "options": {
                        "temperature": 0.2,
                        "num_ctx": 131072,
                    },
                }
                response = await http_client.post(
                    _get_ollama_native_endpoint(settings.openai_base_url),
                    headers=headers,
                    json=native_payload,
                )
                if response.status_code < 400:
                    body = response.json() if response.content else {}
                else:
                    response = await http_client.post(
                        f"{settings.openai_base_url}/chat/completions",
                        headers=headers,
                        json=payload,
                    )
                    body = response.json() if response.content else {}
            else:
                response = await http_client.post(
                    f"{settings.openai_base_url}/chat/completions",
                    headers=headers,
                    json=payload,
                )
                body = response.json() if response.content else {}
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=502, detail="AI provider request failed. Please verify AI provider configuration.") from exc

    if response is None:
        raise HTTPException(status_code=502, detail="AI provider did not return a response")

    if response.status_code >= 400:
        if response.status_code in {401, 403}:
            raise HTTPException(
                status_code=502,
                detail="AI provider authentication failed. Check OPENAI_API_KEY and OPENAI_BASE_URL.",
            )
        raise HTTPException(
            status_code=502,
            detail="AI provider request failed. Review AI provider configuration and server logs.",
        )

    content = _extract_ai_message_content(body)

    parsed = _extract_json_object(str(content))
    raw_content = _coerce_ai_text(content, max_length=4000)

    description_value = (
        parsed.get("description")
        or parsed.get("rewritten_description")
        or parsed.get("professional_description")
        or parsed.get("body")
        or (raw_content if raw_content and raw_content != description else description)
    )
    title_value = parsed.get("ticket_title") or parsed.get("title") or parsed.get("subject") or current_title
    priority_value = parsed.get("ticket_priority") or parsed.get("priority")
    type_value = parsed.get("ticket_type") or parsed.get("type")

    ai_rewritten_description = _ensure_professional_description(_coerce_ai_text(description_value, max_length=4000))
    fallback_description = _ensure_professional_description(description)
    fallback_used = False
    fallback_reason: Optional[str] = None

    rewritten_description = ai_rewritten_description
    if not rewritten_description:
        rewritten_description = fallback_description
        fallback_used = True
        fallback_reason = "AI response did not include a usable description"
    elif rewritten_description == fallback_description:
        fallback_used = True
        fallback_reason = "Rule-based professional rewrite matched or replaced the AI draft"

    ticket_title = _coerce_ai_text(title_value, max_length=160)
    if not ticket_title:
        ticket_title = _infer_ticket_title(rewritten_description, current_title)
    else:
        ticket_title = _sanitize_professional_language(ticket_title).strip()
        words = ticket_title.split()
        if len(words) > 5:
            ticket_title = " ".join(words[:5]).rstrip(" ,;:-")
        ticket_title = ticket_title[:160]

    ticket_priority = _coerce_ai_priority(priority_value) or _infer_ticket_priority(rewritten_description)
    ticket_type = _coerce_ai_type(type_value) or _infer_ticket_type(rewritten_description)

    return {
        "ticket_title": ticket_title or None,
        "description": rewritten_description,
        "ticket_priority": ticket_priority,
        "ticket_type": ticket_type,
        "fallback_used": fallback_used,
        "fallback_reason": fallback_reason,
    }


@app.get("/api/tickets")
async def list_tickets(
    page: int = Query(1, ge=1),
    items_in_page: int = Query(50, ge=1, le=50),
    customer_id: Optional[int] = None,
    ticket_status: Optional[str] = None,
    include_relations: bool = False,
    user: Dict[str, Any] = Depends(get_current_user),
) -> Any:
    del include_relations

    if user["role"] == "admin":
        return list_cached_tickets(
            page=page,
            items_in_page=items_in_page,
            customer_id=customer_id,
            ticket_status=ticket_status,
        )

    return list_cached_tickets(
        page=page,
        items_in_page=items_in_page,
        customer_id=customer_id,
        ticket_status=ticket_status,
        end_user_email=user["email"],
    )


@app.get("/api/alerts")
async def list_alerts(user: Dict[str, Any] = Depends(get_current_user)) -> Dict[str, Any]:
    require_admin(user)
    try:
        result = await client.list_alerts()
    except AteraApiError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc

    if isinstance(result, dict):
        items = result.get("items")
        if isinstance(items, list):
            return {"items": items}

    if isinstance(result, list):
        return {"items": result}

    return {"items": []}


@app.post("/api/alerts/{alert_id}/dismiss")
async def dismiss_alert(alert_id: str, user: Dict[str, Any] = Depends(get_current_user)) -> Dict[str, Any]:
    require_admin(user)

    cleaned_alert_id = str(alert_id or "").strip()
    if not cleaned_alert_id:
        raise HTTPException(status_code=400, detail="Alert ID is required")

    try:
        result = await client.dismiss_alert(cleaned_alert_id)
    except AteraApiError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc

    return {"message": "Alert dismissed", "result": result}


@app.post("/api/tickets")
async def create_ticket(request: CreateTicketRequest, user: Dict[str, Any] = Depends(get_current_user)) -> Any:
    requested_status = _normalize_status_input(request.ticket_status) if request.ticket_status else None

    if user["role"] == "admin":
        if requested_status and requested_status not in ADMIN_ALLOWED_STATUSES:
            raise HTTPException(status_code=400, detail="Unsupported admin status")
    else:
        if requested_status and requested_status not in USER_ALLOWED_STATUSES:
            raise HTTPException(status_code=403, detail="Users can only set Open or Resolved")

    effective_customer_id: Optional[int] = None
    if user["role"] == "admin":
        effective_customer_id = request.customer_id
    else:
        effective_customer_id = user.get("property_customer_id")

    payload = {
        "TicketTitle": request.ticket_title,
        "Description": request.description,
        "TicketPriority": request.ticket_priority,
        "TicketImpact": request.ticket_impact,
        "TicketStatus": requested_status,
        "TicketType": request.ticket_type,
        "EndUserID": request.end_user_id,
        "EndUserFirstName": request.end_user_first_name,
        "EndUserLastName": request.end_user_last_name,
        "EndUserEmail": user["email"] if user["role"] != "admin" else request.end_user_email,
        "EndUserPhone": request.end_user_phone,
        "TechnicianContactID": request.technician_contact_id,
        "TechnicianEmail": request.technician_email,
        "CustomerID": effective_customer_id,
    }
    payload = {k: v for k, v in payload.items() if v is not None and v != ""}

    try:
        return await client.create_ticket(payload)
    except AteraApiError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@app.patch("/api/tickets/{ticket_id}/status")
async def set_ticket_status(
    ticket_id: int,
    request: TicketStatusUpdateRequest,
    user: Dict[str, Any] = Depends(get_current_user),
) -> Any:
    if user["role"] != "admin":
        raise HTTPException(
            status_code=403,
            detail="Users cannot change ticket status directly. Use Post Update to request resolution.",
        )

    normalized_status = _normalize_status_input(request.ticket_status)

    try:
        ticket = await client.get_ticket(ticket_id)
    except AteraApiError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc

    ensure_ticket_owner_or_admin(user, ticket)

    current_status = (ticket.get("TicketStatus") or "").strip().lower()

    if normalized_status not in ADMIN_ALLOWED_STATUSES:
        raise HTTPException(status_code=400, detail="Unsupported admin status")

    payload = {"TicketStatus": normalized_status}
    try:
        return await client.update_ticket(ticket_id=ticket_id, payload=payload)
    except AteraApiError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@app.post("/api/tickets/{ticket_id}/updates")
async def add_ticket_update(
    ticket_id: int,
    request: AddTicketCommentRequest,
    user: Dict[str, Any] = Depends(get_current_user),
) -> Any:
    try:
        ticket = await client.get_ticket(ticket_id)
    except AteraApiError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc

    ensure_ticket_owner_or_admin(user, ticket)

    payload: Dict[str, Any] = {"CommentText": request.comment_text}

    if user["role"] == "admin":
        if request.technician_id is not None:
            payload["TechnicianCommentDetails"] = {
                "TechnicianId": request.technician_id,
                "IsInternal": request.is_internal,
                "TechnicianEmail": request.technician_email,
            }
        elif request.enduser_id is not None:
            payload["EnduserCommentDetails"] = {"EnduserId": request.enduser_id}
        else:
            raise HTTPException(
                status_code=400,
                detail="Admin update requires technician_id or enduser_id",
            )
    else:
        end_user_id = ticket.get("EndUserID")
        if not end_user_id:
            raise HTTPException(
                status_code=400,
                detail="Ticket is missing EndUserID and cannot accept user comments",
            )
        payload["EnduserCommentDetails"] = {"EnduserId": end_user_id}

    requested_status = _normalize_status_input(request.ticket_status) if request.ticket_status else None
    if request.mark_resolved and requested_status and requested_status != "Resolved":
        raise HTTPException(
            status_code=400,
            detail="mark_resolved cannot be combined with a different ticket_status",
        )

    current_status = (ticket.get("TicketStatus") or "").strip().lower()
    effective_status = requested_status or ("Resolved" if request.mark_resolved else None)

    if effective_status:
        if user["role"] == "admin":
            if effective_status not in ADMIN_ALLOWED_STATUSES:
                raise HTTPException(status_code=400, detail="Unsupported admin status")
        else:
            if effective_status not in USER_ALLOWED_STATUSES:
                raise HTTPException(status_code=403, detail="Users can only set Open or Resolved")
            if current_status in USER_LOCKED_STATUSES:
                raise HTTPException(
                    status_code=403,
                    detail="Ticket status is locked for users when current status is Pending or Closed",
                )

    try:
        comment_result = await client.add_comment(ticket_id=ticket_id, payload=payload)

        if effective_status:
            await client.update_ticket(ticket_id=ticket_id, payload={"TicketStatus": effective_status})

        return comment_result
    except AteraApiError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@app.get("/api/tickets/{ticket_id}/history")
async def get_ticket_history(
    ticket_id: int,
    user: Dict[str, Any] = Depends(get_current_user),
) -> Dict[str, Any]:
    try:
        ticket = await client.get_ticket(ticket_id)
    except AteraApiError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc

    ensure_ticket_owner_or_admin(user, ticket)

    try:
        comments_result = await client.list_ticket_comments(ticket_id=ticket_id, page=1, items_in_page=50)
    except AteraApiError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc

    comments = comments_result.get("items", []) if isinstance(comments_result, dict) else []
    return {
        "ticket": ticket,
        "comments": comments,
    }
