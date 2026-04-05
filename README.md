# TicketGal

TicketGal is a FastAPI web application for managing Atera tickets with role-based access.

## Access Model

- Default page is a login/registration portal.
- User accounts are passwordless and require admin approval before first login.
- All accounts are password-protected.
- Registration only allows emails specified in .env

## Roles

### User
- Can register and log in after approval.
- Can only view tickets where EndUserEmail matches their account email.
- Can create tickets only under their own email (email field is locked in UI and enforced server-side).
- Status options: Open, Resolved.
- Cannot change status if ticket is currently Pending or Closed.
- Can post updates only on their own tickets.

### Admin
- Can view all tickets.
- Can create tickets for any email.
- Status options: Open, Pending, Closed, Resolved.
- Can post updates on all tickets.
- Has admin panel for user approval and role management tasks.
- Can reset passwords for user accounts.

## Prerequisites

- Python 3.10+
- Atera API key

## Setup

1. Create and activate a virtual environment.
2. Install dependencies:

   ```bash
   pip install -r requirements.txt
   ```

3. Create .env from .env.example and fill values.
4. Set ADMIN_EMAIL and ADMIN_PASSWORD in .env for first admin seed.

### Optional AI Assist Configuration

To enable AI rewrite + ticket field suggestions in the create-ticket form, set:

- `OPENAI_API_KEY` (optional for local OpenAI-compatible endpoints such as Ollama)
- `OPENAI_MODEL` (optional, default: `gpt-4o-mini`)
- `OPENAI_BASE_URL` (optional, default: `https://api.openai.com/v1`)
- `OPENAI_TIMEOUT_SECONDS` (optional, default: `300`)

Example `.env` values for local Ollama:

```env
OPENAI_BASE_URL=http://localhost:11434/v1
OPENAI_MODEL=llama3.1
OPENAI_TIMEOUT_SECONDS=300
# OPENAI_API_KEY is optional for local Ollama
```

## Run (Development)

```bash
uvicorn app.main:app --reload
```

## Run (Production-Style With Uvicorn)

```bash
uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 2 --proxy-headers
```

Or on PowerShell:

```powershell
.\start-prod.ps1
```

## Workflow Notes

- On startup, the app initializes SQLite tables and seeds the admin account from ADMIN_EMAIL/ADMIN_PASSWORD if it does not already exist.
- New user registrations remain pending until approved in the admin panel.
- Registration requires a password (minimum 8 characters).
- Admins can reset any user's password in the admin panel.
- In the create-ticket form, technicians can click **AI Rewrite & Auto-Fill** to rewrite description and suggest title/priority/type.
- AI assist intentionally does not set initial status or end user email; those remain technician-controlled.

## Atera Integration

- Authentication header: X-API-KEY
- Ticket list: /api/v3/tickets
- Ticket create: /api/v3/tickets
- Ticket update/status: /api/v3/tickets/{ticketId}
- Ticket comments: /api/v3/tickets/{ticketId}/comments

## Current Limitations

- Outlook drag-and-drop support depends on what payload Outlook/browser exposes; .eml works best, .msg and text/html/text/plain drops use best-effort parsing.
- Password reset flow is not implemented.
