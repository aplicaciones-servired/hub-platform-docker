# 🔧 FIXES PENDIENTES

Última actualización: 2026-08-20

## ✅ RESUELTOS (2026-08-20, ronda 9 — bucle infinito login↔dashboard)

- **Bucle infinito /login ↔ /dashboard ("se queda cargando, no me deja ingresar")** — El middleware del web redirigía `/login → /dashboard` (y `/user/login → /user/chat`) validando SOLO la firma del JWT, sin poder chequear `token_version`/`scopeVersion` contra la BD. Con una cookie `admin_token` de firma válida pero sesión invalidada (logout en otro dispositivo, bloqueo, reset password, bump global), el navegador quedaba atrapado: `/login` → 307 → `/dashboard` → `/auth/me` 401 → redirect a `/login` → 307 → … para siempre; el formulario jamás aparecía. Fix: el middleware ya no redirige desde los logins (siempre accesibles para re-autenticarse); la protección `/dashboard → /login` se mantiene.
- **La rotación de refresh del web NUNCA funcionaba (403 CSRF)** — `tryRefresh()` no enviaba `x-csrf-token`, pero el backend exigía CSRF en `POST /auth/refresh`. Como la cookie CSRF es httpOnly, tras un reload el navegador tampoco podía leerla: todo refresh daba 403 y la sesión se perdía en vez de rotar (expulsión silenciosa a la hora de vida del access token). Fix: `/auth/refresh` queda exento de CSRF (ya está protegido por cookies httpOnly sameSite; rotar la sesión del propio usuario no entrega nada a un atacante; mobile ya lo saltaba vía Bearer) y `tryRefresh` envía el header cuando lo tiene en memoria. Test de csrf actualizado.
- **Refresh sin cookie dejaba el access token muerto vivo** — El branch `!refreshToken` del refresh no limpiaba cookies: un `admin_token` con firma válida pero versión inválida quedaba en el navegador eternamente (combustible del bucle). Ahora `clearTokenCookies` también ahí.
- Verificado en vivo: cookie stale en `/login` → 200 (formulario visible, antes 307); refresh sin csrf → 200 con rotación (antes 403); refresh sin cookie → 401 + cookies limpiadas; login → dashboard → KPIs 200; `/dashboard` sin cookie sigue redirigiendo a `/login`. Tests: backend 180/180, web 47/47.

## ✅ RESUELTOS (2026-08-20, ronda 8)

- **Modal "Nuevo Ticket" del dashboard: campos muertos** — Los campos Nombre/Documento se ignoraban y el ticket quedaba atribuido al admin autenticado (el usuario real nunca lo veía ni recibía notificaciones). Ahora: el admin pasa el `documento` del usuario real y el ticket queda atribuido a él (verificado end-to-end: el usuario lo ve en su historial). Documento inexistente → 404 con mensaje claro en el campo. Un usuario NORMAL que mande `documento` ajeno lo ignora y el ticket queda suyo (no puede robar identidad ni spamear tickets a otros).
- **Acciones del dashboard fallan en silencio** — `handleStatusChange`/`handleAssignAgent`/`handleViewDetail` ahora avisan con alert visible y recargan la tabla al fallar (el 409 de estado concurrente ya no deja la tabla inconsistente).
- **Cron de backup instalable** — `./scripts/backup-db.sh --install-cron` agrega el backup diario a las 3 AM al crontab (idempotente; también acepta `--status`).

## ✅ RESUELTOS (2026-08-20, ronda 7 — mezcla de sesiones PWA/dashboard)

- **Sesiones mezcladas entre PWA y dashboard (3 causas)** — El navegador NO distingue puertos: `localhost:3000` (web) y `localhost:8081` (PWA) comparten todas las cookies. Fixes:
  1. **Scope staledo en web** — `getCurrentScope()` derivaba de una variable de módulo que se actualizaba tarde (efectos hijos corren antes que el del AuthProvider): al navegar de `/user/*` al dashboard, los primeros requests salían con `X-Auth-Scope: user` y el backend leía la cookie `user_token` de la PWA → la sesión de la PWA aparecía en el dashboard. Ahora SIEMPRE deriva del path actual (`web/lib/api.ts`).
  2. **Fallback cross-scope en backend** — `extractToken`/`extractRefreshToken` escaneaban TODAS las cookies (admin→user→legacy) cuando el request no traía header: cualquier request sin header tomaba la sesión que fuera. Ahora: Bearer → cookie del scope/cliente EXPLÍCITO → cookie legacy sin scope. Nada de escaneo (`backend/lib/jwt.ts`).
  3. **Cookies propias para la PWA** — La PWA y el área de usuario del web usaban las MISMAS cookies (`user_token`/`user_refreshToken`) en el mismo dominio: se pisaban entre sí y el logout de una mataba la otra. Ahora la PWA envía `X-Auth-Client: mobile` en todos sus requests y sus cookies son `mobile_token`/`mobile_refreshToken`. Aislamiento total: dashboard (admin_*), web user (user_*), PWA (mobile_*).
- Verificado en vivo: cookies de la PWA no autentican requests del dashboard (401), cliente mobile no lee cookies del web (401), rotación de refresh funciona por cliente, 13 tests nuevos de aislamiento en `jwt.test.ts` (176/176).

## ✅ RESUELTOS (2026-08-20, ronda 6)

- **Falso robo de refresh token** — Si fallaba el INSERT en `refresh_tokens` (login/registro/rotación), se entregaba igual la cookie con jti y el próximo refresh lo interpretaba como reuso → revocaba TODAS las sesiones por un fallo transitorio. Ahora la persistencia es obligatoria: login/registro limpian cookies + 500 si falla; en rotación cierra esa sesión con 401. La higiene de filas expiradas quedó separada (no fatal).
- **23505 → 409 en duplicados (admin)** — Nuevo helper `lib/pg.ts` (`isUniqueViolation`). `createUser`/`updateUser` devuelven 409 si pierden la carrera contra el unique global de documento; `createRating` 409 por rating duplicado; `registerToken` de push trata el duplicado como éxito (idempotente).
- **Filtros de fecha en TZ Colombia** — Nuevo `lib/dates.ts` (`colombiaDayStart/End` con offset fijo -05:00, Colombia no tiene DST). `listIncidents`, `exportIncidents`, stats y `getKpis` ya no incluyen tickets de 19:00–23:59 del día anterior por interpretar la fecha en UTC.
- **Búsqueda de tickets con debounce** — `dashboard/tickets` usa el mismo patrón que users: debounce 350ms + reset a página 1. Ya no dispara un GET por tecla (antes podía agotar el rate limiter).
- **TOCTOU en cambio de estado** — El UPDATE de `updateIncident` ahora condiciona `WHERE estado = <leído>`; dos PATCH concurrentes a "resuelto" ya no duplican mensaje bot + push. El perdedor recibe 409 con el estado actual.
- **Rama muerta en rating duplicado (mobile)** — `ChatScreen` comparaba "Ya has calificado" pero el backend responde "Este ticket ya fue calificado"; ahora matchea ambos y marca el ticket como calificado.
- **`ALLOWED_HOSTS` en compose** — El api ahora recibe `ALLOWED_HOSTS: ${ALLOWED_HOSTS:-}`; antes la allowlist quedaba vacía aunque se definiera en `.env`.
- **`JWT_EXPIRES_IN` config muerta** — `config/env.ts` la lee (default "1h") y `signToken` la usa; la cookie del access token vence sincronizada con el `exp` real del JWT. Default de compose corregido a `1h` (era `24h` sin efecto; al activarse habría triplicado la vida del token).

## ✅ RESUELTOS (2026-08-19)

- **Rotación de refresh tokens** — Nueva tabla `refresh_tokens` (migración 0018): cada refresh emitido se persiste con `jti` + hash sha256. `POST /auth/refresh` rota de forma atómica (`UPDATE ... WHERE revoked_at IS NULL`); si un JWT válido presenta una fila ya revocada → reuso detectado (robo) y se revocan TODAS las sesiones del usuario + bump de `token_version` global. Higiene: limpieza de filas expiradas en cada rotación.
- **Logout aislado real** — Columnas `token_version_admin` / `token_version_user` en `users`. El JWT lleva `scope` + `scopeVersion`; el logout bumpea SOLO la versión del scope y revoca las filas de refresh de ese scope. Cerrar sesión en mobile ya no mata el dashboard (y viceversa). Los bumps globales (bloqueo, reset password, cambio de rol) siguen matando ambos scopes.
- **Rating con `ticketId` estructurado** — Columna `metadata` jsonb en `messages`: la notificación de "Resuelto" y las respuestas sobre tickets guardan `{ ticketId }`. `POST /chat/message` devuelve `ticketId` y `GET /chat/history` expone `metadata`. Web y mobile usan `ticketId` directo; el parseo `#TK` queda como fallback solo para mensajes antiguos.
- **Paginación server-side de usuarios (web)** — `dashboard/users` ahora pagina en el servidor (`page`/`limit`/`search`) con búsqueda debounced. Nuevo campo `counts` en `GET /users` (distribución por rol sin filtros) para las tarjetas de resumen. El banner de ">200 usuarios" se eliminó por innecesario.
- **Registro con documento soft-deleted (bug preexistente)** — El check de duplicados filtraba `deleted_at` pero el unique constraint de la BD es global → 500. Ahora devuelve 409.

## ✅ RESUELTOS (rondas anteriores, verificados)

- Middleware JWT web fail-closed, settings race condition, getStats en SQL, export limit, error handling Zod/23505, cache invalidation mobile, chat ticket lookup `=`.
- Técnico no crea usuarios ni resetea passwords; desbloquear reinicia intentos; contador atómico; rating al dueño del ticket; notificación sin 500 tardío; redirects por scope; stale closure; password mínima; npm ci; seed en Render; EXPO token y logs; script de backup.
- Rol desde JWT firmado (sin cookies de rol); mobile sin conexión no desloguea; rating requiere `#TK`; push unregister en logout; sharp pineado; no-new-privileges.
- Host header allowlist (`ALLOWED_HOSTS`), anti-enumeración login, bcrypt 12, índice `users.documento`, escalación de privilegios cerrada, métricas acotadas, auto-unlock.

## 🔴 PENDIENTES — Requieren decisión de diseño

- **CSP unsafe-inline** — `mobile/nginx.conf` **resuelto**: `style-src 'self' 'unsafe-inline'`. React Native Web inyecta los estilos en runtime (`createSheet`, `configureWebLayoutAnimations`) y el `@font-face` vía `loadSingleFontAsync`; como `app/_layout.tsx` hace `return null` hasta que `useFonts` resuelve, bloquearlos dejaba la PWA en blanco. El `<style>`/`<script>` inline estático sí se externaliza en el build (`extract-inline.sh`), y `script-src 'self'` se mantiene estricto. Pendiente solo `backend/src/index.ts:56` `styleSrc`, que es inerte mientras el backend sirva únicamente JSON.

## 🟡 PENDIENTES — Mejoras no urgentes

- **Hardening extra de contenedores** — `cap_drop: [ALL]`, `read_only` + tmpfs en `docker-compose.yml` (requiere probar cada servicio; postgres usa gosu y nginx necesita setuid, quedan excluidos a propósito).
- **Historial de usuario sin paginación** — `web/user/historial` y `mobile/historial` piden `?limit=50` sin "cargar más"; un usuario con >50 tickets no puede ver los antiguos.
- **Uploads huérfanos sin GC** — El soft-delete de incidentes no borra `imagen_url` ni el archivo; sin job de limpieza el tope de 500MB se llena de huérfanos.

## 🟢 OPERATIVOS (fuera del código)

- **Cron de backup** — `scripts/backup-db.sh --install-cron` agrega el backup diario a las 3 AM (idempotente).
- **Rotar secrets locales** — `.env` local usa `SEED_ADMIN_PASSWORD` débil. Si ese entorno fue accesible, rotar todos los secrets. Permisos de `.env*` ya en `600`.

## Refutado durante auditoría (no es problema)

- PWA móvil en Docker: ~~"el bundle tiene `/api` inline"~~ **REFUTACIÓN INCORRECTA** — `**/.env` del `.dockerignore` raíz SÍ excluye `mobile/.env` del contexto de build (verificado con build de prueba), por lo que el bundle se generaba sin la variable y fallaba en runtime. Corregido (2026-08-20): `Dockerfile.web` recibe `EXPO_PUBLIC_API_URL` como build arg (default `/api`), igual que hace `web` con `NEXT_PUBLIC_*`.
- La imagen del API NO contiene secrets (`/app` sin `.env`).
