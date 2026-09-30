#!/usr/bin/env bash
# ════════════════════════════════════════════════════════════════════════════
#  render-env.sh — genera el `.env` de producción a partir de las variables
#  inyectadas por Jenkins (credenciales del job) y valida que sea desplegable.
#
#  Los secretos NUNCA se guardan en el repo: Jenkins los entrega con
#  withCredentials y este script solo los escribe en el servidor, con umask
#  077 y sin imprimirlos. Si un valor falta, el script falla con el nombre de la
#  variable (nunca con su valor).
#
#  Uso ( Jenkins ):
#      DEPLOY_DIR=/opt/hub-platform deploy/render-env.sh
#
#  Variables requeridas (secretos, desde credenciales de Jenkins):
#      POSTGRES_PASSWORD, JWT_SECRET, JWT_REFRESH_SECRET, SEED_ADMIN_PASSWORD
#  Variables opcionales:
#      POSTGRES_USER, POSTGRES_DB, JWT_EXPIRES_IN, MAX_LOGIN_ATTEMPTS,
#      EXTERNAL_SYSTEMS_URL, EXPO_ACCESS_TOKEN, LOG_LEVEL,
#      APP_DASHBOARD_DOMAIN, APP_MOBILE_DOMAIN,
#      NEXT_PUBLIC_SUPPORT_WHATSAPP, NEXT_PUBLIC_SUPPORT_PHONE
# ════════════════════════════════════════════════════════════════════════════

set -euo pipefail

DEPLOY_DIR="${DEPLOY_DIR:-/opt/hub-platform}"
ENV_FILE="${ENV_FILE:-$DEPLOY_DIR/.env}"

POSTGRES_USER="${POSTGRES_USER:-hub_admin}"
POSTGRES_DB="${POSTGRES_DB:-hub_platform}"
JWT_EXPIRES_IN="${JWT_EXPIRES_IN:-1h}"
MAX_LOGIN_ATTEMPTS="${MAX_LOGIN_ATTEMPTS:-5}"
LOG_LEVEL="${LOG_LEVEL:-info}"

# Los hostnames públicos. Si no se pasan, se deduced del dominio del dashboard.
DASHBOARD_DOMAIN="${APP_DASHBOARD_DOMAIN:-soporte.serviredgane.cloud}"
MOBILE_DOMAIN="${APP_MOBILE_DOMAIN:-app.serviredgane.cloud}"

fail() { echo "ERROR: $1" >&2; exit 1; }

# ── Validación de secretos ────────────────────────────────────────────────
for var in POSTGRES_PASSWORD JWT_SECRET JWT_REFRESH_SECRET SEED_ADMIN_PASSWORD; do
  eval "value=\${$var:-}"
  [ -n "$value" ] || fail "$var no llego desde Jenkins (credencial vacia o ausente)"
done

[ "${#JWT_SECRET}" -ge 32 ]         || fail "JWT_SECRET debe tener al menos 32 caracteres"
[ "${#JWT_REFRESH_SECRET}" -ge 32 ] || fail "JWT_REFRESH_SECRET debe tener al menos 32 caracteres"
[ "$JWT_SECRET" != "$JWT_REFRESH_SECRET" ] || fail "JWT_SECRET y JWT_REFRESH_SECRET deben ser distintos"

# base64 (openssl rand -base64 24) produce 32 chars, hex -hex 32 produce 64.
[ "${#POSTGRES_PASSWORD}" -ge 16 ]  || fail "POSTGRES_PASSWORD debe tener al menos 16 caracteres"
[ "${#SEED_ADMIN_PASSWORD}" -ge 12 ] || fail "SEED_ADMIN_PASSWORD debe tener al menos 12 caracteres"

# ── DATABASE_URL se compone aquí, nunca se guarda como credencial ─────────
# Motivo: si el password de Postgres y el de DATABASE_URL se configuran por
# separado, un typo en uno de los dos produce un 500 por autenticación fallida
# en el contenedor api, mucho después del deploy.
DATABASE_URL="postgres://${POSTGRES_USER}:${POSTGRES_PASSWORD}@postgres:5432/${POSTGRES_DB}"

CORS_ORIGIN="https://${DASHBOARD_DOMAIN},https://${MOBILE_DOMAIN}"
ALLOWED_HOSTS="${DASHBOARD_DOMAIN},${MOBILE_DOMAIN}"

mkdir -p "$DEPLOY_DIR"

TMP_FILE="$(mktemp "${ENV_FILE}.XXXXXX")"
trap 'rm -f "$TMP_FILE"' EXIT

umask 077
cat > "$TMP_FILE" <<EOF
# GENERADO por deploy/render-env.sh — Jenkins $(date -u +%Y-%m-%dT%H:%M:%SZ)
# No editar a mano: se sobreescribe en cada deploy. Los secretos viven en las
# credenciales del job de Jenkins (deploy/CREDENCIALES-JENKINS.md).

# ── PostgreSQL ───────────────────────────────────────────────────────────
POSTGRES_USER=${POSTGRES_USER}
POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
POSTGRES_DB=${POSTGRES_DB}

# ── JWT ──────────────────────────────────────────────────────────────────
JWT_SECRET=${JWT_SECRET}
JWT_REFRESH_SECRET=${JWT_REFRESH_SECRET}
JWT_EXPIRES_IN=${JWT_EXPIRES_IN}

# ── API ──────────────────────────────────────────────────────────────────
NODE_ENV=production
PORT=3001
DATABASE_URL=${DATABASE_URL}
CORS_ORIGIN=${CORS_ORIGIN}
ALLOWED_HOSTS=${ALLOWED_HOSTS}
MAX_LOGIN_ATTEMPTS=${MAX_LOGIN_ATTEMPTS}
LOG_LEVEL=${LOG_LEVEL}

# ── Seed del admin (documento 123456789); solo si la BD aun no tiene admin ─
SEED_ADMIN_PASSWORD=${SEED_ADMIN_PASSWORD}

# ── Integraciones (vacias = modulo deshabilitado) ────────────────────────
EXTERNAL_SYSTEMS_URL=${EXTERNAL_SYSTEMS_URL:-}
EXPO_ACCESS_TOKEN=${EXPO_ACCESS_TOKEN:-}

# ── Build args de los frontends (publicables: viajan en el bundle) ───────
# EXPO_PUBLIC_API_URL llega como build arg a mobile/Dockerfile.web (tiene
# fail-fast si llega vacío). El navegador usa la ruta relativa /api.
# NEXT_PUBLIC_API_URL NO es público: solo es el destino del rewrite /api de
# Next (web/next.config.ts), que se hornea en el build. El edge enruta /api
# directo a api:3001, así que solo importa si se accede a `web` sin el edge.
EXPO_PUBLIC_API_URL=/api
NEXT_PUBLIC_API_URL=http://api:3001/api
NEXT_PUBLIC_SUPPORT_WHATSAPP=${NEXT_PUBLIC_SUPPORT_WHATSAPP:-https://wa.me/573000000000}
NEXT_PUBLIC_SUPPORT_PHONE=${NEXT_PUBLIC_SUPPORT_PHONE:-+57 300 000 0000}

# ── Deploy ───────────────────────────────────────────────────────────────
# APP_VERSION es el tag de las imágenes en Docker Hub. Lo escribe Jenkins con
# el sha del commit; docker compose lo usa para resolver la clave image: en
# deploy/docker-compose.prod.yml (sin ella usaría la etiqueta latest).
APP_VERSION=${APP_VERSION:-latest}
DOCKERHUB_NAMESPACE=${DOCKERHUB_NAMESPACE:-serviredgane}
EOF

mv "$TMP_FILE" "$ENV_FILE"
chmod 600 "$ENV_FILE"
trap - EXIT

# ── Verificación posterior: el archivo debe seguir siendo parseable ───────
# Solo se exige contenido en las claves obligatorias. EXTERNAL_SYSTEMS_URL y
# EXPO_ACCESS_TOKEN pueden quedar vacías a propósito (módulo deshabilitado) y
# quien las consume trata "" como "no configurado".
REQUIRED_KEYS="POSTGRES_USER POSTGRES_PASSWORD POSTGRES_DB DATABASE_URL \
JWT_SECRET JWT_REFRESH_SECRET JWT_EXPIRES_IN NODE_ENV PORT CORS_ORIGIN \
ALLOWED_HOSTS MAX_LOGIN_ATTEMPTS LOG_LEVEL SEED_ADMIN_PASSWORD APP_VERSION \
DOCKERHUB_NAMESPACE EXPO_PUBLIC_API_URL NEXT_PUBLIC_API_URL \
NEXT_PUBLIC_SUPPORT_WHATSAPP NEXT_PUBLIC_SUPPORT_PHONE"

missing=0
for key in $REQUIRED_KEYS; do
  grep -qE "^${key}=.+$" "$ENV_FILE" || { echo "ERROR: $key quedo vacio en $ENV_FILE" >&2; missing=1; }
done
[ "$missing" -eq 0 ] || fail "el .env generado tiene variables obligatorias vacias"

# Autocomprobación de coherencia: la URL debe apuntar al servicio `postgres` de
# la red interna con la misma contraseña declarada arriba.
grep -q "^DATABASE_URL=postgres://${POSTGRES_USER}:${POSTGRES_PASSWORD}@postgres:5432/${POSTGRES_DB}$" "$ENV_FILE" \
  || fail "DATABASE_URL no coincide con POSTGRES_USER/POSTGRES_PASSWORD/POSTGRES_DB"
# `openssl rand -base64` puede producir '=' al final; en la URL rompería el
# parseo del DSN. Se avisa para que se regenere el secreto.
case "$POSTGRES_PASSWORD" in
  *[!A-Za-z0-9._~-]*) echo "AVISO: POSTGRES_PASSWORD tiene caracteres que conviene URL-encodear en DATABASE_URL" >&2 ;;
esac

echo "OK: $ENV_FILE generado ($(wc -l < "$ENV_FILE") lineas, permisos $(stat -c '%a' "$ENV_FILE"))"
echo "    dominios: $CORS_ORIGIN"
echo "    secretos escritos: $(grep -cE '^(POSTGRES_PASSWORD|JWT_SECRET|JWT_REFRESH_SECRET|SEED_ADMIN_PASSWORD)=' "$ENV_FILE")"
