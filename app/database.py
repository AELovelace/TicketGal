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


def _parse_utc_datetime(value: str) -> datetime:
    parsed = datetime.fromisoformat(value)
    if parsed.tzinfo is None:
        return parsed.replace(tzinfo=timezone.utc)
    return parsed.astimezone(timezone.utc)


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


@contextmanager
def get_transactions_conn() -> Generator[sqlite3.Connection, None, None]:
    conn = sqlite3.connect(settings.transactions_db_path)
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
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS ticket_status_history (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                ticket_id INTEGER NOT NULL,
                old_status TEXT,
                new_status TEXT NOT NULL,
                changed_by_user_id INTEGER,
                changed_at TEXT NOT NULL
            )
            """
        )
        conn.execute(
            """
            CREATE INDEX IF NOT EXISTS idx_status_history_ticket
            ON ticket_status_history(ticket_id, changed_at)
            """
        )
        conn.execute(
            """
            CREATE INDEX IF NOT EXISTS idx_status_history_new_status
            ON ticket_status_history(new_status, changed_at)
            """
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS ticket_comment_cache (
                ticket_id INTEGER NOT NULL,
                comment_key TEXT NOT NULL,
                comment_date TEXT,
                raw_json TEXT NOT NULL,
                last_seen_sync_at TEXT NOT NULL,
                PRIMARY KEY (ticket_id, comment_key)
            )
            """
        )
        conn.execute(
            """
            CREATE INDEX IF NOT EXISTS idx_ticket_comment_cache_ticket
            ON ticket_comment_cache(ticket_id, comment_date)
            """
        )
        conn.commit()


def _create_transactions_schema() -> None:
    with get_transactions_conn() as conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS transaction_queue (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                operation_type TEXT NOT NULL,
                ticket_id INTEGER,
                payload_json TEXT NOT NULL,
                requested_by_user_id INTEGER,
                attempts INTEGER NOT NULL DEFAULT 0,
                max_attempts INTEGER NOT NULL DEFAULT 20,
                status TEXT NOT NULL CHECK(status IN ('pending','in_progress','retry','failed','completed')),
                next_attempt_ts REAL,
                last_error TEXT,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                completed_at TEXT,
                result_json TEXT
            )
            """
        )
        conn.execute(
            """
            CREATE INDEX IF NOT EXISTS idx_transaction_queue_due
            ON transaction_queue(status, next_attempt_ts, id)
            """
        )
        conn.execute(
            """
            CREATE INDEX IF NOT EXISTS idx_transaction_queue_ticket
            ON transaction_queue(ticket_id)
            """
        )
        conn.commit()


def _recover_in_progress_transactions() -> None:
    now_iso = _utc_now_iso()
    now_ts = datetime.now(timezone.utc).timestamp()
    with get_transactions_conn() as conn:
        conn.execute(
            """
            UPDATE transaction_queue
            SET status = 'retry', next_attempt_ts = ?, updated_at = ?
            WHERE status = 'in_progress'
            """,
            (now_ts, now_iso),
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


def _backfill_status_history() -> None:
    """Backfill synthetic history rows for tickets that have no history entry yet.
    Uses updated_at (LastEndUserCommentTimestamp) as the proxy timestamp for all tickets.
    For Closed/Resolved tickets this reflects the last real activity date.
    The NOT EXISTS guard makes this a no-op for already-seeded tickets."""
    with get_ticket_cache_conn() as conn:
        # Repair older synthetic rows that used last_seen_sync_at as changed_at.
        # Prefer real ticket dates so period reports reflect historical activity.
        conn.execute(
            """
            UPDATE ticket_status_history
            SET changed_at = (
                SELECT COALESCE(tc.updated_at, tc.created_at)
                FROM ticket_cache tc
                WHERE tc.ticket_id = ticket_status_history.ticket_id
            )
            WHERE old_status IS NULL
              AND changed_by_user_id IS NULL
              AND (
                  changed_at IS NULL
                  OR changed_at = ''
                  OR changed_at = (
                      SELECT tc.last_seen_sync_at
                      FROM ticket_cache tc
                      WHERE tc.ticket_id = ticket_status_history.ticket_id
                  )
              )
              AND EXISTS (
                  SELECT 1
                  FROM ticket_cache tc
                  WHERE tc.ticket_id = ticket_status_history.ticket_id
                    AND COALESCE(tc.updated_at, tc.created_at) IS NOT NULL
              )
            """
        )

        conn.execute(
            """
            INSERT INTO ticket_status_history(
                ticket_id, old_status, new_status, changed_by_user_id, changed_at
            )
            SELECT
                tc.ticket_id,
                NULL,
                tc.ticket_status,
                NULL,
                                COALESCE(tc.updated_at, tc.created_at)
            FROM ticket_cache tc
            WHERE tc.ticket_status IS NOT NULL
                            AND COALESCE(tc.updated_at, tc.created_at) IS NOT NULL
              AND NOT EXISTS (
                  SELECT 1 FROM ticket_status_history h
                  WHERE h.ticket_id = tc.ticket_id
              )
            """
        )
        conn.commit()


def _backfill_ticket_cache_dates() -> None:
    """Populate missing created_at/updated_at in ticket_cache from raw_json.

    This repairs legacy rows written before TicketCreatedDate /
    LastEndUserCommentTimestamp mapping was added, so period reports can use
    historical first-opened and last-activity timestamps.
    """
    with get_ticket_cache_conn() as conn:
        rows = conn.execute(
            """
            SELECT ticket_id, raw_json, created_at, updated_at
            FROM ticket_cache
            WHERE created_at IS NULL OR created_at = '' OR updated_at IS NULL OR updated_at = ''
            """
        ).fetchall()

        updates: List[tuple] = []
        for row in rows:
            try:
                payload = json.loads(row["raw_json"] or "{}")
            except Exception:
                continue
            if not isinstance(payload, dict):
                continue

            created = str(
                payload.get("TicketCreatedDate")
                or payload.get("CreatedDate")
                or payload.get("CreationDate")
                or payload.get("CreatedAt")
                or ""
            ).strip() or None

            updated = str(
                payload.get("LastEndUserCommentTimestamp")
                or payload.get("LastUpdateDate")
                or payload.get("LastActionDate")
                or payload.get("UpdatedDate")
                or ""
            ).strip() or None

            current_created = str(row["created_at"] or "").strip() or None
            current_updated = str(row["updated_at"] or "").strip() or None

            next_created = current_created or created
            next_updated = current_updated or updated

            if next_created != current_created or next_updated != current_updated:
                updates.append((next_created, next_updated, int(row["ticket_id"])))

        if updates:
            conn.executemany(
                """
                UPDATE ticket_cache
                SET created_at = ?, updated_at = ?
                WHERE ticket_id = ?
                """,
                updates,
            )
            conn.commit()


def init_db() -> None:
    _create_ticket_cache_schema()
    _backfill_ticket_cache_dates()
    _backfill_status_history()
    _create_transactions_schema()
    _recover_in_progress_transactions()
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
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS login_rate_limits (
                key_type TEXT NOT NULL CHECK(key_type IN ('email','ip')),
                key_value TEXT NOT NULL,
                failure_count INTEGER NOT NULL DEFAULT 0,
                window_started_at TEXT NOT NULL,
                last_failed_at TEXT NOT NULL,
                locked_until TEXT,
                PRIMARY KEY (key_type, key_value)
            )
            """
        )
        conn.execute(
            """
            CREATE INDEX IF NOT EXISTS idx_login_rate_limits_locked
            ON login_rate_limits(locked_until)
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
    created_at = str(ticket.get("TicketCreatedDate") or ticket.get("CreatedDate") or ticket.get("CreationDate") or ticket.get("CreatedAt") or "").strip() or None
    updated_at = str(ticket.get("LastEndUserCommentTimestamp") or ticket.get("LastUpdateDate") or ticket.get("LastActionDate") or ticket.get("UpdatedDate") or "").strip() or None
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
            ticket_ids = [row[0] for row in rows]
            placeholders = ",".join(["?"] * len(ticket_ids))
            existing_rows = conn.execute(
                f"SELECT ticket_id, ticket_status FROM ticket_cache WHERE ticket_id IN ({placeholders})",
                tuple(ticket_ids),
            ).fetchall()
            old_status_map = {int(r["ticket_id"]): r["ticket_status"] for r in existing_rows}

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

            history_rows: List[tuple] = []
            for row in rows:
                tid, new_status = int(row[0]), row[1]
                old_status = old_status_map.get(tid)
                if new_status and new_status != old_status:
                    changed_at = row[7] or sync_marker
                    history_rows.append((tid, old_status, new_status, None, changed_at))

            if history_rows:
                conn.executemany(
                    """
                    INSERT INTO ticket_status_history(
                        ticket_id, old_status, new_status, changed_by_user_id, changed_at
                    )
                    VALUES(?, ?, ?, ?, ?)
                    """,
                    history_rows,
                )

        conn.execute(
            "DELETE FROM ticket_cache WHERE last_seen_sync_at <> ?",
            (sync_marker,),
        )
        conn.commit()

    return len(rows)


def upsert_cached_ticket(ticket: Dict[str, Any], changed_by_user_id: Optional[int] = None) -> bool:
    row = _ticket_cache_row(ticket, _utc_now_iso())
    if row is None:
        return False

    ticket_id = row[0]
    new_status = row[1]

    with get_ticket_cache_conn() as conn:
        existing = conn.execute(
            "SELECT ticket_status FROM ticket_cache WHERE ticket_id = ?", (ticket_id,)
        ).fetchone()
        old_status = existing["ticket_status"] if existing else None

        conn.execute(
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
            row,
        )

        if new_status and new_status != old_status:
            changed_at = row[7] or _utc_now_iso()
            conn.execute(
                """
                INSERT INTO ticket_status_history(
                    ticket_id, old_status, new_status, changed_by_user_id, changed_at
                )
                VALUES(?, ?, ?, ?, ?)
                """,
                (ticket_id, old_status, new_status, changed_by_user_id, changed_at),
            )

        conn.commit()

    return True


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


def get_cached_ticket_by_id(ticket_id: int) -> Optional[Dict[str, Any]]:
    with get_ticket_cache_conn() as conn:
        row = conn.execute(
            "SELECT raw_json FROM ticket_cache WHERE ticket_id = ?",
            (ticket_id,),
        ).fetchone()

    if not row:
        return None

    try:
        payload = json.loads(row["raw_json"])
    except Exception:
        return None
    return payload if isinstance(payload, dict) else None


def _comment_cache_key(ticket_id: int, comment: Dict[str, Any]) -> str:
    comment_id = str(comment.get("TicketCommentID") or comment.get("CommentID") or "").strip()
    if comment_id:
        return f"id:{comment_id}"

    date = str(comment.get("Date") or "").strip()
    author = str(comment.get("FirstName") or comment.get("Email") or "").strip().lower()
    body = str(comment.get("Comment") or "").strip()
    digest = hashlib.sha256(f"{ticket_id}|{date}|{author}|{body}".encode("utf-8")).hexdigest()
    return f"sha:{digest}"


def replace_cached_ticket_comments(ticket_id: int, comments: List[Dict[str, Any]]) -> int:
    tid = int(ticket_id)
    sync_marker = _utc_now_iso()
    rows: List[tuple] = []

    for comment in comments:
        if not isinstance(comment, dict):
            continue
        key = _comment_cache_key(tid, comment)
        comment_date = str(comment.get("Date") or "").strip() or None
        raw_json = json.dumps(comment, separators=(",", ":"), ensure_ascii=True)
        rows.append((tid, key, comment_date, raw_json, sync_marker))

    with get_ticket_cache_conn() as conn:
        if rows:
            conn.executemany(
                """
                INSERT INTO ticket_comment_cache(
                    ticket_id,
                    comment_key,
                    comment_date,
                    raw_json,
                    last_seen_sync_at
                )
                VALUES(?, ?, ?, ?, ?)
                ON CONFLICT(ticket_id, comment_key) DO UPDATE SET
                    comment_date = excluded.comment_date,
                    raw_json = excluded.raw_json,
                    last_seen_sync_at = excluded.last_seen_sync_at
                """,
                rows,
            )

        conn.execute(
            """
            DELETE FROM ticket_comment_cache
            WHERE ticket_id = ?
              AND last_seen_sync_at <> ?
            """,
            (tid, sync_marker),
        )
        conn.commit()

    return len(rows)


def list_cached_ticket_comments(ticket_id: int, limit: int = 500) -> List[Dict[str, Any]]:
    tid = int(ticket_id)
    with get_ticket_cache_conn() as conn:
        rows = conn.execute(
            """
            SELECT raw_json
            FROM ticket_comment_cache
            WHERE ticket_id = ?
            ORDER BY COALESCE(comment_date, ''), comment_key
            LIMIT ?
            """,
            (tid, max(1, int(limit))),
        ).fetchall()

    comments: List[Dict[str, Any]] = []
    for row in rows:
        try:
            parsed = json.loads(row["raw_json"])
        except Exception:
            continue
        if isinstance(parsed, dict):
            comments.append(parsed)
    return comments


def get_ticket_cache_last_sync_at() -> Optional[str]:
    with get_ticket_cache_conn() as conn:
        row = conn.execute(
            "SELECT MAX(last_seen_sync_at) AS last_sync FROM ticket_cache"
        ).fetchone()

    if not row:
        return None
    return str(row["last_sync"]).strip() or None


def enqueue_transaction(
    operation_type: str,
    payload: Dict[str, Any],
    ticket_id: Optional[int] = None,
    requested_by_user_id: Optional[int] = None,
    max_attempts: int = 20,
) -> Dict[str, Any]:
    now_iso = _utc_now_iso()
    now_ts = datetime.now(timezone.utc).timestamp()
    payload_json = json.dumps(payload, separators=(",", ":"), ensure_ascii=True)

    with get_transactions_conn() as conn:
        cur = conn.execute(
            """
            INSERT INTO transaction_queue(
                operation_type,
                ticket_id,
                payload_json,
                requested_by_user_id,
                attempts,
                max_attempts,
                status,
                next_attempt_ts,
                created_at,
                updated_at
            )
            VALUES(?, ?, ?, ?, 0, ?, 'pending', ?, ?, ?)
            """,
            (
                operation_type,
                ticket_id,
                payload_json,
                requested_by_user_id,
                max(1, int(max_attempts)),
                now_ts,
                now_iso,
                now_iso,
            ),
        )
        conn.commit()
        tx_id = int(cur.lastrowid)

    return {
        "id": tx_id,
        "status": "pending",
        "operation_type": operation_type,
        "ticket_id": ticket_id,
    }


def claim_due_transactions(limit: int = 25) -> List[Dict[str, Any]]:
    now_iso = _utc_now_iso()
    now_ts = datetime.now(timezone.utc).timestamp()

    with get_transactions_conn() as conn:
        rows = conn.execute(
            """
            SELECT *
            FROM transaction_queue
            WHERE status IN ('pending', 'retry')
              AND (next_attempt_ts IS NULL OR next_attempt_ts <= ?)
            ORDER BY id ASC
            LIMIT ?
            """,
            (now_ts, max(1, int(limit))),
        ).fetchall()

        if not rows:
            return []

        ids = [int(row["id"]) for row in rows]
        placeholders = ",".join(["?"] * len(ids))
        conn.execute(
            f"UPDATE transaction_queue SET status = 'in_progress', updated_at = ? WHERE id IN ({placeholders})",
            (now_iso, *ids),
        )
        conn.commit()

        claimed = conn.execute(
            f"SELECT * FROM transaction_queue WHERE id IN ({placeholders}) ORDER BY id ASC",
            tuple(ids),
        ).fetchall()

    return [dict(row) for row in claimed]


def mark_transaction_completed(tx_id: int, result: Optional[Dict[str, Any]] = None) -> None:
    now_iso = _utc_now_iso()
    result_json = json.dumps(result, separators=(",", ":"), ensure_ascii=True) if result is not None else None
    with get_transactions_conn() as conn:
        conn.execute(
            """
            UPDATE transaction_queue
            SET status = 'completed',
                completed_at = ?,
                updated_at = ?,
                result_json = ?,
                last_error = NULL,
                next_attempt_ts = NULL
            WHERE id = ?
            """,
            (now_iso, now_iso, result_json, tx_id),
        )
        conn.commit()


def mark_transaction_retry(tx_id: int, error_message: str, retry_after_seconds: int) -> Dict[str, Any]:
    now_iso = _utc_now_iso()
    now_ts = datetime.now(timezone.utc).timestamp()
    delay = max(1, int(retry_after_seconds))

    with get_transactions_conn() as conn:
        row = conn.execute(
            "SELECT attempts, max_attempts FROM transaction_queue WHERE id = ?",
            (tx_id,),
        ).fetchone()
        if not row:
            return {"status": "missing", "attempts": 0, "max_attempts": 0}

        attempts = int(row["attempts"]) + 1
        max_attempts = int(row["max_attempts"])
        exhausted = attempts >= max_attempts

        conn.execute(
            """
            UPDATE transaction_queue
            SET attempts = ?,
                status = ?,
                next_attempt_ts = ?,
                last_error = ?,
                updated_at = ?
            WHERE id = ?
            """,
            (
                attempts,
                "failed" if exhausted else "retry",
                None if exhausted else now_ts + delay,
                (error_message or "")[:1500],
                now_iso,
                tx_id,
            ),
        )
        conn.commit()

    return {
        "status": "failed" if exhausted else "retry",
        "attempts": attempts,
        "max_attempts": max_attempts,
    }


def get_transaction_queue_summary() -> Dict[str, Any]:
    with get_transactions_conn() as conn:
        counts_rows = conn.execute(
            """
            SELECT status, COUNT(*) AS cnt
            FROM transaction_queue
            GROUP BY status
            """
        ).fetchall()
        now_ts = datetime.now(timezone.utc).timestamp()
        due_row = conn.execute(
            """
            SELECT COUNT(*) AS cnt
            FROM transaction_queue
            WHERE status IN ('pending', 'retry')
              AND (next_attempt_ts IS NULL OR next_attempt_ts <= ?)
            """,
            (now_ts,),
        ).fetchone()

    counts: Dict[str, int] = {
        "pending": 0,
        "in_progress": 0,
        "retry": 0,
        "failed": 0,
        "completed": 0,
    }
    for row in counts_rows:
        counts[str(row["status"])] = int(row["cnt"] or 0)

    return {
        "counts": counts,
        "due_now": int(due_row["cnt"] or 0) if due_row else 0,
    }


def list_recent_transactions(limit: int = 20) -> List[Dict[str, Any]]:
    with get_transactions_conn() as conn:
        rows = conn.execute(
            """
            SELECT id, operation_type, ticket_id, attempts, max_attempts, status,
                   next_attempt_ts, last_error, created_at, updated_at, completed_at
            FROM transaction_queue
            ORDER BY id DESC
            LIMIT ?
            """,
            (max(1, int(limit)),),
        ).fetchall()
    return [dict(row) for row in rows]


def list_pending_queue_creates(requested_by_user_id: Optional[int] = None) -> List[Dict[str, Any]]:
    """Return pending/retry create_ticket queue items, optionally filtered by requesting user."""
    with get_transactions_conn() as conn:
        if requested_by_user_id is not None:
            rows = conn.execute(
                """
                SELECT id, operation_type, ticket_id, payload_json, requested_by_user_id,
                       attempts, status, created_at, updated_at
                FROM transaction_queue
                WHERE operation_type = 'create_ticket'
                  AND status IN ('pending', 'retry', 'in_progress')
                  AND requested_by_user_id = ?
                ORDER BY id ASC
                """,
                (int(requested_by_user_id),),
            ).fetchall()
        else:
            rows = conn.execute(
                """
                SELECT id, operation_type, ticket_id, payload_json, requested_by_user_id,
                       attempts, status, created_at, updated_at
                FROM transaction_queue
                WHERE operation_type = 'create_ticket'
                  AND status IN ('pending', 'retry', 'in_progress')
                ORDER BY id ASC
                """,
            ).fetchall()
    return [dict(row) for row in rows]


def list_pending_queue_items_for_ticket(ticket_id: int) -> List[Dict[str, Any]]:
    """Return all pending/retry queue items for a specific ticket (status changes, comments)."""
    with get_transactions_conn() as conn:
        rows = conn.execute(
            """
            SELECT id, operation_type, ticket_id, payload_json, requested_by_user_id,
                   attempts, status, created_at, updated_at
            FROM transaction_queue
            WHERE ticket_id = ?
              AND status IN ('pending', 'retry', 'in_progress')
            ORDER BY id ASC
            """,
            (int(ticket_id),),
        ).fetchall()
    return [dict(row) for row in rows]


def get_pending_queue_create(tx_id: int) -> Optional[Dict[str, Any]]:
    with get_transactions_conn() as conn:
        row = conn.execute(
            """
            SELECT id, operation_type, ticket_id, payload_json, requested_by_user_id,
                   attempts, status, created_at, updated_at
            FROM transaction_queue
            WHERE id = ?
              AND operation_type = 'create_ticket'
              AND status IN ('pending', 'retry', 'in_progress')
            """,
            (int(tx_id),),
        ).fetchone()
    return dict(row) if row else None


def update_pending_queue_create_payload(tx_id: int, payload: Dict[str, Any]) -> bool:
    now_iso = _utc_now_iso()
    payload_json = json.dumps(payload, separators=(",", ":"), ensure_ascii=True)
    with get_transactions_conn() as conn:
        cur = conn.execute(
            """
            UPDATE transaction_queue
            SET payload_json = ?, updated_at = ?
            WHERE id = ?
              AND operation_type = 'create_ticket'
              AND status IN ('pending', 'retry', 'in_progress')
            """,
            (payload_json, now_iso, int(tx_id)),
        )
        conn.commit()
    return int(cur.rowcount or 0) > 0


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


def get_login_lockout_until(email: str, ip_address: str) -> Optional[str]:
    now = datetime.now(timezone.utc)
    keys = (
        ("email", (email or "").strip().lower()),
        ("ip", (ip_address or "").strip()),
    )
    max_lockout: Optional[datetime] = None

    with get_conn() as conn:
        for key_type, key_value in keys:
            if not key_value:
                continue

            row = conn.execute(
                """
                SELECT failure_count, window_started_at, locked_until
                FROM login_rate_limits
                WHERE key_type = ? AND key_value = ?
                """,
                (key_type, key_value),
            ).fetchone()
            if not row:
                continue

            locked_until_value = row["locked_until"]
            if locked_until_value:
                locked_until_dt = _parse_utc_datetime(str(locked_until_value))
                if locked_until_dt > now:
                    if max_lockout is None or locked_until_dt > max_lockout:
                        max_lockout = locked_until_dt
                    continue

            window_started_at = _parse_utc_datetime(str(row["window_started_at"]))
            window_delta = now - window_started_at
            if window_delta > timedelta(minutes=settings.login_rate_limit_window_minutes):
                conn.execute(
                    "DELETE FROM login_rate_limits WHERE key_type = ? AND key_value = ?",
                    (key_type, key_value),
                )
        conn.commit()

    return max_lockout.isoformat() if max_lockout else None


def record_login_failure(email: str, ip_address: str) -> Optional[str]:
    now = datetime.now(timezone.utc)
    now_iso = now.isoformat()
    lockout_until: Optional[datetime] = None
    scope_limits = (
        ("email", (email or "").strip().lower(), settings.login_max_attempts_per_email),
        ("ip", (ip_address or "").strip(), settings.login_max_attempts_per_ip),
    )

    with get_conn() as conn:
        for key_type, key_value, max_attempts in scope_limits:
            if not key_value:
                continue

            row = conn.execute(
                """
                SELECT failure_count, window_started_at
                FROM login_rate_limits
                WHERE key_type = ? AND key_value = ?
                """,
                (key_type, key_value),
            ).fetchone()

            failure_count = 1
            window_started_at = now
            if row:
                prior_window = _parse_utc_datetime(str(row["window_started_at"]))
                if now - prior_window <= timedelta(minutes=settings.login_rate_limit_window_minutes):
                    failure_count = int(row["failure_count"] or 0) + 1
                    window_started_at = prior_window

            next_locked_until: Optional[str] = None
            if failure_count >= int(max_attempts):
                locked_dt = now + timedelta(minutes=settings.login_lockout_minutes)
                next_locked_until = locked_dt.isoformat()
                if lockout_until is None or locked_dt > lockout_until:
                    lockout_until = locked_dt

            conn.execute(
                """
                INSERT INTO login_rate_limits(
                    key_type,
                    key_value,
                    failure_count,
                    window_started_at,
                    last_failed_at,
                    locked_until
                )
                VALUES(?, ?, ?, ?, ?, ?)
                ON CONFLICT(key_type, key_value) DO UPDATE SET
                    failure_count = excluded.failure_count,
                    window_started_at = excluded.window_started_at,
                    last_failed_at = excluded.last_failed_at,
                    locked_until = excluded.locked_until
                """,
                (
                    key_type,
                    key_value,
                    failure_count,
                    window_started_at.isoformat(),
                    now_iso,
                    next_locked_until,
                ),
            )
        conn.commit()

    return lockout_until.isoformat() if lockout_until else None


def clear_login_rate_limits(email: str, ip_address: str) -> None:
    keys = (
        ("email", (email or "").strip().lower()),
        ("ip", (ip_address or "").strip()),
    )
    with get_conn() as conn:
        for key_type, key_value in keys:
            if not key_value:
                continue
            conn.execute(
                "DELETE FROM login_rate_limits WHERE key_type = ? AND key_value = ?",
                (key_type, key_value),
            )
        conn.commit()


def clear_login_rate_limit_entry(key_type: str, key_value: str) -> bool:
    normalized_type = (key_type or "").strip().lower()
    normalized_value = (key_value or "").strip()
    if normalized_type not in {"email", "ip"}:
        return False
    if not normalized_value:
        return False
    if normalized_type == "email":
        normalized_value = normalized_value.lower()

    with get_conn() as conn:
        cur = conn.execute(
            "DELETE FROM login_rate_limits WHERE key_type = ? AND key_value = ?",
            (normalized_type, normalized_value),
        )
        conn.commit()
    return int(cur.rowcount or 0) > 0


def get_login_rate_limits_snapshot(limit: int = 100) -> Dict[str, Any]:
    now = datetime.now(timezone.utc)
    now_iso = now.isoformat()
    safe_limit = max(1, min(int(limit), 500))
    recent_window = timedelta(minutes=settings.login_rate_limit_window_minutes)

    active_lockouts: List[Dict[str, Any]] = []
    recent_failed_attempts: List[Dict[str, Any]] = []

    with get_conn() as conn:
        active_rows = conn.execute(
            """
            SELECT key_type, key_value, failure_count, window_started_at, last_failed_at, locked_until
            FROM login_rate_limits
            WHERE locked_until IS NOT NULL AND locked_until > ?
            ORDER BY locked_until DESC
            """,
            (now_iso,),
        ).fetchall()

        recent_rows = conn.execute(
            """
            SELECT key_type, key_value, failure_count, window_started_at, last_failed_at, locked_until
            FROM login_rate_limits
            ORDER BY last_failed_at DESC
            LIMIT ?
            """,
            (safe_limit,),
        ).fetchall()

    for row in active_rows:
        locked_until_raw = str(row["locked_until"] or "").strip()
        if not locked_until_raw:
            continue
        try:
            locked_until_dt = _parse_utc_datetime(locked_until_raw)
        except Exception:
            continue
        seconds_remaining = int(max(0, (locked_until_dt - now).total_seconds()))
        active_lockouts.append(
            {
                "key_type": str(row["key_type"] or ""),
                "key_value": str(row["key_value"] or ""),
                "failure_count": int(row["failure_count"] or 0),
                "window_started_at": str(row["window_started_at"] or ""),
                "last_failed_at": str(row["last_failed_at"] or ""),
                "locked_until": locked_until_dt.isoformat(),
                "seconds_until_unlock": seconds_remaining,
            }
        )

    for row in recent_rows:
        last_failed_raw = str(row["last_failed_at"] or "").strip()
        if not last_failed_raw:
            continue
        try:
            last_failed_dt = _parse_utc_datetime(last_failed_raw)
        except Exception:
            continue

        locked_until_raw = str(row["locked_until"] or "").strip()
        locked_until_dt: Optional[datetime] = None
        if locked_until_raw:
            try:
                locked_until_dt = _parse_utc_datetime(locked_until_raw)
            except Exception:
                locked_until_dt = None

        still_locked = bool(locked_until_dt and locked_until_dt > now)
        recent_enough = (now - last_failed_dt) <= recent_window
        if not still_locked and not recent_enough:
            continue

        recent_failed_attempts.append(
            {
                "key_type": str(row["key_type"] or ""),
                "key_value": str(row["key_value"] or ""),
                "failure_count": int(row["failure_count"] or 0),
                "window_started_at": str(row["window_started_at"] or ""),
                "last_failed_at": last_failed_dt.isoformat(),
                "locked_until": locked_until_dt.isoformat() if locked_until_dt else None,
                "is_locked": still_locked,
            }
        )

    return {
        "window_minutes": settings.login_rate_limit_window_minutes,
        "lockout_minutes": settings.login_lockout_minutes,
        "max_attempts_per_email": settings.login_max_attempts_per_email,
        "max_attempts_per_ip": settings.login_max_attempts_per_ip,
        "active_lockouts": active_lockouts,
        "recent_failed_attempts": recent_failed_attempts,
    }


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


def get_ticket_report_stats(period_start: str, period_end: Optional[str] = None) -> Dict[str, Any]:
    """Return ticket counts and per-customer breakdowns for the requested period."""
    import sys
    with get_ticket_cache_conn() as conn:
        opened_where = "created_at >= ?"
        opened_params: tuple = (period_start,)
        resolved_where = "new_status IN ('Closed', 'Resolved') AND changed_at >= ?"
        resolved_params: tuple = (period_start,)
        if period_end:
            opened_where += " AND created_at < ?"
            opened_params = (period_start, period_end)
            resolved_where += " AND changed_at < ?"
            resolved_params = (period_start, period_end)

        # DEBUG: Log parameters and check database state
        print(f"[REPORT DEBUG] period_start={period_start}, period_end={period_end}", file=sys.stderr)
        
        # Check sample data from database
        sample_created = conn.execute("SELECT MIN(created_at) as min_created, MAX(created_at) as max_created FROM ticket_cache").fetchone()
        print(f"[REPORT DEBUG] ticket_cache created_at range: {sample_created['min_created']} to {sample_created['max_created']}", file=sys.stderr)
        
        sample_changed = conn.execute("SELECT MIN(changed_at) as min_changed, MAX(changed_at) as max_changed FROM ticket_status_history").fetchone()
        print(f"[REPORT DEBUG] ticket_status_history changed_at range: {sample_changed['min_changed']} to {sample_changed['max_changed']}", file=sys.stderr)

        opened_count = int(
            (conn.execute(
                f"SELECT COUNT(*) AS cnt FROM ticket_cache WHERE {opened_where}",
                opened_params,
            ).fetchone() or {})["cnt"] or 0
        )
        print(f"[REPORT DEBUG] opened_count={opened_count} from query: {opened_where} with params {opened_params}", file=sys.stderr)

        resolved_count = int(
            (conn.execute(
                f"""
                SELECT COUNT(*) AS cnt FROM ticket_status_history
                WHERE {resolved_where}
                """,
                resolved_params,
            ).fetchone() or {})["cnt"] or 0
        )

        currently_open = int(
            (conn.execute(
                "SELECT COUNT(*) AS cnt FROM ticket_cache WHERE ticket_status = 'Open'"
            ).fetchone() or {})["cnt"] or 0
        )

        currently_pending = int(
            (conn.execute(
                "SELECT COUNT(*) AS cnt FROM ticket_cache WHERE ticket_status = 'Pending'"
            ).fetchone() or {})["cnt"] or 0
        )

        opened_case = "created_at >= ?"
        by_customer_params: tuple = (period_start,)
        resolved_period_where = "tsh.new_status IN ('Closed', 'Resolved') AND tsh.changed_at >= ?"
        resolved_by_customer_params: tuple = (period_start,)
        if period_end:
            opened_case += " AND created_at < ?"
            by_customer_params = (period_start, period_end)
            resolved_period_where += " AND tsh.changed_at < ?"
            resolved_by_customer_params = (period_start, period_end)

        by_customer_rows = conn.execute(
            f"""
            SELECT customer_name,
                   SUM(CASE WHEN {opened_case} THEN 1 ELSE 0 END) AS opened
            FROM ticket_cache
            GROUP BY customer_name
            """,
            by_customer_params,
        ).fetchall()

        resolved_by_customer_rows = conn.execute(
            f"""
            SELECT tc.customer_name, COUNT(*) AS resolved
            FROM ticket_status_history tsh
            JOIN ticket_cache tc ON tc.ticket_id = tsh.ticket_id
            WHERE {resolved_period_where}
            GROUP BY tc.customer_name
            """,
            resolved_by_customer_params,
        ).fetchall()

        pending_by_customer_rows = conn.execute(
            """
            SELECT customer_name, COUNT(*) AS pending
            FROM ticket_cache
            WHERE ticket_status = 'Pending'
            GROUP BY customer_name
            ORDER BY pending DESC, customer_name ASC
            LIMIT 10
            """
        ).fetchall()

        sample_where = "tsh.new_status IN ('Closed', 'Resolved') AND tsh.changed_at >= ?"
        sample_params: tuple = (period_start,)
        if period_end:
            sample_where += " AND tsh.changed_at < ?"
            sample_params = (period_start, period_end)

        sample_title_rows = conn.execute(
            f"""
            SELECT tc.ticket_title
            FROM ticket_status_history tsh
            JOIN ticket_cache tc ON tc.ticket_id = tsh.ticket_id
            WHERE {sample_where}
            ORDER BY tsh.changed_at DESC
            LIMIT 8
            """,
            sample_params,
        ).fetchall()

        pending_title_rows = conn.execute(
            """
            SELECT ticket_title
            FROM ticket_cache
            WHERE ticket_status = 'Pending'
            ORDER BY COALESCE(updated_at, created_at) DESC
            LIMIT 8
            """
        ).fetchall()

        pending_request_rows = conn.execute(
            """
            SELECT ticket_id, customer_name, ticket_title, created_at, updated_at, raw_json
            FROM ticket_cache
            WHERE ticket_status = 'Pending'
            ORDER BY COALESCE(updated_at, created_at) DESC
            """
        ).fetchall()

        open_request_rows = conn.execute(
            """
            SELECT ticket_id, customer_name, ticket_title, created_at, updated_at, raw_json
            FROM ticket_cache
            WHERE ticket_status = 'Open'
            ORDER BY COALESCE(updated_at, created_at) DESC
            LIMIT 20
            """
        ).fetchall()

        resolved_request_rows = conn.execute(
            f"""
            SELECT
                tc.ticket_id,
                tc.customer_name,
                tc.ticket_title,
                tc.created_at,
                tc.updated_at,
                tc.raw_json,
                MAX(tsh.changed_at) AS resolved_at
            FROM ticket_status_history tsh
            JOIN ticket_cache tc ON tc.ticket_id = tsh.ticket_id
            WHERE {resolved_where}
            GROUP BY tc.ticket_id, tc.customer_name, tc.ticket_title, tc.created_at, tc.updated_at, tc.raw_json
            ORDER BY resolved_at DESC
            LIMIT 20
            """,
            resolved_params,
        ).fetchall()

    resolved_map: Dict[str, int] = {
        str(r["customer_name"] or ""): int(r["resolved"]) for r in resolved_by_customer_rows
    }
    pending_map: Dict[str, int] = {
        str(r["customer_name"] or ""): int(r["pending"]) for r in pending_by_customer_rows
    }

    by_customer: List[Dict[str, Any]] = []
    for r in sorted(by_customer_rows, key=lambda x: int(x["opened"] or 0), reverse=True):
        name = str(r["customer_name"] or "Unknown")
        opened = int(r["opened"] or 0)
        resolved = resolved_map.get(str(r["customer_name"] or ""), 0)
        pending = pending_map.get(str(r["customer_name"] or ""), 0)
        if opened > 0 or resolved > 0 or pending > 0:
            by_customer.append({
                "customer_name": name,
                "opened": opened,
                "resolved": resolved,
                "pending": pending,
            })
    by_customer = by_customer[:10]

    sample_titles: List[str] = [
        str(r["ticket_title"]) for r in sample_title_rows if r["ticket_title"]
    ]

    pending_by_customer: List[Dict[str, Any]] = [
        {
            "customer_name": str(r["customer_name"] or "Unknown"),
            "pending": int(r["pending"] or 0),
        }
        for r in pending_by_customer_rows
        if int(r["pending"] or 0) > 0
    ]

    pending_sample_titles: List[str] = [
        str(r["ticket_title"]) for r in pending_title_rows if r["ticket_title"]
    ]

    pending_request_tickets: List[Dict[str, Any]] = []
    for r in pending_request_rows:
        payload: Dict[str, Any] = {}
        try:
            parsed = json.loads(r["raw_json"] or "{}")
            if isinstance(parsed, dict):
                payload = parsed
        except Exception:
            payload = {}

        ticket_type = str(payload.get("TicketType") or "").strip()

        pending_request_tickets.append(
            {
                "ticket_id": int(r["ticket_id"]),
                "customer_name": str(r["customer_name"] or "Unknown"),
                "title": str(r["ticket_title"] or ""),
                "created_at": str(r["created_at"] or ""),
                "last_activity_at": str(r["updated_at"] or ""),
                "ticket_type": ticket_type or "Request",
            }
        )

    open_request_tickets: List[Dict[str, Any]] = []
    for r in open_request_rows:
        payload = {}
        try:
            parsed = json.loads(r["raw_json"] or "{}")
            if isinstance(parsed, dict):
                payload = parsed
        except Exception:
            payload = {}

        ticket_type = str(payload.get("TicketType") or "").strip()
        open_request_tickets.append(
            {
                "ticket_id": int(r["ticket_id"]),
                "customer_name": str(r["customer_name"] or "Unknown"),
                "title": str(r["ticket_title"] or ""),
                "created_at": str(r["created_at"] or ""),
                "last_activity_at": str(r["updated_at"] or ""),
                "ticket_type": ticket_type or "Request",
            }
        )

    resolved_request_tickets: List[Dict[str, Any]] = []
    for r in resolved_request_rows:
        payload = {}
        try:
            parsed = json.loads(r["raw_json"] or "{}")
            if isinstance(parsed, dict):
                payload = parsed
        except Exception:
            payload = {}

        ticket_type = str(payload.get("TicketType") or "").strip()
        resolved_request_tickets.append(
            {
                "ticket_id": int(r["ticket_id"]),
                "customer_name": str(r["customer_name"] or "Unknown"),
                "title": str(r["ticket_title"] or ""),
                "created_at": str(r["created_at"] or ""),
                "last_activity_at": str(r["updated_at"] or ""),
                "resolved_at": str(r["resolved_at"] or ""),
                "ticket_type": ticket_type or "Request",
            }
        )

    return {
        "opened_count": opened_count,
        "resolved_count": resolved_count,
        "currently_open_count": currently_open,
        "currently_pending_count": currently_pending,
        "by_customer": by_customer,
        "sample_titles": sample_titles,
        "pending_by_customer": pending_by_customer,
        "pending_sample_titles": pending_sample_titles,
        "pending_request_tickets": pending_request_tickets,
        "open_request_tickets": open_request_tickets,
        "resolved_request_tickets": resolved_request_tickets,
    }
