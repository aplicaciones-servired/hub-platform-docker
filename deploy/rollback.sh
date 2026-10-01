#!/usr/bin/env bash
# ════════════════════════════════════════════════════════════════════════════
#  rollback.sh — vuelve al tag de imágenes anterior y recrea los contenedores.
#
#  Uso:  deploy/rollback.sh            → vuelve a DEPLOY_DIR/.last-good
#         deploy/rollback.sh <sha>     → vuelve a un sha concreto
#
#  AVISO: esto revierte CÓDIGO, no la base de datos. Las migraciones de Drizzle
#  son forward-only: si el deploy falló después de que `api` corriera las
#  migraciones (el entrypoint las ejecuta en cada arranque), la BD queda en el
#  esquema nuevo y la versión anterior del backend puede no arrancar contra él.
#  Las migraciones de este repo son aditivas (IF NOT EXISTS), por eso el
#  escenario normal —error de runtime o de build— sí es reversible.
# ════════════════════════════════════════════════════════════════════════════

set -euo pipefail

DEPLOY_DIR="${DEPLOY_DIR:-/opt/hub-platform}"
COMPOSE_PROJECT="${COMPOSE_PROJECT:-hub}"
ENV_FILE="$DEPLOY_DIR/.env"
LAST_GOOD_FILE="$DEPLOY_DIR/.last-good"
NAMESPACE="${IMAGE_NAMESPACE:-hub-platform}"
SERVICES=(api web mobile)

fail() { echo "ERROR: $1" >&2; exit 1; }

TARGET="${1:-}"
if [ -z "$TARGET" ]; then
  [ -f "$LAST_GOOD_FILE" ] || fail "no hay registro de un deploy anterior ($LAST_GOOD_FILE)"
  TARGET="$(cat "$LAST_GOOD_FILE")"
fi
[ -n "$TARGET" ] || fail "no se pudo determinar la version objetivo"
[ -f "$ENV_FILE" ] || fail "no existe $ENV_FILE"

CURRENT="$(grep -E '^APP_VERSION=' "$ENV_FILE" | cut -d= -f2- || true)"
[ "$CURRENT" != "$TARGET" ] || { echo "Ya esta en $TARGET; nada que revertir."; exit 0; }

echo "Revirtiendo $CURRENT → $TARGET"

# Las imagenes anteriores deben seguir en el daemon. No hay registro del que
# volver a bajarlas: si el prune las borro, el rollback es imposible y hay que
# re-ejecutar el pipeline sobre el sha viejo (APP_VERSION=<sha>).
missing=0
for svc in "${SERVICES[@]}"; do
  if ! docker image inspect "${NAMESPACE}/hub-${svc}:${TARGET}" >/dev/null 2>&1; then
    echo "  FALTA ${NAMESPACE}/hub-${svc}:${TARGET} en el daemon local" >&2
    missing=1
  fi
done
[ "$missing" -eq 0 ] || fail "no se puede revertir: imagenes anteriores ausentes (el prune las borro; relanza el pipeline con APP_VERSION=$TARGET)"

# Backup antes de tocar nada: revertir tambien puede ejecutar migraciones.
if [ "${SKIP_BACKUP:-0}" != "1" ] && docker ps --format '{{.Names}}' | grep -qx 'hub-postgres'; then
  BACKUP_DIR="$DEPLOY_DIR/backups" "$DEPLOY_DIR/scripts/backup-db.sh" || echo "AVISO: el backup fallo, continuando" >&2
fi

sed -i.bak -E "s|^APP_VERSION=.*|APP_VERSION=${TARGET}|" "$ENV_FILE" && rm -f "${ENV_FILE}.bak"

cd "$DEPLOY_DIR"
docker compose -p "$COMPOSE_PROJECT" \
  -f docker-compose.yml -f deploy/docker-compose.prod.yml \
  --env-file .env up -d --no-build --remove-orphans

for i in $(seq 1 30); do
  if curl -sf --max-time 5 http://127.0.0.1:3001/api/health >/dev/null 2>&1; then
    echo "OK: revertido a ${TARGET}"
    exit 0
  fi
  sleep 2
done

fail "la API no responde tras revertir; revisa 'docker compose -p ${COMPOSE_PROJECT} logs --tail=100 api'"
