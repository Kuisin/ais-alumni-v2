#!/bin/bash
# Native email sign-in in the simulator through the UI, with the code read
# from the local website's dev mailbox (EMAIL_DEV_MAILBOX=1 / no Resend key).
#   UDID=… APP_URL=exp://127.0.0.1:8081 maestro/signin.sh hanako@example.com
# A development build instead of Expo Go:
#   APP_ID=net.kailab.aisalumni \
#   APP_URL="aisalumni://expo-development-client/?url=http%3A%2F%2F127.0.0.1%3A8089"
set -euo pipefail
EMAIL=$1
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
# The API server checkout whose dev mailbox has the code (ais-alumni-app).
SERVER_DIR=${SERVER_DIR:-"$ROOT/../ais-alumni-app"}
APP_URL=${APP_URL:-exp://127.0.0.1:8081}
APP_ID=${APP_ID:-host.exp.Exponent}
MAILBOX="$SERVER_DIR/.data/dev-mail/$EMAIL.txt"
rm -f "$MAILBOX"
maestro --device "$UDID" test -e APP_ID="$APP_ID" -e APP_URL="$APP_URL" -e EMAIL="$EMAIL" "$ROOT/maestro/signin-request.yaml"
for _ in $(seq 1 30); do [ -f "$MAILBOX" ] && break; sleep 0.5; done
CODE=$(grep -oE '\b[0-9]{6}\b' "$MAILBOX" | tail -1)
maestro --device "$UDID" test -e APP_ID="$APP_ID" -e CODE="$CODE" "$ROOT/maestro/signin-verify.yaml"
