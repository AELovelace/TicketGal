import os
from pathlib import Path

from dotenv import load_dotenv

# Always load the workspace .env explicitly and let it override stale process env values.
project_root = Path(__file__).resolve().parent.parent
load_dotenv(project_root / ".env", override=True)


class Settings:
    def __init__(self) -> None:
        def _flag(name: str, default: str = "0") -> bool:
            return os.getenv(name, default).strip().lower() in {"1", "true", "yes"}

        user_password_flag = os.getenv("USER_PASSWORD_AUTH_ENABLED", "0").strip().lower()
        self.user_password_auth_enabled = user_password_flag in {"1", "true", "yes"}
        self.atera_api_key = os.getenv("ATERA_API_KEY", "")
        self.atera_base_url = os.getenv("ATERA_BASE_URL", "https://app.atera.com").rstrip("/")
        self.enable_cache_read_fallback = _flag("ENABLE_CACHE_READ_FALLBACK", "1")
        self.health_check_atera = _flag("HEALTH_CHECK_ATERA", "1")
        self.health_check_timeout_seconds = max(1, int(os.getenv("HEALTH_CHECK_TIMEOUT_SECONDS", "3")))
        self.enable_write_queue = _flag("ENABLE_WRITE_QUEUE", "1")
        self.enable_queue_for_create_ticket = _flag("ENABLE_QUEUE_FOR_CREATE_TICKET", "1")
        self.enable_queue_for_status_update = _flag("ENABLE_QUEUE_FOR_STATUS_UPDATE", "1")
        self.enable_queue_for_comment = _flag("ENABLE_QUEUE_FOR_COMMENT", "1")
        self.queue_process_batch_limit = max(1, int(os.getenv("QUEUE_PROCESS_BATCH_LIMIT", "25")))
        self.queue_auto_process_enabled = _flag("QUEUE_AUTO_PROCESS_ENABLED", "1")
        self.queue_auto_process_interval_seconds = max(5, int(os.getenv("QUEUE_AUTO_PROCESS_INTERVAL_SECONDS", "30")))
        self.host = os.getenv("HOST", "127.0.0.1")
        self.port = int(os.getenv("PORT", "8000"))
        self.public_base_url = os.getenv("PUBLIC_BASE_URL", "").rstrip("/")
        self.db_path = os.getenv("DB_PATH", str(project_root / "ticketgal.db"))
        self.ticket_cache_db_path = os.getenv("TICKET_CACHE_DB_PATH", str(project_root / "ticketgal_tickets.db"))
        self.transactions_db_path = os.getenv("TICKET_TRANSACTIONS_DB_PATH", str(project_root / "ticketgal_transactions.db"))
        self.data_encryption_key = os.getenv("DATA_ENCRYPTION_KEY", "").strip()
        self.session_cookie_name = os.getenv("SESSION_COOKIE_NAME", "ticketgal_session")
        self.session_hours = int(os.getenv("SESSION_HOURS", "12"))
        self.login_rate_limit_window_minutes = max(1, int(os.getenv("LOGIN_RATE_LIMIT_WINDOW_MINUTES", "15")))
        self.login_max_attempts_per_email = max(1, int(os.getenv("LOGIN_MAX_ATTEMPTS_PER_EMAIL", "5")))
        self.login_max_attempts_per_ip = max(1, int(os.getenv("LOGIN_MAX_ATTEMPTS_PER_IP", "20")))
        self.login_lockout_minutes = max(1, int(os.getenv("LOGIN_LOCKOUT_MINUTES", "30")))
        self.login_lockout_exempt_ips = {
            ip.strip().lower()
            for ip in os.getenv("LOGIN_LOCKOUT_EXEMPT_IPS", "").split(",")
            if ip.strip()
        }
        self.allowed_domains = [
            domain.strip().lower()
            for domain in os.getenv(
                "ALLOWED_EMAIL_DOMAINS",
                "@eternalhotels.com,@redlionpasco.com",
            ).split(",")
            if domain.strip()
        ]
        self.admin_email = os.getenv("ADMIN_EMAIL", "")
        self.admin_password = os.getenv("ADMIN_PASSWORD", "")
        self.openai_api_key = os.getenv("OPENAI_API_KEY", "")
        self.openai_base_url = os.getenv("OPENAI_BASE_URL", "https://api.openai.com/v1").rstrip("/")
        self.openai_model = os.getenv("OPENAI_MODEL", "gpt-4o-mini")
        self.openai_timeout_seconds = int(os.getenv("OPENAI_TIMEOUT_SECONDS", "300"))
        self.microsoft_client_id = os.getenv("MICROSOFT_CLIENT_ID", "")
        self.microsoft_client_secret = os.getenv("MICROSOFT_CLIENT_SECRET", "")
        self.microsoft_tenant_id = os.getenv("MICROSOFT_TENANT_ID", "common").strip() or "common"
        self.allowed_microsoft_tenant_ids = [
            tenant_id.strip()
            for tenant_id in os.getenv("ALLOWED_MICROSOFT_TENANT_IDS", "").split(",")
            if tenant_id.strip()
        ]
        self.microsoft_redirect_path = os.getenv("MICROSOFT_REDIRECT_PATH", "/auth/microsoft/callback")
        self.microsoft_prompt = os.getenv("MICROSOFT_PROMPT", "select_account").strip()
        self.microsoft_scopes = [
            scope.strip()
            for scope in os.getenv(
                "MICROSOFT_SCOPES",
                "User.Read,email",
            ).split(",")
            if scope.strip()
        ]
        require_mfa_flag = os.getenv("MICROSOFT_REQUIRE_MFA", "0").strip().lower()
        self.microsoft_require_mfa = require_mfa_flag in {"1", "true", "yes"}
        self.microsoft_enabled = bool(self.microsoft_client_id and self.microsoft_client_secret)


settings = Settings()
