import hashlib
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


@contextmanager
def get_conn() -> Generator[sqlite3.Connection, None, None]:
    conn = sqlite3.connect(settings.db_path)
    conn.row_factory = sqlite3.Row
    try:
        yield conn
    finally:
        conn.close()


def init_db() -> None:
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
        # Default: signups enabled
        conn.execute(
            "INSERT OR IGNORE INTO site_settings(key, value) VALUES('signups_enabled', '1')"
        )
        conn.commit()


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
