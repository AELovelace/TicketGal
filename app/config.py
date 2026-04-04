import os
from pathlib import Path

from dotenv import load_dotenv

# Always load the workspace .env explicitly and let it override stale process env values.
project_root = Path(__file__).resolve().parent.parent
load_dotenv(project_root / ".env", override=True)


class Settings:
    def __init__(self) -> None:
        self.atera_api_key = os.getenv("ATERA_API_KEY", "")
        self.atera_base_url = os.getenv("ATERA_BASE_URL", "https://app.atera.com").rstrip("/")
        self.host = os.getenv("HOST", "127.0.0.1")
        self.port = int(os.getenv("PORT", "8000"))
        self.db_path = os.getenv("DB_PATH", str(project_root / "ticketgal.db"))
        self.session_cookie_name = os.getenv("SESSION_COOKIE_NAME", "ticketgal_session")
        self.session_hours = int(os.getenv("SESSION_HOURS", "12"))
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


settings = Settings()
