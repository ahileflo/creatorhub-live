#!/usr/bin/env bash
# Test end-to-end al întregii platforme, pe procese reale:
#   PostgreSQL + Redis (existente) → API + worker ingestie (Node) + worker procesare (Python)
#   → import catalog demo → test în browser (Playwright) ca un client real.
#
#   PG_ADMIN_URL=postgres://postgres@127.0.0.1:5432/postgres REDIS_URL=redis://127.0.0.1:6379 scripts/e2e.sh
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
: "${PG_ADMIN_URL:?set PG_ADMIN_URL}"
: "${REDIS_URL:?set REDIS_URL}"
PORT="${PORT:-8089}"
WORK="$(mktemp -d)"
DB="pbn_e2e_$(date +%s)"
PIDS=()

cleanup() {
  for p in "${PIDS[@]:-}"; do kill "$p" 2>/dev/null || true; done
  wait 2>/dev/null || true
  psql "$PG_ADMIN_URL" -qc "DROP DATABASE IF EXISTS $DB WITH (FORCE)" >/dev/null 2>&1 || true
  if [ "${KEEP_LOGS:-0}" != "1" ]; then rm -rf "$WORK"; else echo "logs: $WORK"; fi
}
trap cleanup EXIT

psql "$PG_ADMIN_URL" -qc "CREATE DATABASE $DB"
DB_URL="${PG_ADMIN_URL%/*}/$DB"
psql "$DB_URL" -v ON_ERROR_STOP=1 -q -f "$ROOT/db/schema.sql"

export NODE_ENV=development PORT PUBLIC_API_URL="http://localhost:$PORT" APP_URL="http://localhost:$PORT"
export DATABASE_URL="$DB_URL" REDIS_URL QUEUE_PREFIX="pbne2e$$"
export AUTH_JWT_SECRET="e2e-secret-e2e-secret-e2e-secret-0123456789"
export STORAGE_DRIVER=local LOCAL_STORAGE_DIR="$WORK/storage" LOG_LEVEL=WARNING

# API-ul și worker-ul de ingestie pornesc simultan; într-un checkout nou (CI) își creează
# cheia de dezvoltare în același timp, deci testul verifică și că ajung la aceeași cheie.
cd "$ROOT/api"
node src/server.js >"$WORK/api.log" 2>&1 & PIDS+=($!)
node src/workers/ingestWorker.js >"$WORK/ingest.log" 2>&1 & PIDS+=($!)
(cd "$ROOT/processing" && exec python3 -m pbn_worker) >"$WORK/worker.log" 2>&1 & PIDS+=($!)

for _ in $(seq 1 30); do curl -sf "http://localhost:$PORT/health" >/dev/null && break; sleep 1; done
curl -sf "http://localhost:$PORT/health" >/dev/null || { cat "$WORK/api.log"; exit 1; }

# Catalog demo: fotografii libere de drepturi incluse în scikit-image.
mkdir -p "$WORK/photos"
python3 - "$WORK/photos" <<'PY'
import sys
from PIL import Image
from skimage import data
for name in ("astronaut", "coffee", "chelsea"):
    Image.fromarray(getattr(data, name)()).save(f"{sys.argv[1]}/{name}.jpg", quality=92)
PY
node src/catalog/cli.js --theme demo --category diverse --from-dir "$WORK/photos" --approve >/dev/null

# Așteaptă procesarea catalogului (3 poze × 3 variante).
for _ in $(seq 1 120); do
  pending=$(psql "$DB_URL" -tAc "SELECT count(*) FROM processing_jobs WHERE status IN ('queued','running')")
  [ "$pending" = "0" ] && break
  sleep 2
done
bad=$(psql "$DB_URL" -tAc "SELECT count(*) FROM processing_jobs WHERE status <> 'succeeded'")
[ "$bad" = "0" ] || { echo "catalog jobs failed"; tail -50 "$WORK/worker.log"; exit 1; }

BASE_URL="http://localhost:$PORT" SHOTS_DIR="${SHOTS_DIR:-$WORK/shots}" node test/e2e-ui.mjs || {
  echo "--- api.log";    tail -40 "$WORK/api.log"
  echo "--- ingest.log"; tail -40 "$WORK/ingest.log"
  echo "--- worker.log"; tail -40 "$WORK/worker.log"
  exit 1
}
