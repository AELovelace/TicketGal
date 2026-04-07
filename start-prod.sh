#!/usr/bin/env bash

# When sourced (e.g. `. start-prod.sh`), `exit` would close the user's shell/SSH session.
if [[ "${BASH_SOURCE[0]}" != "$0" ]]; then
  echo "Do not source this script. Run: ./start-prod.sh [--auto-kill-port|-a]" >&2
  return 1 2>/dev/null || exit 1
fi

set -Eeuo pipefail

AUTO_KILL_PORT_CLI=0
RUN_IN_SCREEN=0

for arg in "$@"; do
  case "$arg" in
    --auto-kill-port|-a)
      AUTO_KILL_PORT_CLI=1
      ;;
    --screen|-s)
      RUN_IN_SCREEN=1
      ;;
    *)
      echo "Unknown argument: $arg" >&2
      echo "Usage: ./start-prod.sh [--auto-kill-port|-a] [--screen|-s]" >&2
      exit 2
      ;;
  esac
done

if [[ -f .env ]]; then
  while IFS= read -r line || [[ -n "$line" ]]; do
    if [[ "$line" =~ ^[[:space:]]*# ]] || [[ "$line" =~ ^[[:space:]]*$ ]]; then
      continue
    fi

    if [[ "$line" != *"="* ]]; then
      continue
    fi

    key="${line%%=*}"
    value="${line#*=}"

    key="$(echo "$key" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')"
    value="$(echo "$value" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')"

    # Keep cert paths app-scoped and avoid overriding global TLS trust vars.
    if [[ "$key" == "SSL_CERT_FILE" ]]; then
      if [[ -z "${TICKETGAL_SSL_CERT_FILE:-}" ]]; then
        export TICKETGAL_SSL_CERT_FILE="$value"
      fi
      continue
    fi

    if [[ "$key" == "SSL_KEY_FILE" ]]; then
      if [[ -z "${TICKETGAL_SSL_KEY_FILE:-}" ]]; then
        export TICKETGAL_SSL_KEY_FILE="$value"
      fi
      continue
    fi

    export "$key=$value"
  done < .env
else
  echo "Warning: .env not found in $(pwd). Using default settings." >&2
fi

# Ensure legacy TLS variables do not break outbound HTTPS trust validation.
unset SSL_CERT_FILE || true
unset SSL_KEY_FILE || true

host_addr="${HOST:-0.0.0.0}"
port="${PORT:-8000}"
workers="${WEB_CONCURRENCY:-2}"
https_flag="$(echo "${HTTPS_ENABLED:-}" | tr '[:upper:]' '[:lower:]' | xargs)"
auto_kill_port_flag="$(echo "${AUTO_KILL_PORT:-}" | tr '[:upper:]' '[:lower:]' | xargs)"
auto_generate_cert="${AUTO_GENERATE_DEV_CERT:-1}"
ssl_cert_file="${TICKETGAL_SSL_CERT_FILE:-certs/dev-cert.pem}"
ssl_key_file="${TICKETGAL_SSL_KEY_FILE:-certs/dev-key.pem}"
ssl_hosts="${TICKETGAL_SSL_HOSTS:-$host_addr,localhost,127.0.0.1}"
db_path="${DB_PATH:-ticketgal.db}"
ticket_cache_db_path="${TICKET_CACHE_DB_PATH:-ticketgal_tickets.db}"
transactions_db_path="${TICKET_TRANSACTIONS_DB_PATH:-ticketgal_transactions.db}"

https_enabled=0
if [[ "$https_flag" == "1" || "$https_flag" == "true" || "$https_flag" == "yes" ]]; then
  https_enabled=1
fi

auto_kill_port_enabled=0
if [[ "$AUTO_KILL_PORT_CLI" == "1" || "$auto_kill_port_flag" == "1" || "$auto_kill_port_flag" == "true" || "$auto_kill_port_flag" == "yes" ]]; then
  auto_kill_port_enabled=1
fi

preferred_venv_python="/home/ticketgal/TicketGal/bin/python"

if [[ "$port" =~ ^[0-9]+$ ]] && (( port < 1024 )) && [[ "${EUID:-$(id -u)}" -ne 0 ]]; then
  has_bind_cap=0
  if command -v getcap >/dev/null 2>&1; then
    if getcap "$preferred_venv_python" 2>/dev/null | grep -q 'cap_net_bind_service'; then
      has_bind_cap=1
    fi
  fi

  if [[ "$has_bind_cap" -ne 1 ]]; then
    echo "Port $port is privileged (<1024). Run as root, use a reverse proxy, or grant cap_net_bind_service to $preferred_venv_python:" >&2
    echo "  sudo setcap 'cap_net_bind_service=+ep' $preferred_venv_python" >&2
    echo "Continuing startup; if bind fails, add AmbientCapabilities=CAP_NET_BIND_SERVICE to systemd service." >&2
  fi
fi

if [[ -x "$preferred_venv_python" ]]; then
  python_cmd="$preferred_venv_python"
elif [[ -x .venv/bin/python ]]; then
  python_cmd=".venv/bin/python"
elif command -v python3 >/dev/null 2>&1; then
  python_cmd="python3"
else
  python_cmd="python"
fi

listener_pid=""
process_name=""
if command -v lsof >/dev/null 2>&1; then
  listener_pid="$(lsof -tiTCP:"$port" -sTCP:LISTEN 2>/dev/null | head -n1 || true)"
elif command -v ss >/dev/null 2>&1; then
  listener_pid="$(ss -lptn "sport = :$port" 2>/dev/null | awk -F'pid=' 'NR>1 && NF>1 {split($2,a,",|"); print a[1]; exit}' || true)"
fi

if [[ -n "$listener_pid" ]]; then
  process_name="$(ps -p "$listener_pid" -o comm= 2>/dev/null | xargs || true)"
  if [[ "$auto_kill_port_enabled" == "1" ]]; then
    echo "Port $port is in use by PID $listener_pid ($process_name). Stopping process..."
    kill -9 "$listener_pid"
    sleep 0.3

    listener_check=""
    if command -v lsof >/dev/null 2>&1; then
      listener_check="$(lsof -tiTCP:"$port" -sTCP:LISTEN 2>/dev/null | head -n1 || true)"
    elif command -v ss >/dev/null 2>&1; then
      listener_check="$(ss -lptn "sport = :$port" 2>/dev/null | awk -F'pid=' 'NR>1 && NF>1 {split($2,a,",|"); print a[1]; exit}' || true)"
    fi

    if [[ -n "$listener_check" ]]; then
      echo "Failed to free port $port after killing PID $listener_pid." >&2
      exit 1
    fi
    echo "Port $port has been freed."
  else
    echo "Port $port is already in use by PID $listener_pid ($process_name). Stop that process, run ./start-prod.sh --auto-kill-port, or set AUTO_KILL_PORT=1 in .env." >&2
    exit 1
  fi
fi

uvicorn_args=(
  -m uvicorn
  app.main:app
  --host "$host_addr"
  --port "$port"
  --workers "$workers"
  --proxy-headers
)

if [[ "$https_enabled" == "1" ]]; then
  if [[ ! -f "$ssl_cert_file" || ! -f "$ssl_key_file" || ! -r "$ssl_cert_file" || ! -r "$ssl_key_file" ]]; then
    if [[ "$auto_generate_cert" == "0" ]]; then
      echo "HTTPS is enabled but SSL cert/key is missing or unreadable. Set TICKETGAL_SSL_CERT_FILE/TICKETGAL_SSL_KEY_FILE to readable files or enable AUTO_GENERATE_DEV_CERT=1." >&2
      [[ -f "$ssl_cert_file" ]] && ls -l "$ssl_cert_file" >&2 || true
      [[ -f "$ssl_key_file" ]] && ls -l "$ssl_key_file" >&2 || true
      exit 1
    fi

    echo "Generating self-signed development certificate for hosts: $ssl_hosts"
    "$python_cmd" scripts/generate_self_signed_cert.py --cert-file "$ssl_cert_file" --key-file "$ssl_key_file" --hosts "$ssl_hosts"
  fi

  if [[ ! -r "$ssl_cert_file" || ! -r "$ssl_key_file" ]]; then
    echo "SSL cert/key is not readable by the current user." >&2
    ls -l "$ssl_cert_file" "$ssl_key_file" >&2 || true
    exit 1
  fi

  echo "HTTPS enabled with cert $ssl_cert_file"
  uvicorn_args+=(--ssl-certfile "$ssl_cert_file" --ssl-keyfile "$ssl_key_file")
fi

protocol="http"
if [[ "$https_enabled" == "1" ]]; then
  protocol="https"
fi
echo "Starting TicketGal on ${protocol}://${host_addr}:${port} with ${workers} worker(s)"

for candidate_db in "$db_path" "$ticket_cache_db_path" "$transactions_db_path"; do
  if [[ -e "$candidate_db" ]]; then
    if [[ ! -r "$candidate_db" || ! -w "$candidate_db" ]]; then
      echo "Database file exists but is not readable/writable: $candidate_db" >&2
      ls -l "$candidate_db" >&2 || true
      exit 1
    fi
  else
    db_dir="$(dirname "$candidate_db")"
    if [[ ! -w "$db_dir" ]]; then
      echo "Database directory is not writable: $db_dir" >&2
      ls -ld "$db_dir" >&2 || true
      exit 1
    fi
  fi
done

if [[ "$RUN_IN_SCREEN" == "1" ]]; then
  if ! command -v screen >/dev/null 2>&1; then
    echo "screen is not installed. Install it with: sudo apt-get install screen" >&2
    exit 1
  fi

  session_name="ticketgal-app"
  existing_session="$(screen -ls "$session_name" 2>/dev/null | grep -c "Detached" || true)"
  
  if [[ "$existing_session" -gt 0 ]]; then
    echo "Screen session '$session_name' already running. Use 'screen -r $session_name' to attach." >&2
    exit 0
  fi

  echo "Starting TicketGal in detached screen session '$session_name'"
  screen -dmS "$session_name" bash -c "cd '$PWD' && set -Eeuo pipefail && source .env 2>/dev/null || true && exec \"$python_cmd\" ${uvicorn_args[@]}"
  sleep 0.5
  screen -ls "$session_name" 2>/dev/null | grep -q "Detached" && echo "Screen session '$session_name' started successfully. Attach with: screen -r $session_name"
else
  echo "Starting TicketGal in foreground"
  set +e
  "$python_cmd" "${uvicorn_args[@]}"
  exit_code=$?
  set -e

  if [[ "$exit_code" -ne 0 && "$exit_code" -ne 130 ]]; then
    echo "Uvicorn exited with code $exit_code" >&2
    exit "$exit_code"
  fi
fi