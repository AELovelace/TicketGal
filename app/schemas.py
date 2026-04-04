from typing import Optional

from pydantic import BaseModel, Field


class RegisterRequest(BaseModel):
    email: str = Field(..., min_length=5)
    password: str = Field(..., min_length=8)


class LoginRequest(BaseModel):
    email: str = Field(..., min_length=5)
    password: str = Field(..., min_length=8)


class AdminUpdateRoleRequest(BaseModel):
    role: str = Field(..., pattern="^(user|admin)$")


class AdminResetPasswordRequest(BaseModel):
    new_password: Optional[str] = Field(None, min_length=8)


class AdminAssignPropertyRequest(BaseModel):
    property_customer_id: Optional[int] = None
    property_name: Optional[str] = None


class UserResponse(BaseModel):
    id: int
    email: str
    role: str
    approved: bool
    is_active: bool
    created_at: str
    approved_at: Optional[str] = None


class CreateTicketRequest(BaseModel):
    ticket_title: str = Field(..., min_length=1)
    description: str = Field(..., min_length=1)
    ticket_priority: Optional[str] = None
    ticket_impact: Optional[str] = None
    ticket_status: Optional[str] = None
    ticket_type: Optional[str] = None
    end_user_id: Optional[int] = None
    end_user_first_name: Optional[str] = None
    end_user_last_name: Optional[str] = None
    end_user_email: Optional[str] = None
    end_user_phone: Optional[str] = None
    technician_contact_id: Optional[int] = None
    technician_email: Optional[str] = None
    customer_id: Optional[int] = None


class TicketStatusUpdateRequest(BaseModel):
    ticket_status: str = Field(..., pattern="^(Open|Pending|Closed|Resolved)$")


class AddTicketCommentRequest(BaseModel):
    comment_text: str = Field(..., min_length=1)
    technician_id: Optional[int] = None
    is_internal: bool = False
    technician_email: Optional[str] = None
    enduser_id: Optional[int] = None
    mark_resolved: bool = False
