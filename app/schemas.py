import re
from typing import Optional

from pydantic import BaseModel, Field, field_validator


EMAIL_RE = re.compile(r"^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,63}$")
PHONE_RE = re.compile(r"^\+?[0-9()\-.\s]{7,25}$")
NAME_RE = re.compile(r"^[A-Za-z][A-Za-z .,'-]{0,79}$")
CONTROL_CHARS_RE = re.compile(r"[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]")


def _strip_control_chars(value: str) -> str:
    return CONTROL_CHARS_RE.sub("", value)


def _sanitize_single_line(value: str, *, max_length: int) -> str:
    cleaned = _strip_control_chars(value)
    cleaned = " ".join(cleaned.replace("\r", " ").replace("\n", " ").split())
    return cleaned[:max_length]


def _sanitize_multiline(value: str, *, max_length: int) -> str:
    cleaned = _strip_control_chars(value)
    cleaned = cleaned.replace("\r\n", "\n").replace("\r", "\n")
    cleaned = re.sub(r"\n{3,}", "\n\n", cleaned)
    return cleaned.strip()[:max_length]


def _validate_email(value: str) -> str:
    email = _sanitize_single_line(value, max_length=254).lower()
    if not EMAIL_RE.fullmatch(email):
        raise ValueError("Invalid email format")
    return email


def _validate_password(value: str) -> str:
    if any(ord(char) < 32 or ord(char) == 127 for char in value):
        raise ValueError("Password contains invalid control characters")
    if len(value) > 128:
        raise ValueError("Password must be 128 characters or fewer")
    return value


class RegisterRequest(BaseModel):
    email: str = Field(..., min_length=5, max_length=254)
    password: str = Field(..., min_length=8, max_length=128)

    @field_validator("email")
    @classmethod
    def validate_email(cls, value: str) -> str:
        return _validate_email(value)

    @field_validator("password")
    @classmethod
    def validate_password(cls, value: str) -> str:
        return _validate_password(value)


class LoginRequest(BaseModel):
    email: str = Field(..., min_length=5, max_length=254)
    password: str = Field(..., min_length=8, max_length=128)

    @field_validator("email")
    @classmethod
    def validate_email(cls, value: str) -> str:
        return _validate_email(value)

    @field_validator("password")
    @classmethod
    def validate_password(cls, value: str) -> str:
        return _validate_password(value)


class AdminUpdateRoleRequest(BaseModel):
    role: str = Field(..., pattern="^(user|admin)$")


class AdminResetPasswordRequest(BaseModel):
    new_password: str = Field(..., min_length=8, max_length=128)

    @field_validator("new_password")
    @classmethod
    def validate_password(cls, value: str) -> str:
        return _validate_password(value)


class AdminAssignPropertyRequest(BaseModel):
    property_customer_id: Optional[int] = Field(None, ge=1)
    property_name: Optional[str] = Field(None, max_length=120)

    @field_validator("property_name")
    @classmethod
    def sanitize_property_name(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return None
        cleaned = _sanitize_single_line(value, max_length=120)
        return cleaned or None


class UserResponse(BaseModel):
    id: int
    email: str
    role: str
    approved: bool
    is_active: bool
    created_at: str
    approved_at: Optional[str] = None


class CreateTicketRequest(BaseModel):
    ticket_title: str = Field(..., min_length=1, max_length=160)
    description: str = Field(..., min_length=1, max_length=4000)
    ticket_priority: Optional[str] = Field(None, pattern="^(Low|Medium|High|Critical)$")
    ticket_impact: Optional[str] = Field(None, pattern="^(Low|Medium|High|Critical)$")
    ticket_status: Optional[str] = Field(None, pattern="^(Open|Pending|Closed|Resolved)$")
    ticket_type: Optional[str] = Field(None, pattern="^(Incident|Problem|Request|Change)$")
    end_user_id: Optional[int] = Field(None, gt=0)
    end_user_first_name: Optional[str] = Field(None, max_length=80)
    end_user_last_name: Optional[str] = Field(None, max_length=80)
    end_user_email: Optional[str] = Field(None, max_length=254)
    end_user_phone: Optional[str] = Field(None, max_length=25)
    technician_contact_id: Optional[int] = Field(None, gt=0)
    technician_email: Optional[str] = Field(None, max_length=254)
    customer_id: Optional[int] = Field(None, gt=0)

    @field_validator("ticket_title")
    @classmethod
    def sanitize_ticket_title(cls, value: str) -> str:
        cleaned = _sanitize_single_line(value, max_length=160)
        if not cleaned:
            raise ValueError("Ticket title is required")
        return cleaned

    @field_validator("description")
    @classmethod
    def sanitize_description(cls, value: str) -> str:
        cleaned = _sanitize_multiline(value, max_length=4000)
        if not cleaned:
            raise ValueError("Description is required")
        return cleaned

    @field_validator("end_user_first_name", "end_user_last_name")
    @classmethod
    def validate_name(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return None
        cleaned = _sanitize_single_line(value, max_length=80)
        if not cleaned:
            return None
        if not NAME_RE.fullmatch(cleaned):
            raise ValueError("Name contains invalid characters")
        return cleaned

    @field_validator("end_user_email", "technician_email")
    @classmethod
    def validate_optional_email(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return None
        cleaned = _validate_email(value)
        return cleaned or None

    @field_validator("end_user_phone")
    @classmethod
    def validate_phone(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return None
        cleaned = _sanitize_single_line(value, max_length=25)
        if not cleaned:
            return None
        if not PHONE_RE.fullmatch(cleaned):
            raise ValueError("Phone number contains invalid characters")
        return cleaned


class TicketAiAssistRequest(BaseModel):
    description: str = Field(..., min_length=1, max_length=6000)
    ticket_title: Optional[str] = Field(None, max_length=160)

    @field_validator("description")
    @classmethod
    def sanitize_description(cls, value: str) -> str:
        cleaned = _sanitize_multiline(value, max_length=6000)
        if not cleaned:
            raise ValueError("Description is required")
        return cleaned

    @field_validator("ticket_title")
    @classmethod
    def sanitize_ticket_title(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return None
        cleaned = _sanitize_single_line(value, max_length=160)
        return cleaned or None


class TicketAiAssistResponse(BaseModel):
    ticket_title: Optional[str] = None
    description: str
    ticket_priority: Optional[str] = None
    ticket_type: Optional[str] = None
    fallback_used: bool = False
    fallback_reason: Optional[str] = None


class TicketStatusUpdateRequest(BaseModel):
    ticket_status: str = Field(..., pattern="^(Open|Pending|Closed|Resolved)$")


class AddTicketCommentRequest(BaseModel):
    comment_text: str = Field(..., min_length=1, max_length=4000)
    technician_id: Optional[int] = Field(None, gt=0)
    is_internal: bool = False
    technician_email: Optional[str] = Field(None, max_length=254)
    enduser_id: Optional[int] = Field(None, gt=0)
    mark_resolved: bool = False

    @field_validator("comment_text")
    @classmethod
    def sanitize_comment_text(cls, value: str) -> str:
        cleaned = _sanitize_multiline(value, max_length=4000)
        if not cleaned:
            raise ValueError("Comment text is required")
        return cleaned

    @field_validator("technician_email")
    @classmethod
    def validate_technician_email(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return None
        cleaned = _validate_email(value)
        return cleaned or None
