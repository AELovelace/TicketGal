# TicketGal

TicketGal is a FastAPI web application for managing Atera tickets with role-based access.

## Access Model

- Default page is a login/registration portal.
- User accounts can sign in either with a local password or with Microsoft 365.
- New accounts created by self-registration or first-time Microsoft sign-in require admin approval before access.
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

### Optional Pre-Commit Secret Scanning

To block accidental secret commits, this repo includes `.pre-commit-config.yaml`.

Install and enable hooks:

```bash
pip install pre-commit
pre-commit install
pre-commit run --all-files
```

What it checks on commit:

- Private keys
- Common credential patterns
- High-entropy secrets
- Unexpectedly large files

### Optional SQLite At-Rest Protection

To protect sensitive SQLite-backed values at rest, set:

- `DATA_ENCRYPTION_KEY` (Fernet key)

Generate a key with Python:

```bash
python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
```

Notes:

- With a key configured, TicketGal encrypts stored password hashes at rest.
- Session tokens are stored as SHA-256 hashes instead of plaintext.
- Keep this key in a secure secret store. Rotating it requires data migration planning.

### Optional Microsoft 365 SSO Configuration

To enable Microsoft sign-in, register a web app in Microsoft Entra ID and add these env vars:

- `MICROSOFT_CLIENT_ID`
- `MICROSOFT_CLIENT_SECRET`
- `MICROSOFT_TENANT_ID`
- `ALLOWED_MICROSOFT_TENANT_IDS` (optional, comma-separated explicit tenant allowlist)
- `PUBLIC_BASE_URL`
- `MICROSOFT_SCOPES` (optional, defaults to `User.Read,email`)
- `MICROSOFT_PROMPT` (optional, default `select_account` to force account picker)
- `USER_PASSWORD_AUTH_ENABLED` (optional, default `0`; when `0`, user password login/register is disabled)

Recommended Entra app settings:

- Platform: Web
- Redirect URI: `https://your-public-host/auth/microsoft/callback`
- Supported account type: multi-tenant if you plan to use `ALLOWED_MICROSOFT_TENANT_IDS`
- Delegated permissions: `openid`, `profile`, `email`, `offline_access`, `User.Read`

Multi-tenant allowlist pattern:

- Set `MICROSOFT_TENANT_ID=organizations` to keep the Microsoft login endpoint multi-tenant.
- Set `ALLOWED_MICROSOFT_TENANT_IDS=tid1,tid2,...` to restrict which returned tenant IDs are accepted after callback.
- Set `MICROSOFT_SCOPES` to delegated API scopes only. Do not include reserved OIDC scopes such as `openid`, `profile`, or `offline_access`.
- Any Microsoft sign-in whose `tid` claim is not in that allowlist is rejected before TicketGal links or creates a user.

Behavior:

- Existing TicketGal users are matched by email and linked to their Microsoft identity on first successful sign-in.
- If no local user exists yet, TicketGal creates a local `user` account tied to that Microsoft identity.
- New Microsoft-created accounts still follow the existing admin approval workflow.
- Once an account is linked, a different Microsoft object ID cannot sign in as that same TicketGal user.
- The configured `ADMIN_EMAIL` is auto-elevated to admin on Microsoft sign-in if that account somehow exists as `user`.
- When `USER_PASSWORD_AUTH_ENABLED=0`, non-admin local password login is rejected and users must sign in with Microsoft 365. Admin password login remains available.

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

### Optional Graceful Degradation and Write Queue

To enable resilience when Atera is unavailable, these flags are supported:

- `ENABLE_CACHE_READ_FALLBACK` (default `1`): serve ticket list/history from local cache when upstream is unavailable.
- `HEALTH_CHECK_ATERA` (default `1`): include Atera dependency probe in `/health`.
- `HEALTH_CHECK_TIMEOUT_SECONDS` (default `3`): timeout for health dependency probe.
- `ENABLE_WRITE_QUEUE` (default `1`): enable queued writes when Atera is unavailable.
- `ENABLE_QUEUE_FOR_CREATE_TICKET` (default `1`): allow queue fallback for ticket create.
- `ENABLE_QUEUE_FOR_STATUS_UPDATE` (default `1`): allow queue fallback for status updates.
- `ENABLE_QUEUE_FOR_COMMENT` (default `1`): allow queue fallback for ticket comments/updates.
- `QUEUE_PROCESS_BATCH_LIMIT` (default `25`): max queued items processed per drain request.
- `QUEUE_AUTO_PROCESS_ENABLED` (default `1`): automatically process queued writes in the background.
- `QUEUE_AUTO_PROCESS_INTERVAL_SECONDS` (default `30`): seconds between automatic queue-drain cycles.
- Ticket sync now also caches ticket comment history locally, and ticket history reads use that local comment cache during upstream outages.

Admin queue endpoints:

- `GET /api/admin/queue/status`
- `POST /api/admin/queue/process?limit=25`

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

If the configured port is already occupied, you can auto-stop the listener process:

```powershell
.\start-prod.ps1 -AutoKillPort
```

Or set `AUTO_KILL_PORT=1` in `.env` to make this behavior the default.

### Optional HTTPS for Local Testing

`start-prod.ps1` supports optional direct HTTPS with a self-signed certificate.

- `HTTPS_ENABLED=1` enables uvicorn TLS mode.
- `AUTO_GENERATE_DEV_CERT=1` generates a self-signed cert automatically if missing.
- `TICKETGAL_SSL_CERT_FILE` and `TICKETGAL_SSL_KEY_FILE` set certificate file paths.

When running behind nginx (or another reverse proxy doing TLS termination), keep direct app TLS disabled:

- `HTTPS_ENABLED=0`
- Configure nginx to send `X-Forwarded-Proto: https`
- Set `PUBLIC_BASE_URL` to your external HTTPS URL if you want fixed callback URLs, otherwise leave it blank to derive from request host.

## Workflow Notes

- On startup, the app initializes SQLite tables and seeds the admin account from ADMIN_EMAIL/ADMIN_PASSWORD if it does not already exist.
- New user registrations remain pending until approved in the admin panel.
- Registration requires a password (minimum 8 characters).
- Microsoft 365 sign-in creates or links a local TicketGal account by email and then issues the same app session cookie used by password login.
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
