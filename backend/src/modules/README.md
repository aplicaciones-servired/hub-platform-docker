# Módulos del Backend

Documentación de los 11 módulos en `backend/src/modules/`.

Cada módulo sigue el patrón:

```
modules/<nombre>/
├── <nombre>.controller.ts   # Lógica de negocio (handlers HTTP)
├── <nombre>.routes.ts       # Definición de rutas + middlewares
├── <nombre>.schema.ts       # Validación Zod (opcional)
└── <nombre>.controller.test.ts  # Tests unitarios (Vitest)
```

Convenciones comunes:

- **Auth:** `authMiddleware` (JWT desde cookies/header) + `adminOnly` para rutas de admin/técnico.
- **Rate limiting:** los módulos sensibles (auth, incidents, push) limitan intentos por minuto.
- **Errores:** siempre `logger.error` + respuesta JSON `{ error }` sin exponer detalles internos.
- **Soft deletes:** `deleted_at` filtra registros eliminados en `users` e `incidents`.

---

## 1. auth

Autenticación y gestión de sesiones aisladas (dashboard/mobile).

**Archivos:** `auth.controller.ts`, `auth.routes.ts`, `auth.schema.ts`, `auth.controller.test.ts`, `auth.schema.test.ts`

| Método | Ruta | Auth | Límite/min | Descripción |
|--------|------|:---:|:---:|---|
| POST | `/api/auth/register` | No | 10 | Registrar usuario (rol `user`) |
| POST | `/api/auth/login` | No | 10 | Login con scope `admin`/`user` |
| GET | `/api/auth/me` | Sí | — | Usuario autenticado + CSRF |
| POST | `/api/auth/refresh` | No | 30 | Renovar token (refresh) |
| POST | `/api/auth/logout` | Sí | 30 | Logout aislado por scope |

**Comportamiento clave:**
- Login bloquea el usuario tras `MAX_LOGIN_ATTEMPTS` (5) intentos fallidos y resetea el contador al acertar.
- Registro genera email automático `<documento>@<EMAIL_DOMAIN>` y hashea con bcrypt (10 rondas).
- Tokens JWT en cookies httpOnly con scope (`admin_token`/`user_token`); logout solo limpia su scope.

---

## 2. incidents

CRUD de tickets/incidentes con comentarios, estadísticas y notificaciones push/chat.

**Archivos:** `incidents.controller.ts`, `incidents.routes.ts`, `incidents.schema.ts`, `incidents.controller.test.ts`, `incidents.schema.test.ts`

| Método | Ruta | Auth | Admin | Descripción |
|--------|------|:---:|:---:|---|
| POST | `/api/incidents` | Sí | No | Crear incidente |
| GET | `/api/incidents` | Sí | No | Listar (paginado + filtros) |
| GET | `/api/incidents/technicians` | Sí | Sí | Listar técnicos activos para asignación |
| GET | `/api/incidents/agentes` | Sí | Sí | Lista de agentes |
| GET | `/api/incidents/stats` | Sí | Sí | Estadísticas (timeline, distribución, estados) |
| GET | `/api/incidents/export-data` | Sí | Sí | Exportar incidentes + comentarios |
| GET | `/api/incidents/unread-count` | Sí | Sí | No leídos (pendientes sin ver) |
| PATCH | `/api/incidents/mark-seen` | Sí | Sí | Marcar pendientes como vistos |
| GET | `/api/incidents/:id` | Sí | No | Detalle + comentarios |
| PATCH | `/api/incidents/:id` | Sí | Parcial | Admin asigna técnicos; técnico actualiza sus tickets asignados |
| DELETE | `/api/incidents/:id` | Sí | Sí | Soft delete |
| POST | `/api/incidents/:id/comments` | Sí | No | Agregar comentario |

**Comportamiento clave:**
- Transiciones de estado validadas: `pendiente → en_proceso/resuelto`, `en_proceso → resuelto`.
- Administradores ven todos los incidentes; cada técnico solo ve y comenta los que tiene asignados. Los demás usuarios ven y comentan los propios.
- Al resolver o comentar (admin/técnico): inserta mensaje del bot en el chat y envía push al dueño vía Expo.
- `visto_por_admin` controla el contador de notificaciones del dashboard.

---

## 3. chat

Chatbot de soporte (7 intenciones) con detección por palabras clave.

**Archivos:** `chat.controller.ts`, `chat.routes.ts`, `chat.schema.ts`, `chat.controller.test.ts`, `chat.schema.test.ts`

| Método | Ruta | Auth | Descripción |
|--------|------|:---:|---|
| POST | `/api/chat/message` | Sí | Enviar mensaje al bot |
| GET | `/api/chat/history` | Sí | Historial (límite 200, paginado) |

**Intenciones:** `problema_sistema`, `problema_hardware`, `problema_pv`, `problema_acceso`, `consultar_estado`, `faq`, `reportar`. Cada una devuelve `text`, `actions` y/o `autoAction` para navegar en la app.

**Comportamiento clave:**
- Detección por patrones (`INTENT_PATTERNS`) + menú principal + respuesta por defecto si no entiende.
- Busca tickets por código corto `#TK-XXXX` y responde estado/fecha del incidente.

---

## 4. dashboard

KPIs y resumen ejecutivo para el panel administrativo.

**Archivos:** `dashboard.controller.ts`, `dashboard.routes.ts`, `dashboard.schema.ts`, `dashboard.controller.test.ts`, `dashboard.schema.test.ts`

| Método | Ruta | Auth | Admin | Descripción |
|--------|------|:---:|:---:|---|
| GET | `/api/dashboard/kpis` | Sí | Sí | Contadores (incidentes, estados, urgencias, usuarios) |
| GET | `/api/dashboard/summary` | Sí | Sí | Resumen completo (hoy, total, resolución, tendencia 7 días, recientes) |

**Comportamiento clave:**
- Fechas calculadas en zona horaria `America/Bogota`.
- Resolución promedio en horas desde `fecha_cierre`; tendencia de 7 días en una sola query.

---

## 5. external-systems

Redirect seguro a sistemas externos (auth + admin) sin exponer URLs al frontend.

**Archivos:** `external-systems.controller.ts`, `external-systems.routes.ts`, `external-systems.controller.test.ts`

| Método | Ruta | Auth | Admin | Descripción |
|--------|------|:---:|:---:|---|
| GET | `/api/external-systems/:module` | Sí | Sí | Redirect 302 al sistema externo configurado |

**Comportamiento clave:**
- El mapa `MODULES` resuelve `traslados` → `env.EXTERNAL_SYSTEMS_URL`.
- Módulo no configurado → 404. Requiere login (401) y rol admin/técnico (403).

---

## 6. puntos-venta

Catálogo de puntos de venta para autocompletado.

**Archivos:** `puntos-venta.controller.ts`, `puntos-venta.routes.ts`, `puntos-venta.controller.test.ts`

| Método | Ruta | Auth | Admin | Descripción |
|--------|------|:---:|:---:|---|
| GET | `/api/puntos-venta` | Sí | No | Listar (búsqueda por nombre, máx. 100) |
| POST | `/api/puntos-venta/seed` | Sí | Sí | Insertar catálogo desde `PV_SEED_NAMES` (idempotente) |

---

## 7. push

Registro de tokens de notificaciones push (Expo).

**Archivos:** `push.controller.ts`, `push.routes.ts`, `push.schema.ts`, `push.controller.test.ts`, `push.schema.test.ts`

| Método | Ruta | Auth | Límite/min | Descripción |
|--------|------|:---:|:---:|---|
| POST | `/api/push/register` | Sí | 10 | Registrar token del usuario autenticado |

**Comportamiento clave:**
- Verifica el owner antes de reasignar: token ya usado por otro usuario → 409.

---

## 8. ratings

Calificaciones de tickets resueltos (1-5) con estadísticas.

**Archivos:** `ratings.controller.ts`, `ratings.routes.ts`, `ratings.schema.ts`, `ratings.controller.test.ts`, `ratings.schema.test.ts`

| Método | Ruta | Auth | Admin | Descripción |
|--------|------|:---:|:---:|---|
| GET | `/api/ratings/stats` | No | No | Stats públicas (promedio, distribución, por PDV) |
| POST | `/api/ratings/:id` | Sí | No | Calificar incidente resuelto |
| GET | `/api/ratings/my-ratings` | Sí | No | IDs de incidentes ya calificados |
| GET | `/api/ratings/:id` | Sí | No | Calificación de un incidente |
| GET | `/api/ratings` | Sí | Sí | Stats admin (incluye evolución y últimas) |

**Comportamiento clave:**
- Solo tickets `resuelto`; una calificación por usuario/incidente (409 en duplicado); CHECK constraint 1-5 en BD.

---

## 9. settings

Configuración de la empresa (nombre, contribuyente, dirección).

**Archivos:** `settings.controller.ts`, `settings.routes.ts`, `settings.controller.test.ts`

| Método | Ruta | Auth | Admin | Descripción |
|--------|------|:---:|:---:|---|
| GET | `/api/settings` | Sí | No | Obtener configuración |
| PUT | `/api/settings` | Sí | Sí | Actualizar configuración |

**Comportamiento clave:** UPSERT atómico (`onConflictDoUpdate`) sobre la fila `key: "default"` — sin race conditions.

---

## 10. upload

Subida de imágenes (solución de tickets).

**Archivos:** `upload.controller.ts`, `upload.routes.ts`, `upload.controller.test.ts`

| Método | Ruta | Auth | Admin | Descripción |
|--------|------|:---:|:---:|---|
| POST | `/api/upload` | Sí | Sí | Subir imagen (multipart) |

**Comportamiento clave:**
- Formatos: png, jpg, jpeg, gif, webp; máx. 5MB; almacenamiento global máx. 500MB (507 al exceder).
- Nombre aleatorio UUID; sirve en `/uploads/<nombre>` (ruta protegida con auth).

---

## 11. users

Gestión de usuarios (admin/técnico).

**Archivos:** `users.controller.ts`, `users.routes.ts`, `users.schema.ts`, `users.controller.test.ts`, `users.schema.test.ts`

| Método | Ruta | Auth | Admin | Descripción |
|--------|------|:---:|:---:|---|
| POST | `/api/users` | Sí | Sí | Crear usuario |
| GET | `/api/users` | Sí | Sí | Listar (paginado + búsqueda + filtro rol) |
| PATCH | `/api/users/:id` | Sí | Sí | Actualizar rol/nombre/email/documento |
| PATCH | `/api/users/:id/toggle-status` | Sí | Sí | Bloquear/desbloquear |
| PATCH | `/api/users/:id/reset-password` | Sí | Sí | Reset password + desbloqueo |
| DELETE | `/api/users/:id` | Sí | Sí | Soft delete; libera tickets del técnico |

**Comportamiento clave:**
- No se puede degradar al único administrador (403) ni bloquear admins.
- No se puede borrar la propia cuenta ni una cuenta admin.
- Documento duplicado → 409.
- `reset-password` reinicia `intentos_fallidos` y pone el usuario `activo`.
