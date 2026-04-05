#!/usr/bin/env bash

set -Eeuo pipefail

AUTO_KILL_PORT_CLI=0

for arg in "$@"; do
  case "$arg" in
    --auto-kill-port|-a)
      AUTO_KILL_PORT_CLI=1
      ;;
    *)
      echo "Unknown argument: $arg" >&2
      echo "Usage: ./start-prod.sh [--auto-kill-port|-a]" >&2
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

https_enabled=0
if [[ "$https_flag" == "1" || "$https_flag" == "true" || "$https_flag" == "yes" ]]; then
  https_enabled=1
fi

auto_kill_port_enabled=0
if [[ "$AUTO_KILL_PORT_CLI" == "1" || "$auto_kill_port_flag" == "1" || "$auto_kill_port_flag" == "true" || "$auto_kill_port_flag" == "yes" ]]; then
  auto_kill_port_enabled=1
fi

if [[ -x .venv/bin/python ]]; then
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
  if [[ ! -f "$ssl_cert_file" || ! -f "$ssl_key_file" ]]; then
    if [[ "$auto_generate_cert" == "0" ]]; then
      echo "HTTPS is enabled but SSL cert or key file is missing. Set SSL_CERT_FILE/SSL_KEY_FILE or enable AUTO_GENERATE_DEV_CERT=1." >&2
      exit 1
    fi

    echo "Generating self-signed development certificate..."
    "$python_cmd" scripts/generate_self_signed_cert.py --cert-file "$ssl_cert_file" --key-file "$ssl_key_file" --hosts "$host_addr,localhost,127.0.0.1"
  fi

  echo "HTTPS enabled with cert $ssl_cert_file"
  uvicorn_args+=(--ssl-certfile "$ssl_cert_file" --ssl-keyfile "$ssl_key_file")
fi

set +e
"$python_cmd" "${uvicorn_args[@]}"
exit_code=$?
set -e

if [[ "$exit_code" -ne 0 && "$exit_code" -ne 130 ]]; then
  echo "Uvicorn exited with code $exit_code" >&2
  exit "$exit_code"
fi