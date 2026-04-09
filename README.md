# TicketGal

TicketGal is a FastAPI/Uvicorn-based self-service and admin portal that sits in front of the Atera API. It serves a browser UI, manages local users and sessions, mirrors ticket data into local SQLite caches for reporting and degraded reads, and can queue write operations when Atera is unavailable.

## What The App Does

- Serves a login-first portal for end users and admins.
- Supports local password auth, Microsoft 365 sign-in, or both.
- Restricts self-registration by allowed email domains and admin approval.
- Lets users create tickets, view only their own tickets, and post updates.
- Gives admins full ticket visibility, user management, reporting, alert handling, and knowledgebase management.
- Stores knowledgebase article metadata in SQLite and article content/assets on disk.
- Can fall back to local cached ticket data and queue writes during upstream outages.

## Architecture Snapshot

- Backend: FastAPI app in [app/main.py](/c:/Scripts/TicketGal/app/main.py)
- Atera integration: [app/atera_client.py](/c:/Scripts/TicketGal/app/atera_client.py)
- Auth helpers: [app/auth.py](/c:/Scripts/TicketGal/app/auth.py)
- Validation models: [app/schemas.py](/c:/Scripts/TicketGal/app/schemas.py)
- Persistence and migrations: [app/database.py](/c:/Scripts/TicketGal/app/database.py)
- Frontend: static HTML/CSS/JS in [app/static](/c:/Scripts/TicketGal/app/static)
- Linux service bootstrap: [install.sh](/c:/Scripts/TicketGal/install.sh), [ticketgal.service](/c:/Scripts/TicketGal/ticketgal.service), [start-prod.sh](/c:/Scripts/TicketGal/start-prod.sh)
- Nginx/ModSecurity assets: [deploy/nginx](/c:/Scripts/TicketGal/deploy/nginx), [deploy/modsecurity](/c:/Scripts/TicketGal/deploy/modsecurity)

See [architecture.md](/c:/Scripts/TicketGal/architecture.md) for the full architectural analysis and [ubuntu-nginx-proxy-guide.md](/c:/Scripts/TicketGal/ubuntu-nginx-proxy-guide.md) for Ubuntu deployment behind Nginx.

## Main Features

- Role-based portal with separate user and admin experiences
- Admin approval workflow for new accounts
- Microsoft Entra ID sign-in with tenant allowlisting and optional MFA enforcement
- PBKDF2 password hashing and optional encryption-at-rest for stored password hashes
- Server-side sessions with hashed session tokens
- CSRF protection for authenticated state-changing requests
- Security headers and proxy-aware secure cookie behavior
- Atera alert viewing and dismissal for admins
- Ticket cache, status history, and comment cache for degraded reads and reporting
- Write queue for ticket create, status update, comment, and alert-dismiss actions
- Markdown knowledgebase with property-scoped visibility and image uploads
- Branding overrides via a dedicated branding env file
- Ubuntu-ready service and reverse proxy assets, including ModSecurity support

## Repo Layout

```text
app/
  main.py                  FastAPI app, routes, middleware, background worker
  atera_client.py          Allowed Atera operations and HTTP client wrapper
  auth.py                  Password/session helpers and auth guards
  config.py                Environment loading and settings
  database.py              SQLite schema, migrations, cache and queue logic
  schemas.py               Request validation models
  static/                  Browser UI assets
deploy/
  nginx/                   Reverse proxy config templates
  modsecurity/             TicketGal-specific ModSecurity + CRS tuning
scripts/
  install_nginx_modsecurity.sh
  test_waf.sh
install.sh                 Ubuntu install/bootstrap script
start-prod.sh              Linux production-style launcher
ticketgal.service          systemd service unit template
```

## Prerequisites

- Python 3.11+
- An Atera API key
- Optional: Microsoft Entra app registration for SSO
- Optional: OpenAI-compatible endpoint for AI-assisted ticket rewriting

## Quick Start

```bash
python -m venv .venv
. .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
cp .env.branding.example .env.branding
python -m uvicorn app.main:app --reload
```

On Windows PowerShell:

```powershell
py -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
Copy-Item .env.example .env
Copy-Item .env.branding.example .env.branding
py -m uvicorn app.main:app --reload
```

Then open `http://127.0.0.1:8000`.

## Required Configuration

At minimum, configure these in `.env`:

- `ATERA_API_KEY`
- `HOST`
- `PORT`
- `ALLOWED_EMAIL_DOMAINS`

Recommended for first boot:

- `ADMIN_EMAIL`
- `ADMIN_PASSWORD`
- `PUBLIC_BASE_URL` when running behind a proxy
- `BRANDING_ENV_FILE=.env.branding`

Important storage settings:

- `DB_PATH`
- `TICKET_CACHE_DB_PATH`
- `TICKET_TRANSACTIONS_DB_PATH`
- `DATA_ENCRYPTION_KEY`

## Authentication Modes

### Local Password Auth

- Controlled by `USER_PASSWORD_AUTH_ENABLED`
- Registration uses `POST /auth/register`
- Login uses `POST /auth/login`
- New accounts require admin approval

### Microsoft 365 Auth

Configure:

- `MICROSOFT_CLIENT_ID`
- `MICROSOFT_CLIENT_SECRET`
- `MICROSOFT_TENANT_ID`
- `ALLOWED_MICROSOFT_TENANT_IDS`
- `PUBLIC_BASE_URL`
- `MICROSOFT_SCOPES`
- `MICROSOFT_PROMPT`
- `MICROSOFT_REQUIRE_MFA`

Behavior:

- Users start sign-in at `/auth/microsoft/login`
- Callback defaults to `/auth/microsoft/callback`
- Existing local users can be linked by email
- New SSO-created users still require approval unless already elevated as the bootstrap admin

## Branding

Branding values are loaded from a separate file so deployments can be re-skinned without changing code.

1. Copy `.env.branding.example` to `.env.branding`
2. Edit the `BRAND_*` values
3. Keep `BRANDING_ENV_FILE=.env.branding` in `.env`

The UI reads branding through `GET /api/branding`.

## AI Assist

Admin ticket creation can call `POST /api/tickets/ai-assist` to rewrite messy intake text into cleaner helpdesk language and infer title, priority, and type.

Relevant settings:

- `OPENAI_API_KEY`
- `OPENAI_BASE_URL`
- `OPENAI_MODEL`
- `OPENAI_TIMEOUT_SECONDS`

If the configured provider needs a key and no key is set, the app falls back to deterministic local rewriting instead of failing hard.

## Resilience Features

### Cached Reads

When Atera is unavailable and cached reads are enabled, the app can serve:

- ticket list data from the local ticket cache
- ticket history from cached ticket records and cached comments
- report summaries from the local reporting cache

Relevant settings:

- `ENABLE_CACHE_READ_FALLBACK`
- `HEALTH_CHECK_ATERA`
- `HEALTH_CHECK_TIMEOUT_SECONDS`

### Write Queue

When enabled, write operations can be queued if Atera returns an upstream outage-class failure.

Queued operations include:

- create ticket
- update ticket status
- add ticket comment
- dismiss alert

Relevant settings:

- `ENABLE_WRITE_QUEUE`
- `ENABLE_QUEUE_FOR_CREATE_TICKET`
- `ENABLE_QUEUE_FOR_STATUS_UPDATE`
- `ENABLE_QUEUE_FOR_COMMENT`
- `QUEUE_PROCESS_BATCH_LIMIT`
- `QUEUE_AUTO_PROCESS_ENABLED`
- `QUEUE_AUTO_PROCESS_INTERVAL_SECONDS`

Admin queue endpoints:

- `GET /api/admin/queue/status`
- `POST /api/admin/queue/process`

## Data Storage

TicketGal currently uses three SQLite databases:

- main app DB: users, sessions, settings, audit log, knowledgebase metadata
- ticket cache DB: cached tickets, status history, cached comments
- transactions DB: queued writes and retry state

Knowledgebase content is also written to disk under `app/knowledgebase/...`, with uploaded images under `app/knowledgebase/assets`.

## Running The App

Development:

```bash
python -m uvicorn app.main:app --reload
```

Production-style on Linux:

```bash
chmod +x start-prod.sh
./start-prod.sh
```

Production-style on PowerShell:

```powershell
.\start-prod.ps1
```

## Health And Operations

- `GET /health` gives a basic service health response
- authenticated admins get more detail, including Atera probe status and cache sync metadata
- admin UI can manually sync tickets from Atera with `POST /api/admin/sync-tickets-from-atera`
- audit events are stored locally and exposed through `GET /api/admin/audit-log`
- login lockouts are visible and clearable through admin security endpoints

## Ubuntu + Nginx Deployment

The app already includes:

- a systemd service file
- a Linux startup script
- an Ubuntu install script
- Nginx reverse proxy templates
- ModSecurity + OWASP CRS templates

For deployment instructions, use [ubuntu-nginx-proxy-guide.md](/c:/Scripts/TicketGal/ubuntu-nginx-proxy-guide.md).

If you want to use the included reverse proxy installer directly:

```bash
sudo bash scripts/install_nginx_modsecurity.sh --server-name tickets.example.com
```

## Security Notes

- Passwords use PBKDF2-SHA256 with per-password salt
- Session cookies are `HttpOnly`, proxy-aware for `Secure`, and paired with a CSRF cookie/header check
- The Atera client uses an explicit allowlist of upstream operations
- The app emits CSP, frame, content-type, referrer, and permissions headers
- Optional ModSecurity rules are provided for edge filtering

## Current Architectural Notes

- The app is operationally simple because it is a single FastAPI service with no external database dependency.
- A large amount of behavior currently lives in `app/main.py`, which makes the codebase easy to run but harder to reason about as features grow.
- Some test files in `app/tests` appear to reflect older routes and role names, so test coverage should be reviewed before treating the suite as authoritative.

## Additional Docs

- [architecture.md](/c:/Scripts/TicketGal/architecture.md)
- [ubuntu-nginx-proxy-guide.md](/c:/Scripts/TicketGal/ubuntu-nginx-proxy-guide.md)
