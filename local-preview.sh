

#!/usr/bin/env bash

set -euo pipefail

PORT="${1:-8000}"
HOST="127.0.0.1"
URL="http://${HOST}:${PORT}/index.html"
PID_FILE=".local-preview-${PORT}.pid"
LOG_FILE=".local-preview-${PORT}.log"

is_ready() {
  curl -fsS -o /dev/null "$URL"
}

if is_ready; then
  echo "$URL"
  exit 0
fi

nohup python3 -m http.server "$PORT" --bind "$HOST" >"$LOG_FILE" 2>&1 &
SERVER_PID=$!
echo "$SERVER_PID" >"$PID_FILE"

for _ in $(seq 1 30); do
  if is_ready; then
    echo "$URL"
    exit 0
  fi
  sleep 0.2
done

echo "Failed to start local preview on $URL" >&2
exit 1
