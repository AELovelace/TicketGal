import os
import re
import secrets
import tempfile
from email import policy
from email.parser import BytesParser
from email.utils import parseaddr
from html import unescape
from pathlib import Path
from typing import Any, Dict, List, Optional

from fastapi import Depends, FastAPI, File, HTTPException, Query, Request, Response, UploadFile
from fastapi.responses import FileResponse
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
    get_user_by_email,
    init_db,
    list_users,
    reset_user_password,
    seed_admin,
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
    TicketStatusUpdateRequest,
)


ADMIN_ALLOWED_STATUSES = {"Open", "Pending", "Closed", "Resolved"}
USER_ALLOWED_STATUSES = {"Open", "Resolved"}
USER_LOCKED_STATUSES = {"pending", "closed", "pending closed"}


app = FastAPI(title="TicketGal", version="0.2.0")
client = AteraClient()

static_dir = Path(__file__).parent / "static"
app.mount("/static", StaticFiles(directory=str(static_dir)), name="static")


@app.on_event("startup")
def startup() -> None:
    init_db()
    if settings.admin_email and settings.admin_password:
        seed_admin(settings.admin_email, hash_password(settings.admin_password))


@app.get("/")
async def index() -> FileResponse:
    return FileResponse(static_dir / "index.html")


@app.get("/health")
async def health() -> Dict[str, str]:
    return {"status": "ok"}


@app.post("/auth/register")
def register(request: RegisterRequest) -> Dict[str, Any]:
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
def login(request: LoginRequest, response: Response) -> Dict[str, Any]:
    email = normalize_email(request.email)
    user = get_user_by_email(email)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid credentials")

    if not bool(user["is_active"]):
        raise HTTPException(status_code=403, detail="Account is inactive")

    if not bool(user["approved"]):
        raise HTTPException(status_code=403, detail="Account pending admin approval")

    if not user["password_hash"]:
        raise HTTPException(status_code=401, detail="Account password is not configured")

    if not verify_password(request.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    token = create_session_token()
    session = create_session(int(user["id"]), token)

    response.set_cookie(
        key=settings.session_cookie_name,
        value=session["token"],
        httponly=True,
        secure=False,
        samesite="lax",
        max_age=settings.session_hours * 3600,
    )

    return {"message": "Logged in", "user": sanitize_user(user)}


@app.post("/auth/logout")
def logout(request: Request, response: Response) -> Dict[str, str]:
    token = request.cookies.get(settings.session_cookie_name)
    if token:
        delete_session(token)

    response.delete_cookie(settings.session_cookie_name)
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


@app.post("/api/admin/users/{user_id}/reset-password")
def admin_reset_user_password(
    user_id: int,
    request: AdminResetPasswordRequest,
    user: Dict[str, Any] = Depends(get_current_user),
) -> Dict[str, str]:
    require_admin(user)

    plain_password = request.new_password or secrets.token_urlsafe(12)
    if len(plain_password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters")

    if not reset_user_password(user_id, hash_password(plain_password)):
        raise HTTPException(status_code=404, detail="User not found")

    return {
        "message": "User password reset",
        "temporary_password": plain_password,
    }


@app.delete("/api/admin/users/{user_id}")
def admin_delete_user(user_id: int, user: Dict[str, Any] = Depends(get_current_user)) -> Dict[str, str]:
    require_admin(user)
    if int(user["id"]) == user_id:
        raise HTTPException(status_code=400, detail="You cannot delete your own account")

    if not delete_user(user_id):
        raise HTTPException(status_code=404, detail="User not found")

    return {"message": "User deleted"}


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
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc

    if user["role"] == "admin":
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
    return result


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

    try:
        comment_result = await client.add_comment(ticket_id=ticket_id, payload=payload)

        if user["role"] != "admin" and request.mark_resolved:
            current_status = (ticket.get("TicketStatus") or "").strip().lower()
            if current_status in USER_LOCKED_STATUSES:
                raise HTTPException(
                    status_code=403,
                    detail="Ticket status is locked for users when current status is Pending or Closed",
                )

            await client.update_ticket(ticket_id=ticket_id, payload={"TicketStatus": "Resolved"})

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
