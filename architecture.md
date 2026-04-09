# TicketGal Architecture

## Overview

TicketGal is a single-service FastAPI application that combines:

- a browser-facing support portal
- a local identity and session system
- an Atera API integration layer
- a local caching and queueing subsystem
- a markdown knowledgebase

The system is intentionally lightweight to deploy. It avoids external infrastructure beyond Atera and optional AI and Microsoft identity providers, but it trades that simplicity for a fairly large application core concentrated in a few Python modules, especially [app/main.py](/c:/Scripts/TicketGal/app/main.py).

## Block Diagrams

### System Context

```text
                         +----------------------+
                         |  Browser / End User  |
                         +----------+-----------+
                                    |
                                    | HTTPS
                                    v
                         +----------+-----------+
                         |   Nginx / Reverse    |
                         |   Proxy (+ optional  |
                         |    ModSecurity)      |
                         +----------+-----------+
                                    |
                                    | HTTP on localhost
                                    v
                   +----------------+----------------+
                   |        TicketGal FastAPI        |
                   |                                 |
                   |  - API routes                   |
                   |  - auth/session handling        |
                   |  - static UI serving            |
                   |  - queue worker                 |
                   |  - reporting + KB endpoints     |
                   +--------+-------------+----------+
                            |             |
                 live API   |             | local state
                 traffic    |             |
                            v             v
                 +----------+--+   +------+----------------------+
                 |   Atera API  |   |      Local Storage         |
                 |              |   |                             |
                 | tickets      |   |  main DB                   |
                 | comments     |   |  ticket cache DB           |
                 | customers    |   |  transactions DB           |
                 | alerts       |   |  KB markdown + assets      |
                 +--------------+   +-----------------------------+
```

### Internal Application Shape

```text
 +--------------------------------------------------------------+
 |                         TicketGal App                        |
 +--------------------------------------------------------------+
 |                      app/main.py                             |
 |  routes | middleware | orchestration | startup | queue loop  |
 +-------------------+------------------+-----------------------+
                     |                  |
                     |                  |
         +-----------v-----+    +-------v------------------+
         |   app/auth.py   |    |    app/atera_client.py   |
         |  passwords      |    |  upstream allowlist      |
         |  sessions       |    |  httpx wrapper           |
         |  role guards    |    |  Atera error mapping     |
         +-----------+-----+    +---------------+----------+
                     |                          |
                     |                          |
         +-----------v--------------------------------------+
         |                 app/database.py                  |
         |  users | sessions | cache | queue | KB metadata  |
         +-----------+----------------------+---------------+
                     |                      |
                     |                      |
         +-----------v-----+      +---------v----------------+
         |   SQLite DBs    |      |  KB files on disk        |
         |  main/cache/tx  |      |  markdown + image assets |
         +-----------------+      +--------------------------+
```

## High-Level Shape

### Runtime Components

- FastAPI application for API routes and static file serving
- Browser UI delivered from [app/static](/c:/Scripts/TicketGal/app/static)
- Atera client wrapper with a strict upstream route allowlist in [app/atera_client.py](/c:/Scripts/TicketGal/app/atera_client.py)
- SQLite-backed local state and migrations in [app/database.py](/c:/Scripts/TicketGal/app/database.py)
- Background queue worker started during app startup

### External Dependencies

- Atera API for ticket, comment, customer, and alert operations
- Microsoft Entra ID through `msal` for optional SSO
- OpenAI-compatible chat endpoint for AI ticket rewriting and report narratives
- Optional Nginx + ModSecurity edge in production

## Component Breakdown

### 1. Web Layer

[app/main.py](/c:/Scripts/TicketGal/app/main.py) owns:

- FastAPI app creation
- static file mounting
- page routes for `/`, `/register`, and `/kb-editor`
- middleware for CSRF and security headers
- nearly all API routes
- queue worker startup and shutdown

This is the operational center of the app. It works, but it is also the main architectural pressure point because auth, ticketing, queue logic, AI integration, reporting, and knowledgebase behaviors are all coordinated from one module.

### 2. Frontend Layer

The frontend is plain static HTML, CSS, and vanilla JavaScript:

- [index.html](/c:/Scripts/TicketGal/app/static/index.html)
- [app.js](/c:/Scripts/TicketGal/app/static/app.js)
- [register.html](/c:/Scripts/TicketGal/app/static/register.html)
- [register.js](/c:/Scripts/TicketGal/app/static/register.js)
- [kb-editor.html](/c:/Scripts/TicketGal/app/static/kb-editor.html)
- [kb-editor-window.js](/c:/Scripts/TicketGal/app/static/kb-editor-window.js)

It does not depend on a frontend build pipeline, which keeps deployment simple. The tradeoff is that a large amount of client behavior lives in one big script file, similar to the backend pattern.

### 3. Auth And Access Control

[app/auth.py](/c:/Scripts/TicketGal/app/auth.py) provides:

- PBKDF2 password hashing and verification
- session token generation
- email normalization and allowed-domain checks
- current-user lookup from cookie session
- admin and ownership enforcement helpers

The access model is straightforward:

- `admin` can see and manage everything
- `user` is scoped to tickets whose `EndUserEmail` matches the logged-in account

Additional auth behavior lives in [app/main.py](/c:/Scripts/TicketGal/app/main.py) for:

- local registration and login
- Microsoft OAuth initiation and callback handling
- account linking
- approval and role management flows
- CSRF cookie issuance

### 4. Atera Integration

[app/atera_client.py](/c:/Scripts/TicketGal/app/atera_client.py) is a good architectural boundary. It limits outbound traffic to a known-safe set of methods and paths rather than acting as a generic Atera proxy.

Allowed upstream operations currently cover:

- list tickets
- create ticket
- get/update ticket
- list/add comments
- list customers
- list alerts
- dismiss/resolve alerts

This is a strong safety decision because it narrows accidental scope creep and prevents arbitrary upstream access from route code.

### 5. Persistence Layer

TicketGal uses three SQLite databases rather than one:

#### Main DB

Configured by `DB_PATH`, this stores:

- `users`
- `sessions`
- `login_rate_limits`
- `site_settings`
- `audit_log`
- `knowledgebase_articles`
- `kb_article_user_whitelist`

#### Ticket Cache DB

Configured by `TICKET_CACHE_DB_PATH`, this stores:

- `ticket_cache`
- `ticket_status_history`
- `ticket_comment_cache`

This supports degraded reads and reporting even when Atera is unavailable.

#### Transactions DB

Configured by `TICKET_TRANSACTIONS_DB_PATH`, this stores:

- `transaction_queue`

This is the retryable write queue used during upstream outages.

Splitting the data by responsibility is a sensible design choice here. It reduces contention between app state, read cache, and queued writes, while keeping each SQLite file conceptually focused.

### 6. Knowledgebase Subsystem

The knowledgebase is hybrid storage:

- metadata in SQLite
- markdown content on disk
- uploaded image assets on disk

Visibility modes:

- `public`
- `admin_only`
- `company_assigned`
- `user_allowlist`

This design keeps article content easy to inspect and back up, but it means article integrity depends on both the DB record and the filesystem remaining aligned.

## Core Request And Data Flows

### Login Flow

1. User authenticates via password or Microsoft 365.
2. TicketGal resolves or creates a local user.
3. Approval and active-state gates are enforced.
4. A server-side session is created and a cookie is sent to the browser.
5. A CSRF token cookie is also issued for later state-changing requests.

### Ticket Read Flow

1. Browser calls `/api/tickets` or `/api/tickets/{id}/history`.
2. App fetches from Atera.
3. Non-admin results are filtered by ownership.
4. Successful reads refresh the local ticket and comment cache.
5. If Atera is unavailable and cached fallback is enabled, the app serves cached data.

```text
 +---------+      +--------------+      +-----------+
 | Browser | ---> | TicketGal    | ---> | Atera API |
 +----+----+      +------+-------+      +-----+-----+
      |                  |                    |
      |                  |<-------------------+
      |                  |   live ticket data
      |                  |
      |                  +--> update local cache
      |                  |
      |<-----------------+
      | filtered response

 Degraded path:

 +---------+      +--------------+      +-----------------+
 | Browser | ---> | TicketGal    | ---> | Atera failure   |
 +----+----+      +------+-------+      +-----------------+
      |                  |
      |                  +--> read local ticket/comment cache
      |<-----------------+
      | degraded response
```

### Ticket Write Flow

1. Browser submits create, comment, status, or alert-dismiss action.
2. App validates role-specific business rules.
3. App attempts the Atera write.
4. If Atera is down and queueing is enabled, the action is stored in `transaction_queue`.
5. A background worker or manual admin action drains queued work later.

```text
 normal write

 +---------+      +--------------+      +-----------+
 | Browser | ---> | TicketGal    | ---> | Atera API |
 +---------+      +------+-------+      +-----+-----+
                         |                    |
                         |<-------------------+
                         | success/failure
                         v
                    return response


 outage write with queue fallback

 +---------+      +--------------+      +-------------------+
 | Browser | ---> | TicketGal    | ---> | Atera unavailable |
 +---------+      +------+-------+      +-------------------+
                         |
                         +--> transaction_queue
                         |
                         +--> 202 queued response


 replay path

 +------------------+      +--------------+      +-----------+
 | Queue worker /   | ---> | TicketGal    | ---> | Atera API |
 | admin drain call |      +------+-------+      +-----+-----+
 +------------------+             |                    |
                                  |<-------------------+
                                  | mark complete/retry
```

### Reporting Flow

1. Admin requests `/api/reports/summary`.
2. Report data is computed from the local ticket cache and status history, not from live Atera queries.
3. Optional AI narrative generation summarizes the cached stats.

This is an important design choice: reports depend on the sync/cache layer being current.

```text
 +-------------+      +--------------+      +----------------------+
 | Admin UI    | ---> | TicketGal    | ---> | ticket cache DB      |
 +-------------+      +------+-------+      | status history DB    |
                              |              +----------+-----------+
                              |                         |
                              |<------------------------+
                              | aggregate stats
                              |
                              +--> optional AI provider
                              |
                              +--> report JSON back to UI
```

### Knowledgebase Flow

1. Admin creates or edits an article.
2. Markdown is written to disk.
3. Metadata is written to SQLite.
4. Users fetch article lists through access-filtered API routes.
5. Article content is read from disk and returned to the frontend for markdown rendering.

```text
 write path

 +----------+      +--------------+      +------------------+
 | Admin UI  | ---> | TicketGal    | ---> | KB markdown file |
 +----------+      +------+-------+      +------------------+
                          |
                          +--> knowledgebase_articles table

 read path

 +----------+      +--------------+      +--------------------------+
 | User UI   | ---> | TicketGal    | ---> | KB metadata + whitelist  |
 +----------+      +------+-------+      +--------------------------+
                          |
                          +--> read markdown from disk
                          |
                          +--> return article content
```

## Security Architecture

### Positive Controls

- Password hashing with PBKDF2 and salt
- Optional encryption-at-rest for protected DB values via Fernet
- Session tokens stored as hashes
- HttpOnly session cookies
- CSRF protection for authenticated state-changing routes
- Security headers including CSP and HSTS when HTTPS is detected
- Explicit Atera route allowlist
- Role and ownership checks in route handlers
- Login rate limiting with email and IP dimensions
- Audit logging for auth and admin events
- Optional ModSecurity templates for the reverse proxy edge

### Notable Security Assumptions

- Ticket ownership is derived from Atera `EndUserEmail`, so identity consistency between local accounts and upstream ticket records is important.
- Secure cookie behavior depends on correct proxy headers or `PUBLIC_BASE_URL`.
- Knowledgebase content is sanitized in the browser rather than fully normalized server-side.

## Operational Architecture

### Startup Behavior

On startup, the app:

- initializes all SQLite schemas
- performs lightweight migrations and backfills
- seeds the bootstrap admin when configured
- computes static asset hashes
- optionally starts the queue worker

### Production Topology

Recommended production layout:

- Nginx on `80/443`
- TicketGal Uvicorn workers bound to `127.0.0.1:8000`
- systemd managing the app process
- optional ModSecurity CRS at the Nginx edge

This matches the assets already present in:

- [ticketgal.service](/c:/Scripts/TicketGal/ticketgal.service)
- [start-prod.sh](/c:/Scripts/TicketGal/start-prod.sh)
- [deploy/nginx/ticketgal-http.conf.template](/c:/Scripts/TicketGal/deploy/nginx/ticketgal-http.conf.template)
- [deploy/nginx/ticketgal-https.conf.template](/c:/Scripts/TicketGal/deploy/nginx/ticketgal-https.conf.template)

```text
                 public internet
                        |
                        v
             +------------------------+
             |  Nginx :80 / :443      |
             |  optional ModSecurity  |
             +-----------+------------+
                         |
                         | proxy_pass
                         v
             +-----------+------------+
             | TicketGal Uvicorn      |
             | 127.0.0.1:8000         |
             +-----------+------------+
                         |
          +--------------+---------------+
          |                              |
          v                              v
 +--------+---------+          +---------+---------+
 | local SQLite DBs |          | KB files on disk  |
 +------------------+          +-------------------+
```

## Architectural Strengths

- Very easy to deploy because everything is in one service and SQLite-backed
- Good resilience story for a small app through cached reads and queued writes
- Clear upstream safety boundary in the Atera client
- Production concerns are already represented in repo scripts and templates
- The knowledgebase visibility model is richer than a basic public/private split

## Architectural Risks And Friction Points

### Large Application Core

[app/main.py](/c:/Scripts/TicketGal/app/main.py) is doing too much. That increases the cost of change, makes route behavior harder to test in isolation, and raises regression risk as features expand.

### Mixed Storage Model For Knowledgebase

Knowledgebase content is split across DB metadata and filesystem markdown/assets. That is workable, but migrations, backups, and deletes have to account for both layers.

### Cache Freshness Dependency

Reports and degraded-mode reads are only as good as the last successful sync or opportunistic cache refresh. If sync discipline slips, admins may see stale analytics while the app still appears healthy.

### Partial Test Drift

The test files under [app/tests](/c:/Scripts/TicketGal/app/tests) appear to reference older routes and role names in places, which suggests the documented architecture and the current test suite are not perfectly aligned. That is a maintainability risk more than a runtime risk.

### SQLite Concurrency Ceiling

For the current size and deployment model, SQLite is reasonable. For an organization with roughly 100 total users and around 50 users with portal access, SQLite would not be an expected bottleneck by itself.

The more important scaling factor here is concurrent write pressure, not raw user count. TicketGal is more likely to feel SQLite limits when several things overlap:

- many users creating tickets or posting updates at the same time
- queue replay processing a burst of deferred writes
- sync or cache-refresh activity running during busy periods
- multiple app workers contending on the same database files

A rough rule of thumb for this app is that SQLite should remain comfortable at small internal-tool scale, and concern would start to shift from theoretical to practical when active usage climbs well beyond the current footprint or when write-heavy bursts become common. In other words, the likely trigger is not "50 users exist," but "enough simultaneous writes are happening that lock contention becomes visible."

## Suggested Next Refactors

1. Split `app/main.py` into route modules by domain: auth, admin, tickets, reports, knowledgebase.
2. Move queue processing into a dedicated service module.
3. Move AI/report prompt construction into isolated helper modules.
4. Move DB access behind a thinner service boundary for easier testing.
5. Refresh the automated tests so route coverage matches the current API surface.

## Summary

TicketGal is a pragmatic monolith: simple to run, fast to deploy, and stronger operationally than many small internal tools because it already includes caching, queueing, audit logging, and reverse-proxy assets. Its main challenge is not lack of capability, but concentration of responsibility in a few large files that are starting to carry too much of the system at once.
