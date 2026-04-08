#!/usr/bin/env bash

set -Eeuo pipefail

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; NC='\033[0m'
info()    { echo -e "${CYAN}[INFO]${NC}  $*"; }
success() { echo -e "${GREEN}[OK]${NC}    $*"; }
warn()    { echo -e "${YELLOW}[WARN]${NC}  $*"; }
die()     { echo -e "${RED}[ERROR]${NC} $*" >&2; exit 1; }

usage() {
    cat <<'EOF'
Usage:
  sudo bash scripts/install_nginx_modsecurity.sh --server-name tickets.example.com [options]

Options:
  --server-name NAME       Public nginx server_name. Required.
  --app-port PORT          Internal TicketGal port. Default: 8000
  --upstream-host HOST     Internal TicketGal host. Default: 127.0.0.1
  --tls-cert PATH          TLS certificate path for nginx 443 listener
  --tls-key PATH           TLS key path for nginx 443 listener
  --enable-blocking        Switch ModSecurity from DetectionOnly to On after install
EOF
}

[[ $EUID -eq 0 ]] || die "Run as root or with sudo."

SERVER_NAME=""
APP_PORT="8000"
UPSTREAM_HOST="127.0.0.1"
TLS_CERT_FILE=""
TLS_KEY_FILE=""
ENABLE_BLOCKING=0

while [[ $# -gt 0 ]]; do
    case "$1" in
        --server-name)
            SERVER_NAME="${2:-}"
            shift 2
            ;;
        --app-port)
            APP_PORT="${2:-}"
            shift 2
            ;;
        --upstream-host)
            UPSTREAM_HOST="${2:-}"
            shift 2
            ;;
        --tls-cert)
            TLS_CERT_FILE="${2:-}"
            shift 2
            ;;
        --tls-key)
            TLS_KEY_FILE="${2:-}"
            shift 2
            ;;
        --enable-blocking)
            ENABLE_BLOCKING=1
            shift
            ;;
        --help|-h)
            usage
            exit 0
            ;;
        *)
            usage
            die "Unknown argument: $1"
            ;;
    esac
done

[[ -n "$SERVER_NAME" ]] || { usage; die "--server-name is required."; }
[[ "$APP_PORT" =~ ^[0-9]+$ ]] || die "--app-port must be numeric."

if [[ -n "$TLS_CERT_FILE" || -n "$TLS_KEY_FILE" ]]; then
    [[ -n "$TLS_CERT_FILE" && -n "$TLS_KEY_FILE" ]] || die "Provide both --tls-cert and --tls-key, or neither."
    [[ -r "$TLS_CERT_FILE" ]] || die "TLS cert file is not readable: $TLS_CERT_FILE"
    [[ -r "$TLS_KEY_FILE" ]] || die "TLS key file is not readable: $TLS_KEY_FILE"
fi

source /etc/os-release || die "Unable to determine operating system."
[[ "${ID:-}" == "ubuntu" ]] || die "This installer currently supports Ubuntu only."

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
NGINX_HTTP_TEMPLATE="$REPO_ROOT/deploy/nginx/ticketgal-http.conf.template"
NGINX_HTTPS_TEMPLATE="$REPO_ROOT/deploy/nginx/ticketgal-https.conf.template"
MODSEC_SOURCE_DIR="$REPO_ROOT/deploy/modsecurity"
NGINX_SITE_PATH="/etc/nginx/sites-available/ticketgal.conf"
MODSEC_TARGET_DIR="/etc/nginx/modsec/ticketgal"
MODSEC_AUDIT_LOG="/var/log/nginx/modsec_audit.log"
MODSEC_DATA_DIR="/var/cache/modsecurity"

[[ -f "$NGINX_HTTP_TEMPLATE" ]] || die "Missing nginx HTTP template: $NGINX_HTTP_TEMPLATE"
[[ -f "$NGINX_HTTPS_TEMPLATE" ]] || die "Missing nginx HTTPS template: $NGINX_HTTPS_TEMPLATE"
[[ -d "$MODSEC_SOURCE_DIR" ]] || die "Missing modsecurity template directory: $MODSEC_SOURCE_DIR"

info "Installing nginx + ModSecurity packages..."
apt-get update -qq
apt-get install -y -qq nginx libnginx-mod-http-modsecurity modsecurity-crs

install -d -m 755 "$MODSEC_TARGET_DIR" "$MODSEC_DATA_DIR"
chown root:root "$MODSEC_TARGET_DIR"
chown www-data:www-data "$MODSEC_DATA_DIR"
chmod 750 "$MODSEC_DATA_DIR"
install -m 644 "$MODSEC_SOURCE_DIR/modsecurity-ticketgal.conf" "$MODSEC_TARGET_DIR/modsecurity-ticketgal.conf"
install -m 644 "$MODSEC_SOURCE_DIR/crs-setup-ticketgal.conf" "$MODSEC_TARGET_DIR/crs-setup-ticketgal.conf"
install -m 644 "$MODSEC_SOURCE_DIR/ticketgal-exclusions.conf" "$MODSEC_TARGET_DIR/ticketgal-exclusions.conf"

install -o www-data -g adm -m 640 /dev/null "$MODSEC_AUDIT_LOG"

if [[ "$ENABLE_BLOCKING" == "1" ]]; then
    sed -i "s/^SecRuleEngine DetectionOnly$/SecRuleEngine On/" "$MODSEC_TARGET_DIR/modsecurity-ticketgal.conf"
fi

if [[ -n "$TLS_CERT_FILE" ]]; then
    config_template="$NGINX_HTTPS_TEMPLATE"
else
    config_template="$NGINX_HTTP_TEMPLATE"
fi

cp "$config_template" "$NGINX_SITE_PATH"
sed -i \
    -e "s|__SERVER_NAME__|$SERVER_NAME|g" \
    -e "s|__UPSTREAM_HOST__|$UPSTREAM_HOST|g" \
    -e "s|__UPSTREAM_PORT__|$APP_PORT|g" \
    -e "s|__TLS_CERT_FILE__|$TLS_CERT_FILE|g" \
    -e "s|__TLS_KEY_FILE__|$TLS_KEY_FILE|g" \
    "$NGINX_SITE_PATH"

if [[ -L /etc/nginx/sites-enabled/default || -f /etc/nginx/sites-enabled/default ]]; then
    rm -f /etc/nginx/sites-enabled/default
fi
ln -sfn "$NGINX_SITE_PATH" /etc/nginx/sites-enabled/ticketgal.conf

nginx -t
systemctl enable nginx
systemctl reload nginx

success "nginx + ModSecurity are configured for TicketGal."
echo ""
echo "ModSecurity mode: $(if [[ "$ENABLE_BLOCKING" == "1" ]]; then echo "blocking"; else echo "detection-only"; fi)"
echo "Upstream: http://$UPSTREAM_HOST:$APP_PORT"
echo "Site config: $NGINX_SITE_PATH"
echo "Audit log: $MODSEC_AUDIT_LOG"