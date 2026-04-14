import os
from pathlib import Path

from dotenv import load_dotenv

# Always load the workspace .env explicitly and let it override stale process env values.
project_root = Path(__file__).resolve().parent.parent
load_dotenv(project_root / ".env", override=True)

# Load optional branding-only env overrides from a separate file.
branding_env_file = os.getenv("BRANDING_ENV_FILE", ".env.branding").strip()
branding_env_path = Path(branding_env_file)
if not branding_env_path.is_absolute():
    branding_env_path = project_root / branding_env_path
if branding_env_path.exists():
    load_dotenv(branding_env_path, override=True)

# Load optional color theme overrides from a separate file.
coloring_env_file = os.getenv("COLORING_ENV_FILE", ".env.coloring").strip()
coloring_env_path = Path(coloring_env_file)
if not coloring_env_path.is_absolute():
    coloring_env_path = project_root / coloring_env_path
if coloring_env_path.exists():
    load_dotenv(coloring_env_path, override=True)


def _join_domains(domains: list[str]) -> str:
    if not domains:
        return ""
    if len(domains) == 1:
        return domains[0]
    if len(domains) == 2:
        return f"{domains[0]} or {domains[1]}"
    return ", ".join(domains[:-1]) + f", or {domains[-1]}"


class Settings:
    def __init__(self) -> None:
        def _flag(name: str, default: str = "0") -> bool:
            return os.getenv(name, default).strip().lower() in {"1", "true", "yes"}

        def _resolve_path(raw_path: str) -> Path:
            path = Path(raw_path).expanduser()
            if not path.is_absolute():
                path = project_root / path
            return path.resolve()

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
        db_dir_default = project_root / "app" / "db"
        self.db_dir = str(_resolve_path(os.getenv("DB_DIR", str(db_dir_default))))
        self.db_path = str(_resolve_path(os.getenv("DB_PATH", str(Path(self.db_dir) / "ticketgal.db"))))
        self.ticket_cache_db_path = str(
            _resolve_path(os.getenv("TICKET_CACHE_DB_PATH", str(Path(self.db_dir) / "ticketgal_tickets.db")))
        )
        self.transactions_db_path = str(
            _resolve_path(os.getenv("TICKET_TRANSACTIONS_DB_PATH", str(Path(self.db_dir) / "ticketgal_transactions.db")))
        )
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
        self.allowed_domains_display = _join_domains(self.allowed_domains)
        self.branding_env_file = str(branding_env_path)
        self.brand_product_name = os.getenv("BRAND_PRODUCT_NAME", "TicketGal")
        self.brand_portal_title = os.getenv("BRAND_PORTAL_TITLE", f"{self.brand_product_name} Service Portal")
        self.brand_operations_title = os.getenv("BRAND_OPERATIONS_TITLE", f"{self.brand_product_name} Operations Desk")
        self.brand_top_banner_left = os.getenv("BRAND_TOP_BANNER_LEFT", "YOUR REGION")
        self.brand_top_banner_right = os.getenv("BRAND_TOP_BANNER_RIGHT", "YOUR ORGANIZATION")
        self.brand_auth_eyebrow = os.getenv("BRAND_AUTH_EYEBROW", "SERVICE OPERATIONS")
        self.brand_hero_eyebrow = os.getenv("BRAND_HERO_EYEBROW", "IT TEAM")
        self.brand_auth_description = os.getenv(
            "BRAND_AUTH_DESCRIPTION",
            "Log in to continue. All accounts are password-protected. New user registrations require admin approval.",
        )
        self.brand_register_description = os.getenv(
            "BRAND_REGISTER_DESCRIPTION",
            "Create a new account. Admin approval is required before first login.",
        )
        self.brand_allowed_domains_label = os.getenv("BRAND_ALLOWED_DOMAINS_LABEL", "Allowed domains")
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
            tenant_id.strip().lower()
            for tenant_id in os.getenv("ALLOWED_MICROSOFT_TENANT_IDS", "").split(",")
            if tenant_id.strip()
        ]
        authority_override = os.getenv("MICROSOFT_AUTHORITY_TENANT", "").strip().lower()
        if authority_override:
            self.microsoft_authority_tenant = authority_override
        elif len(self.allowed_microsoft_tenant_ids) > 1 and self.microsoft_tenant_id.lower() not in {
            "common",
            "organizations",
            "consumers",
        }:
            # When allowing more than one tenant, use an org-wide authority so users can authenticate
            # from either tenant, then enforce exact tenant IDs in callback allowlist checks.
            self.microsoft_authority_tenant = "organizations"
        else:
            self.microsoft_authority_tenant = self.microsoft_tenant_id
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

        # Color theme — loaded from .env.coloring
        self.color_navy_900 = os.getenv("COLOR_NAVY_900", "#0e1c2f")
        self.color_navy_800 = os.getenv("COLOR_NAVY_800", "#142a45")
        self.color_navy_700 = os.getenv("COLOR_NAVY_700", "#1f3f66")
        self.color_gold_500 = os.getenv("COLOR_GOLD_500", "#c6a75d")
        self.color_gold_400 = os.getenv("COLOR_GOLD_400", "#d8bb79")
        self.color_paper = os.getenv("COLOR_PAPER", "#f8f5ed")
        self.color_card = os.getenv("COLOR_CARD", "#fffdf8")
        self.color_ink = os.getenv("COLOR_INK", "#192432")
        self.color_muted = os.getenv("COLOR_MUTED", "#617086")
        self.color_line = os.getenv("COLOR_LINE", "#ddd4c1")
        self.color_shadow = os.getenv("COLOR_SHADOW", "0 14px 26px rgba(8, 18, 30, 0.12)")


settings = Settings()
