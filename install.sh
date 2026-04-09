#!/usr/bin/env bash
# ============================================================
#  TicketGal – Ubuntu Server Install Script
#  Tested on Ubuntu 22.04 LTS / 24.04 LTS
# ============================================================

set -Eeuo pipefail

# ── Colour helpers ────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; NC='\033[0m'
info()    { echo -e "${CYAN}[INFO]${NC}  $*"; }
success() { echo -e "${GREEN}[OK]${NC}    $*"; }
warn()    { echo -e "${YELLOW}[WARN]${NC}  $*"; }
die()     { echo -e "${RED}[ERROR]${NC} $*" >&2; exit 1; }

# ── Privilege check ───────────────────────────────────────────
[[ $EUID -eq 0 ]] || die "Run as root or with sudo:  sudo bash install.sh"

# ── Configuration ─────────────────────────────────────────────
APP_USER="ticketgal"
APP_GROUP="ticketgal"
INSTALL_DIR="/home/${APP_USER}/TicketGal"
VENV_DIR="${INSTALL_DIR}/.venv"
SERVICE_FILE="/etc/systemd/system/ticketgal.service"
MIN_PYTHON_MINOR=11          # Require Python 3.11+

# ── 1. System packages ────────────────────────────────────────
info "Updating package lists…"
apt-get update -qq

info "Installing system dependencies…"
apt-get install -y -qq \
    python3 \
    python3-pip \
    python3-venv \
    python3-dev \
    build-essential \
    libssl-dev \
    libffi-dev \
    curl \
    ca-certificates \
    git

# Verify Python version
PYTHON_BIN=$(command -v python3)
PYTHON_VER=$("$PYTHON_BIN" -c "import sys; print(sys.version_info.minor)")
PYTHON_FULL=$("$PYTHON_BIN" --version 2>&1)
if (( PYTHON_VER < MIN_PYTHON_MINOR )); then
    info "System python3 is ${PYTHON_FULL}; installing python3.11 from deadsnakes PPA…"
    apt-get install -y -qq software-properties-common
    add-apt-repository -y ppa:deadsnakes/ppa
    apt-get update -qq
    apt-get install -y -qq python3.11 python3.11-venv python3.11-dev
    PYTHON_BIN=$(command -v python3.11)
fi
success "Using $("$PYTHON_BIN" --version)"

# ── 2. Create dedicated system user ──────────────────────────
if ! id "$APP_USER" &>/dev/null; then
    info "Creating system user '${APP_USER}'…"
    useradd --system --create-home --shell /bin/bash \
            --comment "TicketGal service account" "$APP_USER"
    success "User '${APP_USER}' created."
else
    warn "User '${APP_USER}' already exists – skipping creation."
fi

# ── 3. Copy application files ─────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if [[ "$SCRIPT_DIR" != "$INSTALL_DIR" ]]; then
    info "Copying application files to ${INSTALL_DIR}…"
    mkdir -p "$INSTALL_DIR"
    rsync -a --exclude='.venv' --exclude='__pycache__' --exclude='*.pyc' \
              --exclude='*.db' --exclude='.env' \
              "${SCRIPT_DIR}/" "${INSTALL_DIR}/"
    success "Files copied."
else
    info "Running from install directory; skipping file copy."
fi

# ── 4. Python virtual environment & dependencies ──────────────
info "Creating virtual environment at ${VENV_DIR}…"
"$PYTHON_BIN" -m venv "$VENV_DIR"

info "Upgrading pip…"
"${VENV_DIR}/bin/pip" install --quiet --upgrade pip

info "Installing Python dependencies from requirements.txt…"
"${VENV_DIR}/bin/pip" install --quiet -r "${INSTALL_DIR}/requirements.txt"
success "Python dependencies installed."

# ── 5. Create .env from template (skip if already present) ────
ENV_FILE="${INSTALL_DIR}/.env"
if [[ ! -f "$ENV_FILE" ]]; then
    info "Creating .env template at ${ENV_FILE}…"
    cat > "$ENV_FILE" <<'EOF'
# ── Server ────────────────────────────────────────────────────
HOST=127.0.0.1
PORT=8000
# Set PUBLIC_BASE_URL when running behind nginx or another reverse proxy.
# Example: https://tickets.example.com
PUBLIC_BASE_URL=

# ── Optional direct app TLS (keep disabled behind nginx) ─────
HTTPS_ENABLED=0
AUTO_GENERATE_DEV_CERT=1
TICKETGAL_SSL_CERT_FILE=certs/dev-cert.pem
TICKETGAL_SSL_KEY_FILE=certs/dev-key.pem
TICKETGAL_SSL_HOSTS=ticketgal.localdomain.internal,localhost,127.0.0.1

# ── Atera ─────────────────────────────────────────────────────
ATERA_API_KEY=
ATERA_BASE_URL=https://app.atera.com

# ── Database ──────────────────────────────────────────────────
# DB_PATH=app/db/ticketgal.db
# TICKET_CACHE_DB_PATH=app/db/ticketgal_tickets.db
# TICKET_TRANSACTIONS_DB_PATH=app/db/ticketgal_transactions.db

# ── Encryption (generate with: openssl rand -hex 32) ─────────
DATA_ENCRYPTION_KEY=

# ── Session ───────────────────────────────────────────────────
SESSION_HOURS=12

# ── Auth – local user/password (optional) ────────────────────
USER_PASSWORD_AUTH_ENABLED=0
# ADMIN_EMAIL=admin@example.com
# ADMIN_PASSWORD=change_me

# ── Auth – Microsoft / Entra ID (optional) ───────────────────
# MICROSOFT_CLIENT_ID=
# MICROSOFT_CLIENT_SECRET=
# MICROSOFT_TENANT_ID=common
# ALLOWED_MICROSOFT_TENANT_IDS=

# ── OpenAI (optional) ─────────────────────────────────────────
# OPENAI_API_KEY=
# OPENAI_MODEL=gpt-4o-mini
# OPENAI_BASE_URL=https://api.openai.com/v1
# OPENAI_TIMEOUT_SECONDS=300

# ── Email domain allow-list ───────────────────────────────────
ALLOWED_EMAIL_DOMAINS=@example.com
EOF
    warn ".env template written.  Edit ${ENV_FILE} before starting the service."
else
    info ".env already exists – skipping template creation."
fi

# ── 6. Ensure start-prod.sh is executable ─────────────────────
chmod +x "${INSTALL_DIR}/start-prod.sh"
chmod +x "${INSTALL_DIR}/scripts/install_nginx_modsecurity.sh"

# ── 7. Fix ownership ──────────────────────────────────────────
info "Setting ownership of ${INSTALL_DIR} to ${APP_USER}:${APP_GROUP}…"
chown -R "${APP_USER}:${APP_GROUP}" "$INSTALL_DIR"

# Protect the .env
chmod 600 "$ENV_FILE"
success "Permissions set."

# ── 8. Grant port-binding capability for optional low-port direct bind ──
PYTHON_EXECUTABLE="${VENV_DIR}/bin/python"
if command -v setcap &>/dev/null; then
    info "Granting CAP_NET_BIND_SERVICE to Python executable for optional direct low-port bind…"
    setcap 'cap_net_bind_service=+ep' "$PYTHON_EXECUTABLE" || \
        warn "setcap failed – if binding port <1024 the service user may need additional privileges."
else
    apt-get install -y -qq libcap2-bin
    setcap 'cap_net_bind_service=+ep' "$PYTHON_EXECUTABLE" || true
fi

# ── 9. Install & enable systemd service ──────────────────────
info "Installing systemd service…"

# Write the service file (derived from ticketgal.service in repo)
cat > "$SERVICE_FILE" <<EOF
[Unit]
Description=TicketGal Application Server
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=${APP_USER}
Group=${APP_GROUP}
WorkingDirectory=${INSTALL_DIR}
ExecStart=/usr/bin/bash ${INSTALL_DIR}/start-prod.sh
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal
SyslogIdentifier=ticketgal
AmbientCapabilities=CAP_NET_BIND_SERVICE
CapabilityBoundingSet=CAP_NET_BIND_SERVICE

# Resource limits
LimitNOFILE=65536
LimitNPROC=4096

# Security hardening
PrivateTmp=true
NoNewPrivileges=true
ProtectSystem=full
ProtectHome=false
ReadWritePaths=${INSTALL_DIR}

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable ticketgal.service
success "Service enabled (ticketgal.service)."

# ── Done ──────────────────────────────────────────────────────
echo ""
echo -e "${GREEN}════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}  TicketGal installation complete!${NC}"
echo -e "${GREEN}════════════════════════════════════════════════════${NC}"
echo ""
echo -e "  Install directory : ${CYAN}${INSTALL_DIR}${NC}"
echo -e "  Config file       : ${CYAN}${ENV_FILE}${NC}"
echo ""
echo -e "  ${YELLOW}Next steps:${NC}"
echo -e "  1. Edit the config:  sudo nano ${ENV_FILE}"
echo -e "  2. Start the app service: sudo systemctl start ticketgal"
echo -e "  3. Optional reverse proxy: sudo bash ${INSTALL_DIR}/scripts/install_nginx_modsecurity.sh --server-name your-hostname"
echo -e "  4. Check app status:     sudo systemctl status ticketgal"
echo -e "  5. View logs:            sudo journalctl -u ticketgal -f"
echo ""
