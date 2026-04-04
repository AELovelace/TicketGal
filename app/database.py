import sqlite3
from contextlib import contextmanager
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Generator, List, Optional

from .config import settings


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
                user_id INTEGER NOT NULL,
                expires_at TEXT NOT NULL,
                created_at TEXT NOT NULL,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
            """
        )
        user_columns = {row["name"] for row in conn.execute("PRAGMA table_info(users)").fetchall()}
        if "property_customer_id" not in user_columns:
            conn.execute("ALTER TABLE users ADD COLUMN property_customer_id INTEGER")
        if "property_name" not in user_columns:
            conn.execute("ALTER TABLE users ADD COLUMN property_name TEXT")
        if "theme_enabled" not in user_columns:
            conn.execute("ALTER TABLE users ADD COLUMN theme_enabled INTEGER NOT NULL DEFAULT 0")

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
    return dict(row) if row else None


def get_user_by_id(user_id: int) -> Optional[Dict[str, Any]]:
    with get_conn() as conn:
        row = conn.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
    return dict(row) if row else None


def create_user(email: str, role: str, password_hash: Optional[str], approved: bool) -> Dict[str, Any]:
    now = _utc_now_iso()
    approved_at = now if approved else None
    with get_conn() as conn:
        cur = conn.execute(
            """
            INSERT INTO users(email, role, password_hash, approved, is_active, created_at, approved_at)
            VALUES(?, ?, ?, ?, 1, ?, ?)
            """,
            (email.lower(), role, password_hash, 1 if approved else 0, now, approved_at),
        )
        conn.commit()
        user_id = cur.lastrowid
    user = get_user_by_id(int(user_id))
    if not user:
        raise RuntimeError("Failed to create user")
    return user


def list_users(pending_only: bool) -> List[Dict[str, Any]]:
    query = "SELECT * FROM users"
    params: tuple = ()
    if pending_only:
        query += " WHERE approved = 0"
    query += " ORDER BY created_at DESC"

    with get_conn() as conn:
        rows = conn.execute(query, params).fetchall()
    return [dict(row) for row in rows]


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
            (password_hash, user_id),
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
    with get_conn() as conn:
        conn.execute("DELETE FROM sessions WHERE user_id = ?", (user_id,))
        conn.execute(
            "INSERT INTO sessions(token, user_id, expires_at, created_at) VALUES(?, ?, ?, ?)",
            (token, user_id, expires.isoformat(), now.isoformat()),
        )
        conn.commit()

    return {
        "token": token,
        "user_id": user_id,
        "expires_at": expires.isoformat(),
    }


def get_session(token: str) -> Optional[Dict[str, Any]]:
    with get_conn() as conn:
        row = conn.execute("SELECT * FROM sessions WHERE token = ?", (token,)).fetchone()
    if not row:
        return None

    session = dict(row)
    expires = datetime.fromisoformat(session["expires_at"])
    if expires <= datetime.now(timezone.utc):
        delete_session(token)
        return None
    return session


def delete_session(token: str) -> None:
    with get_conn() as conn:
        conn.execute("DELETE FROM sessions WHERE token = ?", (token,))
        conn.commit()


def seed_admin(email: str, password_hash: str) -> None:
    existing = get_user_by_email(email)
    if existing:
        return
    create_user(email=email, role="admin", password_hash=password_hash, approved=True)
