# TicketGal Architecture

## 1. Overview

TicketGal is a FastAPI web application that sits in front of the Atera Ticket API. It provides:

- Login-first web experience
- Role-based access control (user/admin)
- Domain-restricted user self-registration
- Admin approval workflow for new users
- Ticket creation/list/status/comment operations against Atera
- Role-aware ticket visibility and status permissions

The app is a single deployable service that serves both backend APIs and frontend static assets.

## 2. High-Level Components

### 2.1 Backend API Layer

- Framework: FastAPI
- Entry point: app/main.py
- Responsibilities:
  - Serve frontend assets
  - Handle auth routes and session lifecycle
  - Enforce authorization and business rules
  - Proxy ticket operations to Atera

### 2.2 Atera Integration Layer

- Module: app/atera_client.py
- Responsibilities:
  - Attach X-API-KEY header
  - Call Atera ticket endpoints
  - Normalize HTTP error handling for backend routes

### 2.3 Authentication and Authorization Layer

- Module: app/auth.py
- Responsibilities:
  - Password hashing/verification for local accounts
  - Session token generation
  - Email/domain normalization and validation
  - Current-user resolution from session cookie
  - Role and ownership checks

- Module: app/main.py
- Additional auth responsibilities:
  - Microsoft Entra OAuth callback handling with MSAL
  - Linking Microsoft identities to local users on first successful SSO
  - Creating the same app session cookie for either password auth or Microsoft auth

### 2.4 Persistence Layer (Local App State)

- Module: app/database.py
- Engine: SQLite
- Tables:
  - users: identity, role, approval state
  - sessions: cookie session tokens and expiry

App state stored locally includes users and sessions only. Ticket data remains in Atera.

### 2.5 Frontend UI Layer

- Files:
  - app/static/index.html
  - app/static/app.js
  - app/static/styles.css
- Responsibilities:
  - Login and registration UX
  - Role-based view routing (user/admin)
  - Ticket create/list/update interactions
  - Admin panel for pending-user approvals

## 3. Runtime and Deployment Model

### 3.1 Process Model

- Uvicorn hosts FastAPI app
- Static files are served by FastAPI StaticFiles
- SQLite file is opened by the app process on demand

### 3.2 Configuration Model

Configuration is loaded from environment variables (including .env loaded at startup in config):

- ATERA_API_KEY
- ATERA_BASE_URL
- HOST
- PORT
- DB_PATH
- SESSION_COOKIE_NAME
- SESSION_HOURS
- ALLOWED_EMAIL_DOMAINS
- ADMIN_EMAIL
- ADMIN_PASSWORD
- PUBLIC_BASE_URL
- MICROSOFT_CLIENT_ID
- MICROSOFT_CLIENT_SECRET
- MICROSOFT_TENANT_ID
- ALLOWED_MICROSOFT_TENANT_IDS
- MICROSOFT_REDIRECT_PATH
- MICROSOFT_SCOPES

### 3.3 Startup Initialization

On startup, the app:

1. Initializes SQLite schema if needed
2. Seeds initial admin account if ADMIN_EMAIL and ADMIN_PASSWORD are defined and admin does not already exist

## 4. Identity, Role, and Access Model

### 4.1 User Types

- user
  - Local password login after admin approval
  - Microsoft 365 login after admin approval if linked or provisioned
  - Restricted to own tickets
- admin
  - Email + password login
  - Optional Microsoft 365 login when linked to the same local account
  - Full ticket visibility and management
  - Can approve pending users

### 4.2 Registration Policy

- Self-registration allowed only for:
  - @eternalhotels.com
  - @redlionpasco.com
- New registrations are created as role=user, approved=false
- First-time Microsoft sign-in can also create a role=user local account when signups are enabled
- Login blocked until approved by admin

### 4.3 Microsoft Identity Linking

- Microsoft auth uses OAuth 2.0 / OpenID Connect via MSAL
- TicketGal extracts the work-account email plus stable Entra object ID from the returned ID token claims
- TicketGal can optionally enforce an explicit tenant allowlist using the returned `tid` claim before account linking or provisioning
- If a local user with the same email exists and has no Microsoft link yet, the Microsoft identity is attached on first successful SSO
- If the Microsoft identity is already linked, subsequent SSO logins must come from that same Entra object ID and tenant
- If no local user exists, TicketGal can create a pending local user account and link it immediately

### 4.4 Session Security Model

- Session token stored server-side in sessions table
- Session token sent to browser via HttpOnly cookie
- Session resolution performed on protected routes via dependency

## 5. Ticket Authorization Rules

### 5.1 Ticket Listing

- Admin: receives all tickets returned by Atera query
- User: backend filters tickets by EndUserEmail == logged-in user email

### 5.2 Ticket Creation

- Admin: may create ticket for any email
- User: EndUserEmail is forced to account email server-side

### 5.3 Status Updates

Status vocabulary used by app:

- Open
- Pending
- Closed
- Resolved

Role-specific rules:

- Admin can set all four values
- User can set only Open or Resolved
- If current ticket status is Pending or Closed, user cannot change it

### 5.4 Ticket Updates/Comments

- Admin: can post updates on any ticket
- User: can post updates only on owned tickets

## 6. API Surface (Application)

### 6.1 Public/Session Routes

- GET /health
- POST /auth/register
- POST /auth/login
- POST /auth/logout
- GET /auth/me

### 6.2 Admin Routes

- GET /api/admin/users
- POST /api/admin/users/{user_id}/approve
- PATCH /api/admin/users/{user_id}/role

### 6.3 Ticket Routes (Protected)

- GET /api/tickets
- POST /api/tickets
- PATCH /api/tickets/{ticket_id}/status
- POST /api/tickets/{ticket_id}/updates

## 7. Request Flow Examples

### 7.1 User Login and Ticket List

1. Browser posts email to /auth/login
2. Backend validates user exists + approved=true
3. Backend creates session token and sets cookie
4. Browser requests /api/tickets with cookie
5. Backend fetches from Atera and filters by EndUserEmail
6. Browser renders restricted list

### 7.2 Admin Approval Flow

1. New user registers via /auth/register
2. Record created with approved=false
3. Admin logs in and opens admin panel
4. Admin calls approve endpoint
5. User can now login

### 7.3 User Status Change Guard

1. User requests PATCH /api/tickets/{id}/status
2. Backend loads ticket from Atera
3. Backend verifies ownership
4. Backend checks requested status in allowed set
5. Backend blocks if current status is Pending/Closed
6. If valid, backend forwards status update to Atera

## 8. Data Model (SQLite)

### 8.1 users

- id (PK)
- email (unique)
- role (user|admin)
- password_hash (nullable for user accounts)
- approved (0/1)
- is_active (0/1)
- created_at (ISO timestamp)
- approved_at (ISO timestamp, nullable)
- microsoft_oid (nullable)
- microsoft_tenant_id (nullable)

### 8.2 sessions

- token (PK)
- user_id (FK users.id)
- expires_at (ISO timestamp)
- created_at (ISO timestamp)

## 9. Error Handling Strategy

- Atera API failures are captured and returned with mapped status/detail
- Auth/permission failures return 401/403
- Domain and validation violations return 400
- Missing entities return 404 where applicable

## 10. Security Notes and Tradeoffs

- User accounts are passwordless by design request; this is weaker than password-based auth and relies on internal-domain email control and admin approval
- Admin accounts are password-protected using PBKDF2-SHA256 hash storage
- Session cookie is HttpOnly and server-side validated
- secure=false is currently set for local HTTP testing; for production behind HTTPS, secure=true should be enabled

## 11. Future Architecture Improvements

- Add CSRF protection for cookie-authenticated state-changing routes
- Add password reset/admin credential rotation workflow
- Add structured audit log table for approvals and ticket actions
- Add pagination/filter controls in admin UI and user UI
- Add integration tests for role and status policy matrix
