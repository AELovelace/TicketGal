import hashlib
import json
import sqlite3
from contextlib import contextmanager
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Generator, List, Optional

from cryptography.fernet import Fernet, InvalidToken

from .config import settings


_ENCRYPTED_PREFIX = "enc$"
_fernet_instance: Optional[Fernet] = None


def _get_fernet() -> Optional[Fernet]:
    global _fernet_instance
    if _fernet_instance is not None:
        return _fernet_instance

    key = settings.data_encryption_key
    if not key:
        return None

    try:
        _fernet_instance = Fernet(key.encode("utf-8"))
    except Exception as exc:
        raise RuntimeError("DATA_ENCRYPTION_KEY is invalid. Expected a Fernet key.") from exc
    return _fernet_instance


def _encrypt_optional(value: Optional[str]) -> Optional[str]:
    if value is None:
        return None

    fernet = _get_fernet()
    if not fernet:
        return value

    if value.startswith(_ENCRYPTED_PREFIX):
        return value

    encrypted = fernet.encrypt(value.encode("utf-8")).decode("utf-8")
    return f"{_ENCRYPTED_PREFIX}{encrypted}"


def _decrypt_optional(value: Optional[str]) -> Optional[str]:
    if value is None:
        return None

    if not value.startswith(_ENCRYPTED_PREFIX):
        return value

    fernet = _get_fernet()
    if not fernet:
        raise RuntimeError("DATA_ENCRYPTION_KEY is required to decrypt protected database values.")

    encrypted = value[len(_ENCRYPTED_PREFIX) :]
    try:
        return fernet.decrypt(encrypted.encode("utf-8")).decode("utf-8")
    except InvalidToken as exc:
        raise RuntimeError("Unable to decrypt protected database values. Check DATA_ENCRYPTION_KEY.") from exc


def _hash_session_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def _decode_user_row(row: sqlite3.Row) -> Dict[str, Any]:
    user = dict(row)
    user["password_hash"] = _decrypt_optional(user.get("password_hash"))
    return user


def _utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _apply_common_pragmas(conn: sqlite3.Connection) -> None:
    conn.execute("PRAGMA foreign_keys = ON")
    conn.execute("PRAGMA busy_timeout = 5000")
    conn.execute("PRAGMA journal_mode = WAL")


@contextmanager
def get_conn() -> Generator[sqlite3.Connection, None, None]:
    conn = sqlite3.connect(settings.db_path)
    conn.row_factory = sqlite3.Row
    _apply_common_pragmas(conn)
    try:
        yield conn
    finally:
        conn.close()


@contextmanager
def get_ticket_cache_conn() -> Generator[sqlite3.Connection, None, None]:
    conn = sqlite3.connect(settings.ticket_cache_db_path)
    conn.row_factory = sqlite3.Row
    _apply_common_pragmas(conn)
    try:
        yield conn
    finally:
        conn.close()


def _create_ticket_cache_schema() -> None:
    with get_ticket_cache_conn() as conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS ticket_cache (
                ticket_id INTEGER PRIMARY KEY,
                ticket_status TEXT,
                customer_id INTEGER,
                customer_name TEXT,
                end_user_email TEXT,
                ticket_title TEXT,
                created_at TEXT,
                updated_at TEXT,
                raw_json TEXT NOT NULL,
                last_seen_sync_at TEXT NOT NULL
            )
            """
        )
        conn.execute(
            """
            CREATE INDEX IF NOT EXISTS idx_ticket_cache_status
            ON ticket_cache(ticket_status)
            """
        )
        conn.execute(
            """
            CREATE INDEX IF NOT EXISTS idx_ticket_cache_customer_id
            ON ticket_cache(customer_id)
            """
        )
        conn.execute(
            """
            CREATE INDEX IF NOT EXISTS idx_ticket_cache_end_user_email
            ON ticket_cache(end_user_email)
            """
        )
        conn.commit()


def _legacy_ticket_cache_exists_in_main_db() -> bool:
    with get_conn() as conn:
        row = conn.execute(
            "SELECT name FROM sqlite_master WHERE type='table' AND name='ticket_cache'"
        ).fetchone()
    return row is not None


def _migrate_legacy_ticket_cache_to_dedicated_db() -> None:
    if not _legacy_ticket_cache_exists_in_main_db():
        return

    with get_conn() as conn:
        legacy_rows = conn.execute("SELECT raw_json FROM ticket_cache").fetchall()

    sync_marker = _utc_now_iso()
    rows: List[tuple] = []
    for legacy_row in legacy_rows:
        raw_json = str(legacy_row["raw_json"] or "")
        if not raw_json:
            continue
        try:
            parsed = json.loads(raw_json)
        except Exception:
            continue
        if not isinstance(parsed, dict):
            continue
        mapped = _ticket_cache_row(parsed, sync_marker)
        if mapped is not None:
            rows.append(mapped)

    if rows:
        with get_ticket_cache_conn() as conn:
            conn.executemany(
                """
                INSERT INTO ticket_cache(
                    ticket_id,
                    ticket_status,
                    customer_id,
                    customer_name,
                    end_user_email,
                    ticket_title,
                    created_at,
                    updated_at,
                    raw_json,
                    last_seen_sync_at
                )
                VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(ticket_id) DO UPDATE SET
                    ticket_status = excluded.ticket_status,
                    customer_id = excluded.customer_id,
                    customer_name = excluded.customer_name,
                    end_user_email = excluded.end_user_email,
                    ticket_title = excluded.ticket_title,
                    created_at = excluded.created_at,
                    updated_at = excluded.updated_at,
                    raw_json = excluded.raw_json,
                    last_seen_sync_at = excluded.last_seen_sync_at
                """,
                rows,
            )
            conn.commit()

    with get_conn() as conn:
        conn.execute("DROP TABLE IF EXISTS ticket_cache")
        conn.execute("DROP INDEX IF EXISTS idx_ticket_cache_status")
        conn.execute("DROP INDEX IF EXISTS idx_ticket_cache_customer_id")
        conn.execute("DROP INDEX IF EXISTS idx_ticket_cache_end_user_email")
        conn.commit()
        conn.execute("VACUUM")


def init_db() -> None:
    _create_ticket_cache_schema()
    _migrate_legacy_ticket_cache_to_dedicated_db()

    with get_conn() as conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                email TEXT NOT NULL UNIQUE,
                role TEXT NOT NULL CHECK(role IN ('user','admin')),
                password_hash TEXT,
                approved INTEGER NOT NULL DEFAULT 0,
                is_active INTEGER NOT NULL DEFAULT 1,
                created_at TEXT NOT NULL,
                approved_at TEXT
            )
            """
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS sessions (
                token TEXT PRIMARY KEY,
                token_hash TEXT,
                user_id INTEGER NOT NULL,
                expires_at TEXT NOT NULL,
                created_at TEXT NOT NULL,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
            """
        )
        user_columns = {row["name"] for row in conn.execute("PRAGMA table_info(users)").fetchall()}
        session_columns = {row["name"] for row in conn.execute("PRAGMA table_info(sessions)").fetchall()}
        if "property_customer_id" not in user_columns:
            conn.execute("ALTER TABLE users ADD COLUMN property_customer_id INTEGER")
        if "property_name" not in user_columns:
            conn.execute("ALTER TABLE users ADD COLUMN property_name TEXT")
        if "theme_enabled" not in user_columns:
            conn.execute("ALTER TABLE users ADD COLUMN theme_enabled INTEGER NOT NULL DEFAULT 0")
        if "microsoft_oid" not in user_columns:
            conn.execute("ALTER TABLE users ADD COLUMN microsoft_oid TEXT")
        if "microsoft_tenant_id" not in user_columns:
            conn.execute("ALTER TABLE users ADD COLUMN microsoft_tenant_id TEXT")

        if "token_hash" not in session_columns:
            conn.execute("ALTER TABLE sessions ADD COLUMN token_hash TEXT")

        conn.execute(
            """
            CREATE UNIQUE INDEX IF NOT EXISTS idx_sessions_token_hash
            ON sessions(token_hash)
            WHERE token_hash IS NOT NULL
            """
        )

        # Migrate any plaintext or legacy session token storage to hashed tokens.
        session_rows = conn.execute("SELECT rowid, token, token_hash FROM sessions").fetchall()
        for row in session_rows:
            token_value = str(row["token"] or "")
            token_hash = _hash_session_token(token_value)
            if row["token"] != token_hash or row["token_hash"] != token_hash:
                conn.execute(
                    "UPDATE sessions SET token = ?, token_hash = ? WHERE rowid = ?",
                    (token_hash, token_hash, row["rowid"]),
                )

        # Encrypt stored password hashes at rest when key is configured.
        if _get_fernet() is not None:
            password_rows = conn.execute("SELECT id, password_hash FROM users WHERE password_hash IS NOT NULL").fetchall()
            for row in password_rows:
                current_hash = row["password_hash"]
                encrypted_hash = _encrypt_optional(current_hash)
                if encrypted_hash != current_hash:
                    conn.execute("UPDATE users SET password_hash = ? WHERE id = ?", (encrypted_hash, row["id"]))

        conn.execute(
            """
            CREATE UNIQUE INDEX IF NOT EXISTS idx_users_microsoft_identity
            ON users(microsoft_tenant_id, microsoft_oid)
            WHERE microsoft_oid IS NOT NULL
            """
        )

        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS site_settings (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL
            )
            """
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS audit_log (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                actor_user_id INTEGER,
                action TEXT NOT NULL,
                target_user_id INTEGER,
                metadata_json TEXT,
                created_at TEXT NOT NULL,
                FOREIGN KEY (actor_user_id) REFERENCES users(id) ON DELETE SET NULL,
                FOREIGN KEY (target_user_id) REFERENCES users(id) ON DELETE SET NULL
            )
            """
        )
        # Default: signups enabled
        conn.execute(
            "INSERT OR IGNORE INTO site_settings(key, value) VALUES('signups_enabled', '1')"
        )
        conn.commit()


def _ticket_cache_row(ticket: Dict[str, Any], sync_marker: str) -> Optional[tuple]:
    ticket_id_raw = ticket.get("TicketID")
    try:
        ticket_id = int(ticket_id_raw)
    except (TypeError, ValueError):
        return None

    ticket_status = str(ticket.get("TicketStatus") or "").strip() or None
    customer_id_raw = ticket.get("CustomerID")
    try:
        customer_id = int(customer_id_raw) if customer_id_raw is not None else None
    except (TypeError, ValueError):
        customer_id = None

    customer_name = str(ticket.get("CustomerName") or "").strip() or None
    end_user_email = str(ticket.get("EndUserEmail") or "").strip().lower() or None
    ticket_title = str(ticket.get("TicketTitle") or "").strip() or None
    created_at = str(ticket.get("CreatedDate") or ticket.get("CreationDate") or ticket.get("CreatedAt") or "").strip() or None
    updated_at = str(ticket.get("LastUpdateDate") or ticket.get("LastActionDate") or ticket.get("UpdatedDate") or "").strip() or None
    raw_json = json.dumps(ticket, separators=(",", ":"), ensure_ascii=True)

    return (
        ticket_id,
        ticket_status,
        customer_id,
        customer_name,
        end_user_email,
        ticket_title,
        created_at,
        updated_at,
        raw_json,
        sync_marker,
    )


def replace_ticket_cache_snapshot(tickets: List[Dict[str, Any]]) -> int:
    sync_marker = _utc_now_iso()
    rows: List[tuple] = []
    for ticket in tickets:
        row = _ticket_cache_row(ticket, sync_marker)
        if row is not None:
            rows.append(row)

    with get_ticket_cache_conn() as conn:
        if rows:
            conn.executemany(
                """
                INSERT INTO ticket_cache(
                    ticket_id,
                    ticket_status,
                    customer_id,
                    customer_name,
                    end_user_email,
                    ticket_title,
                    created_at,
                    updated_at,
                    raw_json,
                    last_seen_sync_at
                )
                VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(ticket_id) DO UPDATE SET
                    ticket_status = excluded.ticket_status,
                    customer_id = excluded.customer_id,
                    customer_name = excluded.customer_name,
                    end_user_email = excluded.end_user_email,
                    ticket_title = excluded.ticket_title,
                    created_at = excluded.created_at,
                    updated_at = excluded.updated_at,
                    raw_json = excluded.raw_json,
                    last_seen_sync_at = excluded.last_seen_sync_at
                """,
                rows,
            )

        conn.execute(
            "DELETE FROM ticket_cache WHERE last_seen_sync_at <> ?",
            (sync_marker,),
        )
        conn.commit()

    return len(rows)


def list_cached_tickets(
    page: int,
    items_in_page: int,
    customer_id: Optional[int] = None,
    ticket_status: Optional[str] = None,
    end_user_email: Optional[str] = None,
) -> Dict[str, Any]:
    where_clauses: List[str] = []
    params: List[Any] = []

    if customer_id is not None:
        where_clauses.append("customer_id = ?")
        params.append(customer_id)
    if ticket_status:
        where_clauses.append("lower(ticket_status) = lower(?)")
        params.append(ticket_status)
    if end_user_email:
        where_clauses.append("lower(end_user_email) = lower(?)")
        params.append(end_user_email)

    where_sql = ""
    if where_clauses:
        where_sql = f" WHERE {' AND '.join(where_clauses)}"

    offset = (page - 1) * items_in_page

    with get_ticket_cache_conn() as conn:
        total_row = conn.execute(
            f"SELECT COUNT(*) AS total FROM ticket_cache{where_sql}",
            tuple(params),
        ).fetchone()
        total_count = int(total_row["total"]) if total_row else 0

        rows = conn.execute(
            f"""
            SELECT raw_json
            FROM ticket_cache
            {where_sql}
            ORDER BY ticket_id DESC
            LIMIT ? OFFSET ?
            """,
            tuple(params + [items_in_page, offset]),
        ).fetchall()

    items: List[Dict[str, Any]] = []
    for row in rows:
        raw = row["raw_json"]
        try:
            parsed = json.loads(raw)
            if isinstance(parsed, dict):
                items.append(parsed)
        except Exception:
            continue

    return {
        "items": items,
        "totalItemCount": total_count,
        "page": page,
        "itemsInPage": items_in_page,
    }


def get_user_by_email(email: str) -> Optional[Dict[str, Any]]:
    with get_conn() as conn:
        row = conn.execute("SELECT * FROM users WHERE lower(email) = lower(?)", (email,)).fetchone()
    return _decode_user_row(row) if row else None


def get_user_by_id(user_id: int) -> Optional[Dict[str, Any]]:
    with get_conn() as conn:
        row = conn.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
    return _decode_user_row(row) if row else None


def get_user_by_microsoft_identity(microsoft_oid: str, microsoft_tenant_id: Optional[str]) -> Optional[Dict[str, Any]]:
    with get_conn() as conn:
        if microsoft_tenant_id:
            row = conn.execute(
                "SELECT * FROM users WHERE microsoft_oid = ? AND microsoft_tenant_id = ?",
                (microsoft_oid, microsoft_tenant_id),
            ).fetchone()
        else:
            row = conn.execute(
                "SELECT * FROM users WHERE microsoft_oid = ?",
                (microsoft_oid,),
            ).fetchone()
    return _decode_user_row(row) if row else None


def create_user(
    email: str,
    role: str,
    password_hash: Optional[str],
    approved: bool,
    microsoft_oid: Optional[str] = None,
    microsoft_tenant_id: Optional[str] = None,
) -> Dict[str, Any]:
    now = _utc_now_iso()
    approved_at = now if approved else None
    with get_conn() as conn:
        cur = conn.execute(
            """
            INSERT INTO users(
                email,
                role,
                password_hash,
                approved,
                is_active,
                created_at,
                approved_at,
                microsoft_oid,
                microsoft_tenant_id
            )
            VALUES(?, ?, ?, ?, 1, ?, ?, ?, ?)
            """,
            (
                email.lower(),
                role,
                _encrypt_optional(password_hash),
                1 if approved else 0,
                now,
                approved_at,
                microsoft_oid,
                microsoft_tenant_id,
            ),
        )
        conn.commit()
        user_id = cur.lastrowid
    user = get_user_by_id(int(user_id))
    if not user:
        raise RuntimeError("Failed to create user")
    return user


def link_user_microsoft_account(user_id: int, microsoft_oid: str, microsoft_tenant_id: Optional[str]) -> bool:
    with get_conn() as conn:
        cur = conn.execute(
            "UPDATE users SET microsoft_oid = ?, microsoft_tenant_id = ? WHERE id = ?",
            (microsoft_oid, microsoft_tenant_id, user_id),
        )
        conn.commit()
    return cur.rowcount > 0


def list_users(pending_only: bool) -> List[Dict[str, Any]]:
    query = "SELECT * FROM users"
    params: tuple = ()
    if pending_only:
        query += " WHERE approved = 0"
    query += " ORDER BY created_at DESC"

    with get_conn() as conn:
        rows = conn.execute(query, params).fetchall()
    return [_decode_user_row(row) for row in rows]


def approve_user(user_id: int) -> bool:
    now = _utc_now_iso()
    with get_conn() as conn:
        cur = conn.execute(
            "UPDATE users SET approved = 1, approved_at = ? WHERE id = ?",
            (now, user_id),
        )
        conn.commit()
    return cur.rowcount > 0


def update_user_role(user_id: int, role: str) -> bool:
    with get_conn() as conn:
        cur = conn.execute("UPDATE users SET role = ? WHERE id = ?", (role, user_id))
        conn.commit()
    return cur.rowcount > 0


def reset_user_password(user_id: int, password_hash: str) -> bool:
    with get_conn() as conn:
        cur = conn.execute(
            "UPDATE users SET password_hash = ?, approved = 1 WHERE id = ?",
            (_encrypt_optional(password_hash), user_id),
        )
        if cur.rowcount > 0:
            conn.execute("DELETE FROM sessions WHERE user_id = ?", (user_id,))
        conn.commit()
    return cur.rowcount > 0


def delete_user(user_id: int) -> bool:
    with get_conn() as conn:
        conn.execute("DELETE FROM sessions WHERE user_id = ?", (user_id,))
        cur = conn.execute("DELETE FROM users WHERE id = ?", (user_id,))
        conn.commit()
    return cur.rowcount > 0


def assign_user_property(user_id: int, property_customer_id: Optional[int], property_name: Optional[str]) -> bool:
    with get_conn() as conn:
        cur = conn.execute(
            "UPDATE users SET property_customer_id = ?, property_name = ? WHERE id = ?",
            (property_customer_id, property_name, user_id),
        )
        conn.commit()
    return cur.rowcount > 0


def get_site_setting(key: str, default: str = "") -> str:
    with get_conn() as conn:
        row = conn.execute("SELECT value FROM site_settings WHERE key = ?", (key,)).fetchone()
    return row["value"] if row else default


def set_site_setting(key: str, value: str) -> None:
    with get_conn() as conn:
        conn.execute(
            "INSERT OR REPLACE INTO site_settings(key, value) VALUES(?, ?)",
            (key, value),
        )
        conn.commit()


def get_signups_enabled() -> bool:
    return get_site_setting("signups_enabled", "1") == "1"


def set_signups_enabled(enabled: bool) -> None:
    set_site_setting("signups_enabled", "1" if enabled else "0")


def set_user_theme_enabled(user_id: int, enabled: bool) -> bool:
    with get_conn() as conn:
        cur = conn.execute(
            "UPDATE users SET theme_enabled = ? WHERE id = ?",
            (1 if enabled else 0, user_id),
        )
        conn.commit()
    return cur.rowcount > 0


def get_user_theme_enabled(user_id: int) -> bool:
    with get_conn() as conn:
        row = conn.execute("SELECT theme_enabled FROM users WHERE id = ?", (user_id,)).fetchone()
    return bool(row["theme_enabled"]) if row else False


def create_session(user_id: int, token: str) -> Dict[str, Any]:
    now = datetime.now(timezone.utc)
    expires = now + timedelta(hours=settings.session_hours)
    token_hash = _hash_session_token(token)
    with get_conn() as conn:
        conn.execute("DELETE FROM sessions WHERE user_id = ?", (user_id,))
        conn.execute(
            "INSERT INTO sessions(token, token_hash, user_id, expires_at, created_at) VALUES(?, ?, ?, ?, ?)",
            (token_hash, token_hash, user_id, expires.isoformat(), now.isoformat()),
        )
        conn.commit()

    return {
        "token": token,
        "user_id": user_id,
        "expires_at": expires.isoformat(),
    }


def get_session(token: str) -> Optional[Dict[str, Any]]:
    token_hash = _hash_session_token(token)
    with get_conn() as conn:
        row = conn.execute(
            "SELECT * FROM sessions WHERE token_hash = ? OR token = ?",
            (token_hash, token_hash),
        ).fetchone()
    if not row:
        return None

    session = dict(row)
    expires = datetime.fromisoformat(session["expires_at"])
    if expires <= datetime.now(timezone.utc):
        delete_session(token)
        return None
    return session


def delete_session(token: str) -> None:
    token_hash = _hash_session_token(token)
    with get_conn() as conn:
        conn.execute("DELETE FROM sessions WHERE token_hash = ? OR token = ?", (token_hash, token_hash))
        conn.commit()


def seed_admin(email: str, password_hash: str) -> None:
    existing = get_user_by_email(email)
    if existing:
        return
    create_user(email=email, role="admin", password_hash=password_hash, approved=True)


def log_audit_event(
    actor_user_id: Optional[int],
    action: str,
    target_user_id: Optional[int] = None,
    metadata_json: Optional[str] = None,
) -> None:
    with get_conn() as conn:
        conn.execute(
            """
            INSERT INTO audit_log(actor_user_id, action, target_user_id, metadata_json, created_at)
            VALUES(?, ?, ?, ?, ?)
            """,
            (actor_user_id, action, target_user_id, metadata_json, _utc_now_iso()),
        )
        conn.commit()
