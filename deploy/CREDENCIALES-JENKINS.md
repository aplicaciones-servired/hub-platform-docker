# Credenciales y variables para Jenkins

Los secretos **no viven en el repo**. Jenkins los entrega al pipeline con
`withCredentials` y `deploy/render-env.sh` los escribe en
`/opt/hub-platform/.env` (permisos `600`) en cada deploy. El `.env` está en
`.gitignore` y nunca se sube.

## 1. Credenciales que debes crear en Jenkins

*Manage Jenkins → Credentials → System → Global credentials → Add Credentials*

| ID (credentialsId) | Tipo | Qué es | Cómo generarlo |
|--------------------|------|--------|----------------|
| `hub-dockerhub` | Username with password | Usuario de Docker Hub + **Access Token** (no la contraseña de la cuenta) | Docker Hub → Account Settings → Personal access tokens → Read/Write |
| `hub-postgres-password` | Secret text | Contraseña de PostgreSQL | `openssl rand -base64 24` |
| `hub-jwt-secret` | Secret text | Firma de los JWT (>= 32 chars) | `openssl rand -hex 32` |
| `hub-jwt-refresh-secret` | Secret text | Firma de los refresh (**distinto** del anterior) | `openssl rand -hex 32` |
| `hub-seed-admin-password` | Secret text | Contraseña inicial del admin `123456789` | `openssl rand -hex 16` |
| `hub-expo-access-token` | Secret text | Push notifications Expo (opcional) | cuenta Expo → Access Token |
| `hub-external-systems-url` | Secret text | URL de login del sistema externo (opcional) | la que.use el negocio |

Marca las de tipo *Secret text* como **Sensitive** para que Jenkins no las
permita en la consola, y déjalas en scope **Global** (o en la carpeta del job,
si prefieres aislarlas por job; entonces ajusta los IDs en el `Jenkinsfile`).

`DATABASE_URL` **no** es una credencial: la compone `render-env.sh` a partir de
`POSTGRES_USER` + `POSTGRES_PASSWORD`. Así es imposible que la contraseña del
compose y la de la URL diverjan.

### Crearlas todas de golpe (alternativa)

`deploy/credentials.groovy` las crea o actualiza desde el Script Console, leyendo
los valores de propiedades globales de Jenkins (`HUB_POSTGRES_PASSWORD`,
`HUB_JWT_SECRET`, …). Es idempotente. `hub-dockerhub` hay que crearla a mano
porque requiere usuario + token.

## 2. Variables que NO son secretas (parámetros del job)

Ya están como `parameters` del `Jenkinsfile`, se cambian desde
*This build with parameters* sin tocar código:

| Parámetro | Por defecto | Para qué |
|-----------|-------------|-----------|
| `APP_VERSION` | (vacío → sha del commit) | Tag a desplegar. Allows rollback manual a un sha anterior |
| `RUN_TESTS` | `true` | Backend + web + mobile antes de publicar |
| `REGISTRY_CACHE` | `true` | Inline cache en Docker Hub (acelera builds) |
| `SKIP_BACKUP` | `false` | Saltar el `pg_dump` previo |
| `DRY_RUN` | `false` | Publica imágenes sin tocar producción |
| `SUPPORT_WHATSAPP` | `https://wa.me/573000000000` | **Va incrustado en el bundle** |
| `SUPPORT_PHONE` | `+57 300 000 0000` | **Va incrustado en el bundle** |

Los dos últimos son build args: cambian el bundle del frontend, así que
**cambiarlos exige un rebuild**, no solo un reinicio de contenedores.

Si prefieres sacarlos del job, están como constantes en el bloque `environment`
del `Jenkinsfile`: `DEPLOY_DIR`, `COMPOSE_PROJECT`, `DOCKERHUB_NAMESPACE`,
`COMPOSE_FILES`, `APP_DASHBOARD_DOMAIN`, `APP_MOBILE_DOMAIN`, `NODE_IMAGE`.

## 3. Variables que write el pipeline en `/opt/hub-platform/.env`

Las genera `deploy/render-env.sh`. No hay que crearlas a mano, pero esta es la
lista completa y su origen:

| Variable | Origen | Obligatoria |
|----------|--------|-------------|
| `POSTGRES_USER`, `POSTGRES_DB` | constantes (`hub_admin`, `hub_platform`) | sí |
| `POSTGRES_PASSWORD` | credencial `hub-postgres-password` | sí |
| `DATABASE_URL` | compuesta por el script | sí |
| `JWT_SECRET`, `JWT_REFRESH_SECRET` | credenciales | sí |
| `JWT_EXPIRES_IN` | constante (`1h`) | sí |
| `NODE_ENV`, `PORT`, `MAX_LOGIN_ATTEMPTS`, `LOG_LEVEL` | constantes | sí |
| `CORS_ORIGIN`, `ALLOWED_HOSTS` | derivadas de los dominios del job | sí |
| `SEED_ADMIN_PASSWORD` | credencial `hub-seed-admin-password` | sí |
| `EXTERNAL_SYSTEMS_URL` | credencial (opcional) | no |
| `EXPO_ACCESS_TOKEN` | credencial (opcional) | no |
| `EXPO_PUBLIC_API_URL` | constante (`/api`) — build arg del PWA | sí |
| `NEXT_PUBLIC_SUPPORT_WHATSAPP` / `_PHONE` | parámetros del job | sí |
| `APP_VERSION` | sha del commit / parámetro | sí |
| `DOCKERHUB_NAMESPACE` | constante (`serviredgane`) | sí |

`CORS_ORIGIN` y `ALLOWED_HOSTS` se derivan de `APP_DASHBOARD_DOMAIN` y
`APP_MOBILE_DOMAIN`: si añades un dominio, cambia **las dos variables** en el
bloque `environment` del `Jenkinsfile`. Olvidar `ALLOWED_HOSTS` no rompe nada
inmediato (solo affecta al redirect HTTP→HTTPS del backend), pero sí expone el
backend a Host headers ajenos.

## 4. Requisitos del agente

- Docker Engine + Compose **v2.24+** (el override usa `!reset`).
- El usuario del agente en el grupo `docker`: `sudo usermod -aG docker jenkins`
  y **reiniciar el agente** (un simple reload no refresca los grupos del proceso).
- `rsync` instalado (el deploy sincroniza el workspace con `/opt/hub-platform`).
- La red externa **`red-gane-int` debe existir**: `docker network create red-gane-int`.
  Es la red compartida con el túnel de Cloudflare y el resto de infraestructura.
  El Jenkinsfile la comprueba en la etapa *Preparar* para fallar antes de
  construir imágenes, en vez de abortar en el deploy con un error de compose.
- Plugins: solo `credentials-binding`. Todo lo demás es core, a propósito —
  `ansiColor` y otros plugins no estándar semeterían una dependencia que puede
  romper el job en una instalación limpia.

## 4.1 Cómo quedan las redes

| Servicio | Redes | Comentario |
|----------|-------|------------|
| `postgres` | `db` (interna) | **Nunca** se une a `red-gane-int`: el pipeline aborta si lo hace |
| `api` | `db`, `app`, `red-gane-int` | |
| `web` | `app`, `red-gane-int` | |
| `mobile` | `app`, `red-gane-int` | |
| `edge` | `app`, `red-gane-int` | Único punto de entrada; sin puertos en el host |

El túnel de Cloudflare entra a `hub-edge:8080` por DNS interno. Nada del stack
escucha en la IP pública.

Consecuencia de seguridad a tener presente: `api` en `red-gane-int` significa que
**cualquier contenedor de esa red puede llamar al backend** sin pasar por nginx
(sin rate limit del edge, aunque el backend sí tiene el suyo). Es aceptable si
los servicios de la red son de confianza; si no lo son, quita `red-gane-int` de
`api` en `deploy/docker-compose.prod.yml` y deja que el túnel entre solo por el
`edge` (que sigue resolviendo `api:3001` por la red interna `app`).

## 5. Cloudflare Tunnel

El pipeline **no** toca el túnel (eso es infraestructura, no aplicación).
Instrucciones completas en `deploy/cloudflared/config.yml`; el resumen:

```bash
sudo mkdir -p /etc/cloudflared
docker network create red-gane-int
cloudflared tunnel login && cloudflared tunnel create hub-platform
cloudflared tunnel route dns hub-platform
# Editar /etc/cloudflared/config.yml con el tunnel ID, luego:
docker run -d --name cloudflared-hub --restart unless-stopped \
    --network red-gane-int -v /etc/cloudflared:/etc/cloudflared:ro \
    cloudflare/cloudflared:latest tunnel --no-autoupdate run hub-platform
```

En el panel de Cloudflare: *SSL/TLS → Full (strict)* y *Always Use HTTPS → ON*.
El edge no valida certificados porque no termina TLS.

## 6. Primer despliegue

```bash
# 1. Una sola vez, en el servidor:
docker network create red-gane-int
sudo mkdir -p /opt/hub-platform && sudo chown -R jenkins:jenkins /opt/hub-platform

# 2. Crear las credenciales en Jenkins (sección 1).

# 3. Lanzar el job. Si DNS/Túnel aún no apuntan al servidor, el stage
#    "Verificar despliegue" falla en las comprobaciones públicas: es esperado.
#    Usa DRY_RUN=true para publicar imágenes sin tocar nada.
```

## 7. Rollback

```bash
sudo -u jenkins -H bash -lc 'cd /opt/hub-platform && ./deploy/rollback.sh'            # al último .last-good
sudo -u jenkins -H bash -lc 'cd /opt/hub-platform && ./deploy/rollback.sh <sha>'      # a un sha concreto
```

Revierte **código**, no la base de datos: las migraciones son forward-only. Si el
deploy falló después de que `api` corriera las migraciones, la BD queda en el
esquema nuevo; las migraciones de este repo son aditivas (`IF NOT EXISTS`), así
que el escenario habitual (error de build o de runtime) sí es reversible.

## 8. Operación diaria

```bash
cd /opt/hub-platform
docker compose -p hub -f docker-compose.yml -f deploy/docker-compose.prod.yml --env-file .env ps
docker compose -p hub -f docker-compose.yml -f deploy/docker-compose.prod.yml --env-file .env logs -f --tail=100

# Recargar nginx tras tocar nginx/conf.d/ (montado como bind mount):
docker compose -p hub exec edge nginx -t && docker compose -p hub exec edge nginx -s reload

# Probar el edge desde la red compartida, igual que el túnel:
docker run --rm --network red-gane-int nginx:1.27-alpine \
    wget -qO- --header="Host: app.serviredgane.cloud" http://hub-edge:8080/api/health

# Comprobar a qué redes está cada contenedor:
docker inspect -f '{{range $k, $v := .NetworkSettings.Networks}}{{$k}} {{end}}' hub-edge

# Backup manual
BACKUP_DIR=/opt/hub-platform/backups ./scripts/backup-db.sh

# Actualizar a un sha concreto sin pasar por Jenkins
docker compose -p hub ... pull && docker compose -p hub ... up -d --no-build
```

Backup diario automático:

```bash
sudo crontab -e
# 0 3 * * * cd /opt/hub-platform && BACKUP_DIR=/opt/hub-platform/backups ./scripts/backup-db.sh >> /opt/hub-platform/backups/cron.log 2>&1 # hub-backup
```

## 9. Lo que este pipeline NO hace a propósito

- **No rota `JWT_SECRET`**: `web` y `api` deben compartir el mismo valor, porque
  el middleware de Next verifica la firma de las cookies admin. El valor llega a
  los dos contenedores por entorno (no por build), así que rotarlo solo
  requiere recrearlos juntos y reinicia todas las sesiones.
- **No aplica migraciones manualmente**: el entrypoint de `api` corre
  `migrate` + `seed` en cada arranque. Si alguna vez se las saca de ahí, el
  pipeline necesita un stage propio.
- **No expone `/api/metrics` ni `/api/health/db`**: exigen cookie admin. Para
  monitorización externa usar `/api/health` (lo sirve el edge sin sesión).
