#!/bin/bash

# This script syncs all tickets from Atera into the production ticket cache database
# It should be run after deploying the updated app/main.py and restarting the prod server

set -e

PRODUCTION_URL="${1}"
ADMIN_EMAIL="${2}"
ADMIN_PASSWORD="${3}"

if [ -z "$PRODUCTION_URL" ] || [ -z "$ADMIN_EMAIL" ] || [ -z "$ADMIN_PASSWORD" ]; then
    echo "Usage: $0 <PRODUCTION_URL> <ADMIN_EMAIL> <ADMIN_PASSWORD>"
    echo ""
    echo "Example:"
    echo "  $0 https://ticketgal.example.com admin@example.com 'your-password'"
    exit 1
fi

echo "TicketGal Production Ticket Cache Sync"
echo "======================================"
echo ""

# Step 1: Login
echo "Step 1: Authenticating as admin..."
LOGIN_RESPONSE=$(curl -s -c /tmp/ticketgal_cookies.txt \
    -X POST \
    -H "Content-Type: application/json" \
    -d "{\"email\": \"$ADMIN_EMAIL\", \"password\": \"$ADMIN_PASSWORD\"}" \
    "$PRODUCTION_URL/auth/login")

if echo "$LOGIN_RESPONSE" | grep -q "error"; then
    echo "✗ Authentication failed"
    echo "$LOGIN_RESPONSE"
    exit 1
fi

echo "✓ Authentication successful"
echo ""

# Step 2: Call sync endpoint
echo "Step 2: Syncing all tickets from Atera..."
echo "(This may take a few minutes if you have many tickets)"
SYNC_RESPONSE=$(curl -s -b /tmp/ticketgal_cookies.txt \
    -X POST \
    -H "Content-Type: application/json" \
    "$PRODUCTION_URL/api/admin/sync-tickets-from-atera")

# Extract fields from JSON response
STATUS=$(echo "$SYNC_RESPONSE" | grep -o '"status":"[^"]*' | cut -d'"' -f4)
MESSAGE=$(echo "$SYNC_RESPONSE" | grep -o '"message":"[^"]*' | cut -d'"' -f4)
TICKET_COUNT=$(echo "$SYNC_RESPONSE" | grep -o '"ticket_count":[0-9]*' | cut -d':' -f2)

if [ "$STATUS" != "success" ]; then
    echo "✗ Sync failed"
    echo "$SYNC_RESPONSE"
    rm -f /tmp/ticketgal_cookies.txt
    exit 1
fi

echo "✓ Sync successful"
echo ""
echo "$MESSAGE"
echo "Total tickets synced: $TICKET_COUNT"
echo ""

# Cleanup
rm -f /tmp/ticketgal_cookies.txt

echo "======================================"
echo "Setup complete! Production reports should now show historical data."
echo "If reports still show no data, try refreshing the browser or restarting the app."
