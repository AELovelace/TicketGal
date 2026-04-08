import hashlib
import asyncio
import os
import json
import re
import secrets
import tempfile
from datetime import datetime, time, timedelta, timezone
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
    claim_due_transactions,
    enqueue_transaction,
    get_cached_ticket_by_id,
    get_ticket_cache_last_sync_at,
    get_transaction_queue_summary,
    get_signups_enabled,
    get_ticket_report_stats,
    get_user_by_email,
    get_user_by_id,
    get_user_by_microsoft_identity,
    get_user_theme_enabled,
    init_db,
    link_user_microsoft_account,
    list_cached_ticket_comments,
    list_pending_queue_creates,
    list_pending_queue_items_for_ticket,
    list_recent_transactions,
    list_cached_tickets,
    list_users,
    replace_cached_ticket_comments,
    replace_ticket_cache_snapshot,
    reset_user_password,
    seed_admin,
    set_signups_enabled,
    set_user_theme_enabled,
    mark_transaction_completed,
    mark_transaction_retry,
    upsert_cached_ticket,
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
OP_CREATE_TICKET = "create_ticket"
OP_UPDATE_TICKET_STATUS = "update_ticket_status"
OP_ADD_TICKET_COMMENT = "add_ticket_comment"
OP_DISMISS_ALERT = "dismiss_alert"

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


app = FastAPI(title="TicketGal", version="0.2.0")
client = AteraClient()

static_dir = Path(__file__).parent / "static"
app.mount("/static", StaticFiles(directory=str(static_dir)), name="static")


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


def _file_hash(path: Path) -> str:
    """Return a short content hash for cache-busting query strings."""
    try:
        h = hashlib.sha1(path.read_bytes()).hexdigest()[:12]
    except OSError:
        h = "dev"
    return h


_ASSET_HASHES: Dict[str, str] = {}
_QUEUE_WORKER_TASK: Optional[asyncio.Task[Any]] = None


@app.on_event("startup")
def startup() -> None:
    init_db()
    if settings.admin_email and settings.admin_password:
        seed_admin(settings.admin_email, hash_password(settings.admin_password))
    _ASSET_HASHES["app.js"] = _file_hash(static_dir / "app.js")
    _ASSET_HASHES["styles.css"] = _file_hash(static_dir / "styles.css")


@app.on_event("startup")
async def startup_queue_worker() -> None:
    global _QUEUE_WORKER_TASK
    if not settings.queue_auto_process_enabled:
        return
    if _QUEUE_WORKER_TASK and not _QUEUE_WORKER_TASK.done():
        return
    _QUEUE_WORKER_TASK = asyncio.create_task(_queue_worker_loop())


@app.on_event("shutdown")
async def shutdown_queue_worker() -> None:
    global _QUEUE_WORKER_TASK
    if _QUEUE_WORKER_TASK is None:
        return
    _QUEUE_WORKER_TASK.cancel()
    try:
        await _QUEUE_WORKER_TASK
    except asyncio.CancelledError:
        pass
    finally:
        _QUEUE_WORKER_TASK = None


@app.get("/")
async def index() -> Response:
    html = (static_dir / "index.html").read_text(encoding="utf-8")
    # Replace any existing ?v=... query strings with current content hashes
    import re as _re
    html = _re.sub(r'/static/styles\.css\?v=[^"]+', f'/static/styles.css?v={_ASSET_HASHES.get("styles.css", "dev")}', html)
    html = _re.sub(r'/static/app\.js\?v=[^"]+', f'/static/app.js?v={_ASSET_HASHES.get("app.js", "dev")}', html)
    return Response(
        content=html,
        media_type="text/html",
        headers={"Cache-Control": "no-store"},
    )


@app.get("/register")
async def register_page() -> FileResponse:
    return FileResponse(static_dir / "register.html")


@app.get("/health")
async def health() -> Dict[str, Any]:
    dependencies: Dict[str, Any] = {
        "atera": {
            "status": "skipped",
            "detail": "Atera dependency probe is disabled",
        }
    }
    degraded = False

    if settings.health_check_atera:
        try:
            await client.probe_dependency(timeout_seconds=settings.health_check_timeout_seconds)
            dependencies["atera"] = {"status": "up"}
        except AteraApiError as exc:
            degraded = True
            dependencies["atera"] = {
                "status": "down",
                "status_code": exc.status_code,
                "detail": exc.message,
            }

    return {
        "status": "degraded" if degraded else "ok",
        "dependencies": dependencies,
        "cache": {
            "last_seen_sync_at": get_ticket_cache_last_sync_at(),
        },
    }


def _can_use_cache_fallback(exc: AteraApiError) -> bool:
    return settings.enable_cache_read_fallback and exc.status_code >= 500


def _is_upstream_outage(exc: AteraApiError) -> bool:
    return exc.status_code >= 500


def _queue_enabled_for(operation_type: str) -> bool:
    if not settings.enable_write_queue:
        return False
    if operation_type == OP_CREATE_TICKET:
        return settings.enable_queue_for_create_ticket
    if operation_type == OP_UPDATE_TICKET_STATUS:
        return settings.enable_queue_for_status_update
    if operation_type == OP_ADD_TICKET_COMMENT:
        return settings.enable_queue_for_comment
    if operation_type == OP_DISMISS_ALERT:
        return settings.enable_write_queue
    return False


def _queue_write_or_raise(
    *,
    operation_type: str,
    payload: Dict[str, Any],
    ticket_id: Optional[int],
    requested_by_user_id: Optional[int],
    exc: AteraApiError,
    message: str,
) -> JSONResponse:
    if not (_queue_enabled_for(operation_type) and _is_upstream_outage(exc)):
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc

    queued = enqueue_transaction(
        operation_type=operation_type,
        payload=payload,
        ticket_id=ticket_id,
        requested_by_user_id=requested_by_user_id,
    )
    return JSONResponse(
        status_code=202,
        content={
            "queued": True,
            "message": message,
            "transaction": queued,
            "detail": exc.message,
        },
    )


async def _process_single_transaction(tx: Dict[str, Any]) -> Dict[str, Any]:
    op = str(tx.get("operation_type") or "").strip()
    payload_raw = tx.get("payload_json")
    payload: Dict[str, Any] = {}
    if isinstance(payload_raw, str) and payload_raw.strip():
        parsed = json.loads(payload_raw)
        if isinstance(parsed, dict):
            payload = parsed

    if op == OP_CREATE_TICKET:
        result = await client.create_ticket(payload)
        return {"ok": True, "operation_type": op, "result": result}

    if op == OP_UPDATE_TICKET_STATUS:
        ticket_id = int(payload.get("ticket_id") or tx.get("ticket_id") or 0)
        status = str(payload.get("ticket_status") or "").strip()
        if ticket_id <= 0 or not status:
            raise ValueError("Invalid queued status update payload")
        result = await client.update_ticket(ticket_id=ticket_id, payload={"TicketStatus": status})
        await _refresh_cached_ticket_from_atera(ticket_id)
        return {"ok": True, "operation_type": op, "ticket_id": ticket_id, "result": result}

    if op == OP_ADD_TICKET_COMMENT:
        ticket_id = int(payload.get("ticket_id") or tx.get("ticket_id") or 0)
        comment_payload = payload.get("comment_payload")
        if ticket_id <= 0 or not isinstance(comment_payload, dict):
            raise ValueError("Invalid queued comment payload")

        comment_result = await client.add_comment(ticket_id=ticket_id, payload=comment_payload)
        follow_up_status = str(payload.get("follow_up_status") or "").strip()
        if follow_up_status:
            await client.update_ticket(ticket_id=ticket_id, payload={"TicketStatus": follow_up_status})

        await _refresh_cached_ticket_from_atera(ticket_id)
        return {
            "ok": True,
            "operation_type": op,
            "ticket_id": ticket_id,
            "result": comment_result,
            "follow_up_status": follow_up_status or None,
        }

    if op == OP_DISMISS_ALERT:
        alert_id = str(payload.get("alert_id") or "").strip()
        if not alert_id:
            raise ValueError("Invalid queued dismiss alert payload")
        result = await client.dismiss_alert(alert_id)
        return {"ok": True, "operation_type": op, "result": result}

    raise ValueError(f"Unsupported queued operation_type: {op or 'empty'}")


async def _fetch_all_ticket_comments(ticket_id: int, page_size: int = 50, max_pages: int = 50) -> List[Dict[str, Any]]:
    comments: List[Dict[str, Any]] = []
    for page in range(1, max_pages + 1):
        result = await client.list_ticket_comments(ticket_id=ticket_id, page=page, items_in_page=page_size)
        items = result.get("items", []) if isinstance(result, dict) else []
        parsed = [item for item in items if isinstance(item, dict)]
        if not parsed:
            break
        comments.extend(parsed)

        total = int(result.get("totalItemCount", 0) or 0) if isinstance(result, dict) else 0
        if total > 0 and len(comments) >= total:
            break
        if len(parsed) < page_size:
            break
    return comments


async def _refresh_cached_ticket_from_atera(ticket_id: int, changed_by_user_id: Optional[int] = None) -> None:
    ticket = await client.get_ticket(ticket_id)
    upsert_cached_ticket(ticket, changed_by_user_id=changed_by_user_id)
    comments = await _fetch_all_ticket_comments(ticket_id)
    replace_cached_ticket_comments(ticket_id, comments)


def _resolve_ticket_for_write_from_cache_or_raise(
    ticket_id: int,
    user: Dict[str, Any],
    exc: AteraApiError,
) -> Dict[str, Any]:
    if _can_use_cache_fallback(exc):
        cached_ticket = get_cached_ticket_by_id(ticket_id)
        if cached_ticket:
            ensure_ticket_owner_or_admin(user, cached_ticket)
            return cached_ticket
    raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


def _inject_queued_creates(result: Dict[str, Any], user: Dict[str, Any]) -> None:
    """Append pending create_ticket queue items as synthetic ticket entries in-place."""
    if not isinstance(result, dict):
        return
    requested_by_user_id = None if user["role"] == "admin" else int(user["id"])
    queued = list_pending_queue_creates(requested_by_user_id=requested_by_user_id)
    if not queued:
        return
    synthetic: List[Dict[str, Any]] = []
    for tx in queued:
        payload: Dict[str, Any] = {}
        try:
            raw = tx.get("payload_json") or ""
            parsed = json.loads(raw)
            if isinstance(parsed, dict):
                payload = parsed
        except Exception:
            pass
        synthetic.append(
            {
                "TicketID": None,
                "TicketTitle": payload.get("TicketTitle") or "(no title)",
                "TicketStatus": "Queued",
                "EndUserEmail": payload.get("EndUserEmail") or "",
                "CustomerName": "",
                "TicketPriority": payload.get("TicketPriority") or "",
                "TicketType": payload.get("TicketType") or "",
                "_queued": True,
                "_queuedTransactionId": tx["id"],
                "_queuedCreatedAt": tx.get("created_at") or "",
                "_queuedAttempts": int(tx.get("attempts") or 0),
                "_queuedStatus": tx.get("status") or "pending",
            }
        )
    result["items"] = result.get("items", []) + synthetic
    result["totalItemCount"] = int(result.get("totalItemCount") or 0) + len(synthetic)


def _build_pending_ops(ticket_id: int) -> List[Dict[str, Any]]:
    """Return a list of pending queue operations for a ticket as annotated dicts."""
    raw_ops = list_pending_queue_items_for_ticket(ticket_id)
    ops: List[Dict[str, Any]] = []
    for item in raw_ops:
        op_type = str(item.get("operation_type") or "")
        payload: Dict[str, Any] = {}
        try:
            raw = item.get("payload_json") or ""
            parsed = json.loads(raw)
            if isinstance(parsed, dict):
                payload = parsed
        except Exception:
            pass
        if op_type == OP_UPDATE_TICKET_STATUS:
            ops.append(
                {
                    "_queued": True,
                    "_type": "status_change",
                    "_transactionId": item["id"],
                    "_createdAt": item.get("created_at") or "",
                    "new_status": str(payload.get("ticket_status") or ""),
                }
            )
        elif op_type == OP_ADD_TICKET_COMMENT:
            comment_payload = payload.get("comment_payload") or {}
            ops.append(
                {
                    "_queued": True,
                    "_type": "comment",
                    "_transactionId": item["id"],
                    "_createdAt": item.get("created_at") or "",
                    "Comment": str(comment_payload.get("CommentText") or ""),
                    "follow_up_status": str(payload.get("follow_up_status") or ""),
                }
            )
    return ops


async def _drain_queue(limit: int) -> Dict[str, Any]:
    batch_limit = min(limit, settings.queue_process_batch_limit)
    txs = claim_due_transactions(limit=batch_limit)
    processed: List[Dict[str, Any]] = []

    for tx in txs:
        tx_id = int(tx.get("id") or 0)
        attempts = int(tx.get("attempts") or 0)
        retry_delay = min(300, 2 ** min(attempts + 1, 8))
        try:
            result = await _process_single_transaction(tx)
            mark_transaction_completed(tx_id, result)
            processed.append({"id": tx_id, "status": "completed"})
        except AteraApiError as exc:
            retry_result = mark_transaction_retry(tx_id, exc.message, retry_delay)
            processed.append({"id": tx_id, **retry_result, "detail": exc.message})
        except Exception as exc:
            retry_result = mark_transaction_retry(tx_id, f"Queue processor error: {exc}", retry_delay)
            processed.append({"id": tx_id, **retry_result, "detail": str(exc)})

    return {
        "claimed": len(txs),
        "processed": processed,
        "summary": get_transaction_queue_summary(),
    }


async def _queue_worker_loop() -> None:
    interval = max(5, settings.queue_auto_process_interval_seconds)
    while True:
        try:
            if settings.enable_write_queue:
                await _drain_queue(settings.queue_process_batch_limit)
        except asyncio.CancelledError:
            raise
        except Exception:
            # Keep the worker alive even if one cycle fails.
            pass
        await asyncio.sleep(interval)


@app.get("/api/admin/queue/status")
def admin_queue_status(
    limit: int = Query(default=20, ge=1, le=100),
    user: Dict[str, Any] = Depends(get_current_user),
) -> Dict[str, Any]:
    require_admin(user)
    return {
        "queue_enabled": settings.enable_write_queue,
        "queue_features": {
            "create_ticket": _queue_enabled_for(OP_CREATE_TICKET),
            "update_ticket_status": _queue_enabled_for(OP_UPDATE_TICKET_STATUS),
            "add_ticket_comment": _queue_enabled_for(OP_ADD_TICKET_COMMENT),
            "dismiss_alert": _queue_enabled_for(OP_DISMISS_ALERT),
        },
        "queue_config": {
            "enable_write_queue": settings.enable_write_queue,
            "enable_queue_for_create_ticket": settings.enable_queue_for_create_ticket,
            "enable_queue_for_status_update": settings.enable_queue_for_status_update,
            "enable_queue_for_comment": settings.enable_queue_for_comment,
            "queue_process_batch_limit": settings.queue_process_batch_limit,
            "queue_auto_process_enabled": settings.queue_auto_process_enabled,
            "queue_auto_process_interval_seconds": settings.queue_auto_process_interval_seconds,
        },
        "summary": get_transaction_queue_summary(),
        "recent": list_recent_transactions(limit=limit),
    }


@app.post("/api/admin/queue/process")
async def admin_process_queue(
    limit: int = Query(default=25, ge=1, le=100),
    user: Dict[str, Any] = Depends(get_current_user),
) -> Dict[str, Any]:
    require_admin(user)
    return await _drain_queue(limit)


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
        raise HTTPException(status_code=401, detail="Invalid credentials")

    _set_user_session(response, request, user)

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
    return response


@app.post("/auth/logout")
def logout(request: Request, response: Response) -> Dict[str, str]:
    token = request.cookies.get(settings.session_cookie_name)
    if token:
        delete_session(token)

    response.delete_cookie(settings.session_cookie_name)
    response.delete_cookie(CSRF_COOKIE_NAME)
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
    return {"message": "User role updated"}


@app.delete("/api/admin/users/{user_id}")
def admin_delete_user(user_id: int, user: Dict[str, Any] = Depends(get_current_user)) -> Dict[str, str]:
    require_admin(user)
    if int(user["id"]) == user_id:
        raise HTTPException(status_code=400, detail="Cannot delete your own account")
    if not delete_user(user_id):
        raise HTTPException(status_code=404, detail="User not found")
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
    return {"signups_enabled": new_state, "message": "Signups " + ("enabled" if new_state else "disabled")}


@app.post("/api/admin/sync-tickets-from-atera")
async def admin_sync_tickets(user: Dict[str, Any] = Depends(get_current_user)) -> Dict[str, Any]:
    """Sync all tickets from Atera into the local ticket cache.
    
    This endpoint fetches all tickets from Atera with pagination and populates
    the ticket_cache database, then backfills missing dates and status history.
    Admin-only operation.
    """
    require_admin(user)
    page_size = 50

    try:
        all_tickets: List[Dict[str, Any]] = []
        page = 1
        while True:
            result = await client.list_tickets(
                page=page,
                items_in_page=page_size,
                customer_id=None,
                ticket_status=None,
                include_relations=True,
            )
            items = result.get("items", []) if isinstance(result, dict) else []
            if not items:
                break
            all_tickets.extend(items)

            total = int(result.get("totalItemCount", 0) or 0) if isinstance(result, dict) else 0
            if total > 0 and len(all_tickets) >= total:
                break
            if len(items) < page_size:
                break
            page += 1
    except AteraApiError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Ticket sync failed: {exc}") from exc
    
    # Populate cache with all tickets
    count = replace_ticket_cache_snapshot(all_tickets)

    comments_cached_tickets = 0
    comments_cached_total = 0
    for ticket in all_tickets:
        try:
            tid = int(ticket.get("TicketID") or 0)
        except (TypeError, ValueError):
            continue
        if tid <= 0:
            continue
        try:
            comments = await _fetch_all_ticket_comments(tid)
        except AteraApiError:
            continue
        replace_cached_ticket_comments(tid, comments)
        comments_cached_tickets += 1
        comments_cached_total += len(comments)

    # Trigger backfill of dates and status history for newly synced tickets
    # This re-runs the same logic from startup but is safe due to NOT EXISTS guards
    init_db()

    return {
        "status": "success",
        "message": (
            f"Synced {count} tickets from Atera and backfilled dates/history. "
            f"Cached comments for {comments_cached_tickets} tickets ({comments_cached_total} comments)."
        ),
        "ticket_count": count,
        "comments_cached_tickets": comments_cached_tickets,
        "comments_cached_total": comments_cached_total,
    }


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
        raise HTTPException(status_code=502, detail=f"AI provider request failed: {str(exc)}") from exc

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
    try:
        result = await client.list_tickets(
            page=page,
            items_in_page=items_in_page,
            customer_id=customer_id,
            ticket_status=ticket_status,
            include_relations=include_relations,
        )
    except AteraApiError as exc:
        if _can_use_cache_fallback(exc):
            fallback = list_cached_tickets(
                page=page,
                items_in_page=items_in_page,
                customer_id=customer_id,
                ticket_status=ticket_status,
                end_user_email=None if user["role"] == "admin" else user["email"],
            )
            fallback["degraded"] = True
            fallback["source"] = "cache"
            fallback["detail"] = exc.message
            _inject_queued_creates(fallback, user)
            return fallback
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc

    if user["role"] == "admin":
        _inject_queued_creates(result, user)
        return result

    items = result.get("items", []) if isinstance(result, dict) else []
    filtered_items = [
        item
        for item in items
        if (item.get("EndUserEmail") or "").strip().lower() == user["email"]
    ]

    if isinstance(result, dict):
        result["items"] = filtered_items
        result["totalItemCount"] = len(filtered_items)
    _inject_queued_creates(result, user)
    return result


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


@app.post("/api/alerts/{alert_id}/dismiss")
async def dismiss_alert(alert_id: str, user: Dict[str, Any] = Depends(get_current_user)) -> Dict[str, Any]:
    require_admin(user)

    cleaned_alert_id = str(alert_id or "").strip()
    if not cleaned_alert_id:
        raise HTTPException(status_code=400, detail="Alert ID is required")

    try:
        result = await client.dismiss_alert(cleaned_alert_id)
    except AteraApiError as exc:
        return _queue_write_or_raise(
            operation_type=OP_DISMISS_ALERT,
            payload={"alert_id": cleaned_alert_id},
            ticket_id=None,
            requested_by_user_id=int(user["id"]),
            exc=exc,
            message=f"Atera is unavailable. Alert {cleaned_alert_id} dismissal was queued.",
        )

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
        return _queue_write_or_raise(
            operation_type=OP_CREATE_TICKET,
            payload=payload,
            ticket_id=None,
            requested_by_user_id=int(user["id"]),
            exc=exc,
            message="Atera is unavailable. Ticket create request was queued.",
        )


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
        ticket = _resolve_ticket_for_write_from_cache_or_raise(ticket_id, user, exc)

    ensure_ticket_owner_or_admin(user, ticket)

    current_status = (ticket.get("TicketStatus") or "").strip().lower()

    if normalized_status not in ADMIN_ALLOWED_STATUSES:
        raise HTTPException(status_code=400, detail="Unsupported admin status")

    payload = {"TicketStatus": normalized_status}
    try:
        result = await client.update_ticket(ticket_id=ticket_id, payload=payload)
    except AteraApiError as exc:
        return _queue_write_or_raise(
            operation_type=OP_UPDATE_TICKET_STATUS,
            payload={
                "ticket_id": ticket_id,
                "ticket_status": normalized_status,
            },
            ticket_id=ticket_id,
            requested_by_user_id=int(user["id"]),
            exc=exc,
            message=f"Atera is unavailable. Status change for ticket {ticket_id} was queued.",
        )

    try:
        await _refresh_cached_ticket_from_atera(ticket_id, changed_by_user_id=int(user["id"]))
    except AteraApiError:
        pass

    return result


@app.post("/api/tickets/{ticket_id}/updates")
async def add_ticket_update(
    ticket_id: int,
    request: AddTicketCommentRequest,
    user: Dict[str, Any] = Depends(get_current_user),
) -> Any:
    try:
        ticket = await client.get_ticket(ticket_id)
    except AteraApiError as exc:
        ticket = _resolve_ticket_for_write_from_cache_or_raise(ticket_id, user, exc)

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

    follow_up_status: Optional[str] = None
    if user["role"] == "admin" and request.ticket_status:
        if request.ticket_status not in ADMIN_ALLOWED_STATUSES:
            raise HTTPException(status_code=400, detail="Unsupported admin status")
        follow_up_status = request.ticket_status
    elif user["role"] != "admin" and request.mark_resolved:
        current_status = (ticket.get("TicketStatus") or "").strip().lower()
        if current_status in USER_LOCKED_STATUSES:
            raise HTTPException(
                status_code=403,
                detail="Ticket status is locked for users when current status is Pending or Closed",
            )
        follow_up_status = "Resolved"

    try:
        comment_result = await client.add_comment(ticket_id=ticket_id, payload=payload)
    except AteraApiError as exc:
        return _queue_write_or_raise(
            operation_type=OP_ADD_TICKET_COMMENT,
            payload={
                "ticket_id": ticket_id,
                "comment_payload": payload,
                "follow_up_status": follow_up_status,
            },
            ticket_id=ticket_id,
            requested_by_user_id=int(user["id"]),
            exc=exc,
            message=f"Atera is unavailable. Comment update for ticket {ticket_id} was queued.",
        )

    try:
        comments = await _fetch_all_ticket_comments(ticket_id)
        replace_cached_ticket_comments(ticket_id, comments)
    except AteraApiError:
        pass

    if follow_up_status:
        try:
            await client.update_ticket(ticket_id=ticket_id, payload={"TicketStatus": follow_up_status})
        except AteraApiError as exc:
            return _queue_write_or_raise(
                operation_type=OP_UPDATE_TICKET_STATUS,
                payload={
                    "ticket_id": ticket_id,
                    "ticket_status": follow_up_status,
                },
                ticket_id=ticket_id,
                requested_by_user_id=int(user["id"]),
                exc=exc,
                message=f"Atera is unavailable. Follow-up status change for ticket {ticket_id} was queued.",
            )

    try:
        await _refresh_cached_ticket_from_atera(ticket_id, changed_by_user_id=int(user["id"]))
    except AteraApiError:
        pass

    return comment_result


@app.get("/api/tickets/{ticket_id}/history")
async def get_ticket_history(
    ticket_id: int,
    user: Dict[str, Any] = Depends(get_current_user),
) -> Dict[str, Any]:
    ticket: Dict[str, Any]
    try:
        ticket = await client.get_ticket(ticket_id)
    except AteraApiError as exc:
        if _can_use_cache_fallback(exc):
            cached_ticket = get_cached_ticket_by_id(ticket_id)
            if not cached_ticket:
                raise HTTPException(
                    status_code=503,
                    detail="Atera is unavailable and this ticket is not present in local cache",
                ) from exc
            ensure_ticket_owner_or_admin(user, cached_ticket)
            return {
                "ticket": cached_ticket,
                "comments": list_cached_ticket_comments(ticket_id),
                "pending_ops": _build_pending_ops(ticket_id),
                "degraded": True,
                "source": "cache",
                "history_source": "cache",
                "detail": exc.message,
            }
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc

    ensure_ticket_owner_or_admin(user, ticket)

    try:
        comments_result = await client.list_ticket_comments(ticket_id=ticket_id, page=1, items_in_page=50)
    except AteraApiError as exc:
        if _can_use_cache_fallback(exc):
            return {
                "ticket": ticket,
                "comments": list_cached_ticket_comments(ticket_id),
                "pending_ops": _build_pending_ops(ticket_id),
                "degraded": True,
                "source": "atera",
                "history_source": "cache",
                "detail": exc.message,
            }
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc

    comments = comments_result.get("items", []) if isinstance(comments_result, dict) else []
    parsed_comments = [entry for entry in comments if isinstance(entry, dict)]
    replace_cached_ticket_comments(ticket_id, parsed_comments)
    upsert_cached_ticket(ticket)
    return {
        "ticket": ticket,
        "comments": parsed_comments,
        "pending_ops": _build_pending_ops(ticket_id),
    }


@app.get("/api/reports/summary")
async def get_reports_summary(
    period: str = Query(default="week", pattern="^(week|month|year|custom)$"),
    custom_start: Optional[str] = Query(default=None),
    custom_end: Optional[str] = Query(default=None),
    include_ai: bool = Query(default=False),
    user: Dict[str, Any] = Depends(get_current_user),
) -> Dict[str, Any]:
    require_admin(user)

    now = datetime.now(tz=timezone.utc)
    period_end: Optional[str] = None
    if period == "week":
        period_start = (now - timedelta(weeks=1)).isoformat()
    elif period == "month":
        period_start = (now - timedelta(days=30)).isoformat()
    elif period == "year":
        period_start = (now - timedelta(days=365)).isoformat()
    else:
        if not custom_start or not custom_end:
            raise HTTPException(status_code=400, detail="custom_start and custom_end are required for custom period")
        try:
            start_date = datetime.fromisoformat(custom_start).date()
            end_date = datetime.fromisoformat(custom_end).date()
        except ValueError as exc:
            raise HTTPException(status_code=400, detail="Invalid custom date format; use YYYY-MM-DD") from exc
        if end_date < start_date:
            raise HTTPException(status_code=400, detail="custom_end must be on or after custom_start")

        start_dt = datetime.combine(start_date, time.min, tzinfo=timezone.utc)
        end_exclusive_dt = datetime.combine(end_date + timedelta(days=1), time.min, tzinfo=timezone.utc)
        period_start = start_dt.isoformat()
        period_end = end_exclusive_dt.isoformat()

    stats = get_ticket_report_stats(period_start, period_end)

    period_label_map = {"week": "past 7 days", "month": "past 30 days", "year": "past 365 days"}
    if period == "custom":
        period_label = f"{custom_start} to {custom_end}"
    else:
        period_label = period_label_map.get(period, period)

    top_customers = [
        f"{row['customer_name']} (opened {row['opened']}, resolved {row['resolved']})"
        for row in (stats.get("by_customer") or [])[:5]
    ]
    pending_by_customer = [
        f"{row['customer_name']} ({row['pending']})"
        for row in (stats.get("pending_by_customer") or [])[:5]
    ]
    pending_request_tickets = stats.get("pending_request_tickets") or []
    open_request_tickets = stats.get("open_request_tickets") or []
    resolved_request_tickets = stats.get("resolved_request_tickets") or []
    sample_titles = stats.get("sample_titles") or []
    pending_sample_titles = stats.get("pending_sample_titles") or []

    prompt_lines = [
        f"Ticket activity summary for the {period_label}:",
        f"- Tickets opened: {stats['opened_count']}",
        f"- Tickets resolved or closed: {stats['resolved_count']}",
        f"- Currently open: {stats['currently_open_count']}",
        f"- Currently pending: {stats['currently_pending_count']}",
    ]
    if top_customers:
        prompt_lines.append("Top customers: " + "; ".join(top_customers))
    if sample_titles:
        prompt_lines.append("Recent resolved ticket titles: " + "; ".join(sample_titles[:5]))
    if pending_by_customer:
        prompt_lines.append("Pending by customer (watchlist): " + "; ".join(pending_by_customer))
    if pending_sample_titles:
        prompt_lines.append("Recent pending ticket titles: " + "; ".join(pending_sample_titles[:5]))
    prompt_lines.append(
        "Write a concise 2-3 sentence plain-text summary suitable for an IT manager. "
        "Use a gracious, constructive tone. Treat pending tickets as net-neutral operational waiting items "
        "(parts, vendor, customer scheduling) unless data explicitly indicates risk. "
        "Do not frame pending count as negative throughput by default. "
        "Do not use markdown, bullet points, or headers."
    )

    messages = [
        {
            "role": "system",
            "content": (
                "You are an IT service desk analyst producing brief executive summaries. "
                "Be gracious and balanced. Pending tickets are neutral waiting-state workload unless "
                "there is explicit evidence of escalation risk."
            ),
        },
        {"role": "user", "content": "\n".join(prompt_lines)},
    ]

    headers = {"Content-Type": "application/json"}
    if settings.openai_api_key:
        headers["Authorization"] = f"Bearer {settings.openai_api_key}"

    ai_summary: Optional[str] = None
    pending_request_context: Optional[str] = None
    open_request_context: Optional[str] = None
    resolved_request_context: Optional[str] = None
    ai_error: Optional[str] = None

    if not include_ai:
        result: Dict[str, Any] = {
            "period": period,
            "period_start": period_start,
            **stats,
        }
        if period_end:
            result["period_end"] = period_end
        if pending_by_customer or pending_sample_titles:
            pending_parts: List[str] = []
            if pending_by_customer:
                pending_parts.append("By property: " + "; ".join(pending_by_customer))
            if pending_sample_titles:
                pending_parts.append("Recent pending examples: " + "; ".join(pending_sample_titles[:5]))
            result["pending_appendix"] = "Pending watchlist (net-neutral): " + " | ".join(pending_parts)
        return result

    try:
        def _strip_css_noise(text: str) -> str:
            value = str(text or "")
            value = re.sub(
                r"^((?:p|strong|em|ul|ol|li|img|h[1-6]|span|div|hr|b|i|u|a)\s*,\s*)+(?:p|strong|em|ul|ol|li|img|h[1-6]|span|div|hr|b|i|u|a)\s*\{[^{}]{0,5000}\}\s*",
                "",
                value,
                flags=re.IGNORECASE,
            )
            value = re.sub(r"^(?:[a-z-]+\s*:\s*[^;\n]+;\s*){2,}", "", value, flags=re.IGNORECASE)
            return value.strip()

        def _comment_excerpt(text: str, max_len: int = 260) -> str:
            cleaned = unescape(re.sub(r"<[^>]+>", " ", str(text or "")))
            cleaned = _strip_css_noise(cleaned)
            cleaned = re.sub(r"\s+", " ", cleaned).strip()
            if len(cleaned) > max_len:
                return cleaned[: max_len - 1] + "…"
            return cleaned

        async def _build_ticket_lines(tickets: List[Dict[str, Any]], label: str) -> List[str]:
            lines: List[str] = []
            for t in tickets:
                tid = int(t.get("ticket_id") or 0)
                if tid <= 0:
                    continue

                try:
                    comments_result = await client.list_ticket_comments(ticket_id=tid, page=1, items_in_page=50)
                    comments = comments_result.get("items", []) if isinstance(comments_result, dict) else []
                except AteraApiError:
                    comments = []

                comments = sorted(
                    [c for c in comments if isinstance(c, dict)],
                    key=lambda c: str(c.get("Date") or ""),
                )

                message_parts: List[str] = []
                history_count = 0
                first_comment_at = ""
                last_comment_at = ""
                for entry in comments:
                    history_count += 1
                    c_text = _comment_excerpt(str(entry.get("Comment") or ""))
                    if not c_text:
                        continue
                    c_date = str(entry.get("Date") or "").strip()
                    author = str(entry.get("FirstName") or entry.get("Email") or "Unknown").strip()
                    if c_date and not first_comment_at:
                        first_comment_at = c_date
                    if c_date:
                        last_comment_at = c_date
                    if c_date:
                        message_parts.append(f"[{c_date}] {author}: {c_text}")
                    else:
                        message_parts.append(f"{author}: {c_text}")

                if len(message_parts) > 8:
                    tail = message_parts[-8:]
                    messages_blob = (
                        f"{history_count} total comments. Showing latest 8 entries: " + " || ".join(tail)
                    )
                elif message_parts:
                    messages_blob = f"{history_count} total comments: " + " || ".join(message_parts)
                else:
                    messages_blob = "No comment history available"

                activity_meta = []
                if first_comment_at:
                    activity_meta.append(f"First comment: {first_comment_at}")
                if last_comment_at:
                    activity_meta.append(f"Last comment: {last_comment_at}")
                if history_count:
                    activity_meta.append(f"Comment count: {history_count}")

                lines.append(
                    f"Ticket #{tid}\n"
                    f"Status bucket: {label}\n"
                    f"Property: {t.get('customer_name') or 'Unknown'}\n"
                    f"Title: {t.get('title') or '(untitled)'}\n"
                    f"Opened: {t.get('created_at') or 'unknown'}\n"
                    f"Last activity: {t.get('last_activity_at') or 'unknown'}\n"
                    f"Resolved at: {t.get('resolved_at') or 'n/a'}\n"
                    f"{'; '.join(activity_meta) if activity_meta else 'Comment count: 0'}\n"
                    f"Messages: {messages_blob}"
                )
            return lines

        pending_lines: List[str] = []
        for t in pending_request_tickets:
            tid = int(t.get("ticket_id") or 0)
            if tid <= 0:
                continue

            # Re-validate against live ticket status so AI analysis does not
            # include stale cache entries that have already been closed/resolved.
            try:
                live_ticket = await client.get_ticket(tid)
            except AteraApiError:
                live_ticket = None

            live_status = str((live_ticket or {}).get("TicketStatus") or "").strip().lower()
            if live_status and live_status != "pending":
                continue

            try:
                comments_result = await client.list_ticket_comments(ticket_id=tid, page=1, items_in_page=50)
                comments = comments_result.get("items", []) if isinstance(comments_result, dict) else []
            except AteraApiError:
                comments = []

            comments = sorted(
                [c for c in comments if isinstance(c, dict)],
                key=lambda c: str(c.get("Date") or ""),
            )

            message_parts: List[str] = []
            history_count = 0
            first_comment_at = ""
            last_comment_at = ""
            for entry in comments:
                history_count += 1
                c_text = _comment_excerpt(str(entry.get("Comment") or ""))
                if not c_text:
                    continue
                c_date = str(entry.get("Date") or "").strip()
                author = str(entry.get("FirstName") or entry.get("Email") or "Unknown").strip()
                if c_date and not first_comment_at:
                    first_comment_at = c_date
                if c_date:
                    last_comment_at = c_date
                if c_date:
                    message_parts.append(f"[{c_date}] {author}: {c_text}")
                else:
                    message_parts.append(f"{author}: {c_text}")

            # Keep broad context but avoid overwhelming/echo-prone prompts.
            if len(message_parts) > 8:
                tail = message_parts[-8:]
                messages_blob = (
                    f"{history_count} total comments. Showing latest 8 entries: " + " || ".join(tail)
                )
            elif message_parts:
                messages_blob = f"{history_count} total comments: " + " || ".join(message_parts)
            else:
                messages_blob = "No comment history available"

            activity_meta = []
            if first_comment_at:
                activity_meta.append(f"First comment: {first_comment_at}")
            if last_comment_at:
                activity_meta.append(f"Last comment: {last_comment_at}")
            if history_count:
                activity_meta.append(f"Comment count: {history_count}")

            pending_lines.append(
                f"Ticket #{tid}\n"
                f"Property: {t.get('customer_name') or 'Unknown'}\n"
                f"Title: {t.get('title') or '(untitled)'}\n"
                f"Status: Pending\n"
                f"Opened: {t.get('created_at') or 'unknown'}\n"
                f"Last activity: {t.get('last_activity_at') or 'unknown'}\n"
                f"{'; '.join(activity_meta) if activity_meta else 'Comment count: 0'}\n"
                f"Messages: {messages_blob}"
            )

        async with httpx.AsyncClient(timeout=settings.openai_timeout_seconds) as http_client:
            if _looks_like_ollama_base_url(settings.openai_base_url):
                native_payload: Dict[str, Any] = {
                    "model": settings.openai_model,
                    "messages": messages,
                    "stream": False,
                    "think": False,
                    "options": {
                        "temperature": 0.4,
                        "num_ctx": 8192,
                    },
                }
                response = await http_client.post(
                    _get_ollama_native_endpoint(settings.openai_base_url),
                    headers=headers,
                    json=native_payload,
                )
            else:
                payload: Dict[str, Any] = {
                    "model": settings.openai_model,
                    "messages": messages,
                    "temperature": 0.4,
                    "stream": False,
                }
                response = await http_client.post(
                    f"{settings.openai_base_url}/chat/completions",
                    headers=headers,
                    json=payload,
                )

            if response.status_code >= 400:
                ai_error = f"AI service returned HTTP {response.status_code}."
            else:
                body = response.json() if response.content else {}
                if _looks_like_ollama_base_url(settings.openai_base_url):
                    ai_summary = ((body.get("message") or {}).get("content") or "").strip() or None
                else:
                    choices = body.get("choices") or []
                    ai_summary = (
                        ((choices[0].get("message") or {}).get("content") or "").strip()
                        if choices else None
                    )

            if pending_lines:
                pending_messages = [
                    {
                        "role": "system",
                        "content": (
                            "You are an IT operations analyst. Provide a business-style breakdown for each pending ticket. "
                            "For each ticket, summarize current blocker context from its message history and give a concrete next action. "
                            "Pending is net-neutral waiting work unless clear risk is present. "
                            "If Comment count is greater than 1, never say 'No activity since opening'. "
                            "Never echo raw metadata fields, CSS text, timestamps list, or full message dumps."
                        ),
                    },
                    {
                        "role": "user",
                        "content": (
                            f"Create a per-ticket pending breakdown for the {period_label}.\n"
                            "Output one line per ticket in this format exactly: "
                            "#<id> - <context from messages>. Next action: <action>.\n"
                            "Use Comment count, First comment, Last comment, and Messages fields to infer communication history.\n"
                            "If Comment count > 1, describe ongoing communication rather than no-activity wording.\n"
                            "Do not include property/title/opened/last-activity metadata in output lines.\n"
                            "Do not include the words 'Messages:' or 'Comment count:' in output lines.\n"
                            "Use plain text only, no markdown bullets or headings.\n\n"
                            + "\n".join(pending_lines)
                        ),
                    },
                ]

                if _looks_like_ollama_base_url(settings.openai_base_url):
                    pending_payload: Dict[str, Any] = {
                        "model": settings.openai_model,
                        "messages": pending_messages,
                        "stream": False,
                        "think": False,
                        "options": {
                            "temperature": 0.25,
                            "num_ctx": 32768,
                        },
                    }
                    pending_response = await http_client.post(
                        _get_ollama_native_endpoint(settings.openai_base_url),
                        headers=headers,
                        json=pending_payload,
                    )
                else:
                    pending_payload = {
                        "model": settings.openai_model,
                        "messages": pending_messages,
                        "temperature": 0.25,
                        "stream": False,
                    }
                    pending_response = await http_client.post(
                        f"{settings.openai_base_url}/chat/completions",
                        headers=headers,
                        json=pending_payload,
                    )

                if pending_response.status_code < 400:
                    pending_body = pending_response.json() if pending_response.content else {}
                    if _looks_like_ollama_base_url(settings.openai_base_url):
                        pending_request_context = (
                            ((pending_body.get("message") or {}).get("content") or "").strip() or None
                        )
                    else:
                        pending_choices = pending_body.get("choices") or []
                        pending_request_context = (
                            ((pending_choices[0].get("message") or {}).get("content") or "").strip()
                            if pending_choices else None
                        ) or None

                    if pending_request_context and pending_request_context.count(" | ") >= 3:
                        rewrite_messages = [
                            {
                                "role": "system",
                                "content": (
                                    "Rewrite pending ticket analysis into concise business lines only. "
                                    "Keep one line per ticket using: '#<id> - <context>. Next action: <action>." 
                                    "Do not include metadata fields, delimiters, timestamps, or raw message dumps."
                                ),
                            },
                            {"role": "user", "content": pending_request_context},
                        ]

                        if _looks_like_ollama_base_url(settings.openai_base_url):
                            rewrite_payload: Dict[str, Any] = {
                                "model": settings.openai_model,
                                "messages": rewrite_messages,
                                "stream": False,
                                "think": False,
                                "options": {"temperature": 0.2, "num_ctx": 8192},
                            }
                            rewrite_response = await http_client.post(
                                _get_ollama_native_endpoint(settings.openai_base_url),
                                headers=headers,
                                json=rewrite_payload,
                            )
                        else:
                            rewrite_payload = {
                                "model": settings.openai_model,
                                "messages": rewrite_messages,
                                "temperature": 0.2,
                                "stream": False,
                            }
                            rewrite_response = await http_client.post(
                                f"{settings.openai_base_url}/chat/completions",
                                headers=headers,
                                json=rewrite_payload,
                            )

                        if rewrite_response.status_code < 400:
                            rewrite_body = rewrite_response.json() if rewrite_response.content else {}
                            if _looks_like_ollama_base_url(settings.openai_base_url):
                                rewritten = ((rewrite_body.get("message") or {}).get("content") or "").strip()
                            else:
                                rewrite_choices = rewrite_body.get("choices") or []
                                rewritten = (
                                    ((rewrite_choices[0].get("message") or {}).get("content") or "").strip()
                                    if rewrite_choices else ""
                                )
                            if rewritten:
                                pending_request_context = rewritten

            open_lines = await _build_ticket_lines(open_request_tickets, "Open")
            if open_lines:
                open_messages = [
                    {
                        "role": "system",
                        "content": (
                            "You are an IT operations analyst. Provide a pro-technician, forgiving summary for open tickets. "
                            "Assume work is in progress and avoid blame language. "
                            "Highlight active troubleshooting, communication, and practical next steps. "
                            "Never frame open tickets as failure; frame them as active service pipeline work."
                        ),
                    },
                    {
                        "role": "user",
                        "content": (
                            f"Create a per-ticket open-ticket summary for the {period_label}.\n"
                            "Output one line per ticket in this format exactly: "
                            "#<id> - <progress context from messages>. Next action: <supportive action>.\n"
                            "Use Comment count, First comment, Last comment, and Messages fields to infer communication history.\n"
                            "If Comment count > 1, emphasize ongoing progress and collaboration.\n"
                            "Use plain text only, no markdown bullets or headings.\n\n"
                            + "\n".join(open_lines)
                        ),
                    },
                ]

                if _looks_like_ollama_base_url(settings.openai_base_url):
                    open_payload: Dict[str, Any] = {
                        "model": settings.openai_model,
                        "messages": open_messages,
                        "stream": False,
                        "think": False,
                        "options": {
                            "temperature": 0.25,
                            "num_ctx": 32768,
                        },
                    }
                    open_response = await http_client.post(
                        _get_ollama_native_endpoint(settings.openai_base_url),
                        headers=headers,
                        json=open_payload,
                    )
                else:
                    open_payload = {
                        "model": settings.openai_model,
                        "messages": open_messages,
                        "temperature": 0.25,
                        "stream": False,
                    }
                    open_response = await http_client.post(
                        f"{settings.openai_base_url}/chat/completions",
                        headers=headers,
                        json=open_payload,
                    )

                if open_response.status_code < 400:
                    open_body = open_response.json() if open_response.content else {}
                    if _looks_like_ollama_base_url(settings.openai_base_url):
                        open_request_context = (
                            ((open_body.get("message") or {}).get("content") or "").strip() or None
                        )
                    else:
                        open_choices = open_body.get("choices") or []
                        open_request_context = (
                            ((open_choices[0].get("message") or {}).get("content") or "").strip()
                            if open_choices else None
                        ) or None

            resolved_lines = await _build_ticket_lines(resolved_request_tickets, "Resolved/Closed")
            if resolved_lines:
                resolved_messages = [
                    {
                        "role": "system",
                        "content": (
                            "You are an IT operations analyst. Provide a strongly positive summary for resolved and closed tickets. "
                            "Celebrate outcomes, technician follow-through, and service completion. "
                            "Use confident, appreciative language while remaining factual and concise."
                        ),
                    },
                    {
                        "role": "user",
                        "content": (
                            f"Create a per-ticket resolved/closed highlight summary for the {period_label}.\n"
                            "Output one line per ticket in this format exactly: "
                            "#<id> - <positive completion summary>. Impact: <business-friendly impact>.\n"
                            "Use plain text only, no markdown bullets or headings.\n\n"
                            + "\n".join(resolved_lines)
                        ),
                    },
                ]

                if _looks_like_ollama_base_url(settings.openai_base_url):
                    resolved_payload: Dict[str, Any] = {
                        "model": settings.openai_model,
                        "messages": resolved_messages,
                        "stream": False,
                        "think": False,
                        "options": {
                            "temperature": 0.2,
                            "num_ctx": 32768,
                        },
                    }
                    resolved_response = await http_client.post(
                        _get_ollama_native_endpoint(settings.openai_base_url),
                        headers=headers,
                        json=resolved_payload,
                    )
                else:
                    resolved_payload = {
                        "model": settings.openai_model,
                        "messages": resolved_messages,
                        "temperature": 0.2,
                        "stream": False,
                    }
                    resolved_response = await http_client.post(
                        f"{settings.openai_base_url}/chat/completions",
                        headers=headers,
                        json=resolved_payload,
                    )

                if resolved_response.status_code < 400:
                    resolved_body = resolved_response.json() if resolved_response.content else {}
                    if _looks_like_ollama_base_url(settings.openai_base_url):
                        resolved_request_context = (
                            ((resolved_body.get("message") or {}).get("content") or "").strip() or None
                        )
                    else:
                        resolved_choices = resolved_body.get("choices") or []
                        resolved_request_context = (
                            ((resolved_choices[0].get("message") or {}).get("content") or "").strip()
                            if resolved_choices else None
                        ) or None
    except Exception as exc:  # noqa: BLE001
        ai_error = f"AI summary unavailable: {exc}"

    result: Dict[str, Any] = {
        "period": period,
        "period_start": period_start,
        **stats,
    }
    if period_end:
        result["period_end"] = period_end
    if pending_by_customer or pending_sample_titles:
        pending_parts: List[str] = []
        if pending_by_customer:
            pending_parts.append("By property: " + "; ".join(pending_by_customer))
        if pending_sample_titles:
            pending_parts.append("Recent pending examples: " + "; ".join(pending_sample_titles[:5]))
        result["pending_appendix"] = "Pending watchlist (net-neutral): " + " | ".join(pending_parts)
    if pending_request_context:
        result["pending_request_context"] = pending_request_context
    if open_request_context:
        result["open_request_context"] = open_request_context
    if resolved_request_context:
        result["resolved_request_context"] = resolved_request_context
    if ai_summary:
        result["ai_summary"] = ai_summary
    if ai_error:
        result["ai_error"] = ai_error
    return result
