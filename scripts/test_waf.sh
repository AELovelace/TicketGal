#!/usr/bin/env bash

set -Eeuo pipefail

usage() {
    cat <<'EOF'
Usage:
  bash scripts/test_waf.sh --base-url https://ticketgal.localdomain.internal --mode blocking

Options:
  --base-url URL      Base URL exposed by nginx, e.g. https://ticketgal.localdomain.internal
  --mode MODE         detection or blocking (default: blocking)
  --insecure          Pass -k to curl for self-signed certs

This script performs read-only WAF probes and prints PASS/FAIL per case.
EOF
}

BASE_URL=""
MODE="blocking"
INSECURE=0

while [[ $# -gt 0 ]]; do
    case "$1" in
        --base-url)
            BASE_URL="${2:-}"
            shift 2
            ;;
        --mode)
            MODE="${2:-}"
            shift 2
            ;;
        --insecure)
            INSECURE=1
            shift
            ;;
        --help|-h)
            usage
            exit 0
            ;;
        *)
            usage
            echo "Unknown argument: $1" >&2
            exit 2
            ;;
    esac
done

if [[ -z "$BASE_URL" ]]; then
    usage
    echo "--base-url is required" >&2
    exit 2
fi

if [[ "$MODE" != "detection" && "$MODE" != "blocking" ]]; then
    echo "--mode must be detection or blocking" >&2
    exit 2
fi

CURL_ARGS=(-sS -o /dev/null -w "%{http_code}")
if [[ "$INSECURE" == "1" ]]; then
    CURL_ARGS+=(-k)
fi

pass_count=0
fail_count=0

print_result() {
    local ok="$1"
    local name="$2"
    local detail="$3"
    if [[ "$ok" == "1" ]]; then
        printf "PASS %-36s %s\n" "$name" "$detail"
        pass_count=$((pass_count + 1))
    else
        printf "FAIL %-36s %s\n" "$name" "$detail"
        fail_count=$((fail_count + 1))
    fi
}

request_get() {
    local path="$1"
    curl "${CURL_ARGS[@]}" "$BASE_URL$path"
}

request_post_json() {
    local path="$1"
    local body="$2"
    curl "${CURL_ARGS[@]}" -X POST -H "content-type: application/json" --data "$body" "$BASE_URL$path"
}

echo "Testing WAF at $BASE_URL (mode=$MODE)"

# 1. Baseline health should be reachable through nginx.
health_code="$(request_get "/health" || true)"
if [[ "$health_code" == "200" ]]; then
    print_result 1 "health endpoint" "HTTP $health_code"
else
    print_result 0 "health endpoint" "expected 200, got $health_code"
fi

# 2. Benign protected POST should be app-auth failure (401/403), not WAF internal 500.
benign_code="$(request_post_json "/api/tickets/ai-assist" '{"description":"Printer queue is stuck on floor 2.","ticket_title":"Printer queue issue"}' || true)"
if [[ "$benign_code" == "401" || "$benign_code" == "403" || "$benign_code" == "200" ]]; then
    print_result 1 "benign protected POST" "HTTP $benign_code"
else
    print_result 0 "benign protected POST" "expected 200/401/403, got $benign_code"
fi

# 3. Malicious XSS probe in JSON body.
xss_code="$(request_post_json "/api/tickets/ai-assist" '{"description":"<script>alert(1)</script>","ticket_title":"xss probe"}' || true)"
if [[ "$MODE" == "blocking" ]]; then
    if [[ "$xss_code" == "403" ]]; then
        print_result 1 "xss probe" "blocked with HTTP 403"
    else
        print_result 0 "xss probe" "expected 403 in blocking mode, got $xss_code"
    fi
else
    if [[ "$xss_code" == "500" ]]; then
        print_result 0 "xss probe" "unexpected 500 in detection mode"
    else
        print_result 1 "xss probe" "HTTP $xss_code"
    fi
fi

# 4. Malicious SQLi probe in query string.
sqli_code="$(request_get '/?waf_probe=%27%20or%201%3D1--' || true)"
if [[ "$MODE" == "blocking" ]]; then
    if [[ "$sqli_code" == "403" ]]; then
        print_result 1 "sqli query probe" "blocked with HTTP 403"
    else
        print_result 0 "sqli query probe" "expected 403 in blocking mode, got $sqli_code"
    fi
else
    if [[ "$sqli_code" == "500" ]]; then
        print_result 0 "sqli query probe" "unexpected 500 in detection mode"
    else
        print_result 1 "sqli query probe" "HTTP $sqli_code"
    fi
fi

# 5. OAuth callback sanity check should not 500 after exclusions.
oauth_code="$(request_get '/auth/microsoft/callback?code=test-code&state=test-state' || true)"
if [[ "$oauth_code" == "500" ]]; then
    print_result 0 "oauth callback sanity" "unexpected 500"
else
    print_result 1 "oauth callback sanity" "HTTP $oauth_code"
fi

echo ""
echo "Summary: $pass_count passed, $fail_count failed"

if [[ "$fail_count" -gt 0 ]]; then
    echo "Check /var/log/nginx/error.log and /var/log/nginx/modsec_audit.log for failed cases."
    exit 1
fi
