import { Request, Response } from "express";
import bcrypt from "bcryptjs";
import { eq, sql, and, isNull, lt } from "drizzle-orm";
import { db } from "../../db";
import { users, refreshTokens } from "../../db/schema";
import {
  setTokenCookies,
  clearTokenCookies,
  verifyToken,
  verifyRefreshToken,
  extractToken,
  extractRefreshToken,
  detectRefreshScope,
  buildJwtPayload,
  hashToken,
  refreshExpiry,
  type AuthScope,
  type AuthClient,
} from "../../lib/jwt";
import { getOrCreateCsrfToken } from "../../middlewares/csrf";
import { logger } from "../../lib/logger";
import { env } from "../../config/env";

const MAX_LOGIN_ATTEMPTS = env.MAX_LOGIN_ATTEMPTS;

/** Cliente de la sesión: la PWA mobile envía X-Auth-Client: mobile */
function getClientFromRequest(req: Request): AuthClient {
  return req.headers?.["x-auth-client"] === "mobile" ? "mobile" : undefined;
}

// Hash de relleno para igualar timing cuando el usuario no existe (anti-enumeración)
const DUMMY_HASH = "$2a$12$xo2yWONym/BmrASiewX2luAQaaXLPGWevMtgLgJm3gbTrRajG5GNy";

// Minutos de bloqueo automático tras agotar intentos (bloqueo manual de admin = permanente)
const LOCKOUT_MINUTES = 15;

/**
 * Persiste la sesión de refresh token (hash sha256, nunca el token en claro).
 * Solo para sesiones con scope; las llamadas sin scope (API directa) siguen
 * el flujo legacy sin rotación.
 *
 * Si el INSERT falla, PROPAGA el error: entregar un refresh con jti sin fila
 * persistida haría que el próximo refresh lo interprete como reuso (robo)
 * y revocara TODAS las sesiones del usuario por un fallo transitorio.
 */
async function persistRefreshSession(
  userId: string,
  scope: AuthScope | undefined,
  tokens: { refreshToken: string; refreshJti: string }
): Promise<void> {
  if (!scope) return;
  await db.insert(refreshTokens).values({
    id: tokens.refreshJti,
    user_id: userId,
    scope,
    token_hash: hashToken(tokens.refreshToken),
    expires_at: refreshExpiry(),
  });
}

/**
 * Formatea la respuesta del usuario para el cliente
 * @param user - Usuario de la base de datos
 * @returns Objeto con datos públicos del usuario (sin contraseña)
 */
function userResponse(user: typeof users.$inferSelect) {
  return {
    id: user.id,
    documento: user.documento,
    nombre: user.nombre,
    rol: user.rol,
  };
}

/**
 * Registra un nuevo usuario en el sistema
 * - Valida que el documento no exista
 * - Hashea la contraseña con bcrypt (12 rondas)
 * - Genera email automático basado en documento
 * - Asigna rol "user" por defecto
 *
 * @throws 409 - Si el documento ya está registrado
 * @throws 500 - Error interno del servidor
 */
export async function register(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const { documento, nombre, contrasena } = req.body;

    // El unique constraint de documento es global (incluye soft-deleted):
    // sin el filtro de deleted_at evitamos el 500 por duplicado invisible
    const [existing] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.documento, documento))
      .limit(1);

    if (existing) {
      res.status(409).json({ error: "El documento ya está registrado" });
      return;
    }

    const hashed = await bcrypt.hash(contrasena, 12);

    const [user] = await db
      .insert(users)
      .values({
        documento,
        nombre,
        contrasena: hashed,
        email: `${documento}@${env.EMAIL_DOMAIN}`,
        rol: "user",
      })
      .returning();

    const tokens = setTokenCookies(res, buildJwtPayload(user, "user"), "user", getClientFromRequest(req));
    try {
      await persistRefreshSession(user.id, "user", tokens);
    } catch (error) {
      // Las cookies ya se setearon: limpiarlas antes de fallar
      logger.error("Register persist session failed", { error: (error as Error).message });
      clearTokenCookies(res, "user", getClientFromRequest(req));
      res.status(500).json({ error: "Error al registrar usuario" });
      return;
    }

    const csrfToken = getOrCreateCsrfToken(req, res);

    res.status(201).json({ user: userResponse(user), csrfToken });
  } catch (error) {
    logger.error("Register error", { error: (error as Error).message });
    res.status(500).json({ error: "Error al registrar usuario" });
  }
}

/**
 * Autentica un usuario y genera tokens JWT
 * - Valida documento y contraseña
 * - Bloquea usuario después de MAX_LOGIN_ATTEMPTS intentos fallidos
 * - Resetea contador de intentos al login exitoso
 * - Valida permisos según scope (admin/user)
 * - Genera cookies httpOnly con scope aislado
 * - Genera token CSRF
 *
 * @throws 401 - Credenciales incorrectas
 * @throws 403 - Usuario bloqueado o sin permisos
 * @throws 500 - Error interno del servidor
 */
export async function login(req: Request, res: Response): Promise<void> {
  try {
    const { documento, contrasena, scope } = req.body;

    const [user] = await db
      .select()
      .from(users)
      .where(and(eq(users.documento, documento), isNull(users.deleted_at)))
      .limit(1);

    if (!user) {
      // Igualar timing con el caso de usuario existente (anti-enumeración)
      await bcrypt.compare(contrasena, DUMMY_HASH).catch(() => {});
      res.status(401).json({ error: "Documento o contraseña incorrectos" });
      return;
    }

    if (user.estado === "bloqueado") {
      // Auto-unlock: bloqueo por intentos fallidos (con fecha) expira solo
      if (user.bloqueado_hasta && user.bloqueado_hasta <= new Date()) {
        await db
          .update(users)
          .set({ estado: "activo", intentos_fallidos: 0, bloqueado_hasta: null })
          .where(and(eq(users.id, user.id), isNull(users.deleted_at)));
      } else {
        const msg = user.bloqueado_hasta
          ? "Cuenta bloqueada temporalmente por intentos fallidos. Intenta de nuevo en unos minutos."
          : "Usuario bloqueado. Contacta al administrador.";
        res.status(403).json({ error: msg });
        return;
      }
    }

    const valid = await bcrypt.compare(contrasena, user.contrasena);

    if (!valid) {
      const [updated] = await db
        .update(users)
        .set({ intentos_fallidos: sql`${users.intentos_fallidos} + 1` })
        .where(eq(users.id, user.id))
        .returning({ intentos_fallidos: users.intentos_fallidos });

      if ((updated?.intentos_fallidos ?? 0) >= MAX_LOGIN_ATTEMPTS) {
        await db
          .update(users)
          .set({
            estado: "bloqueado",
            bloqueado_hasta: new Date(Date.now() + LOCKOUT_MINUTES * 60 * 1000),
          })
          .where(eq(users.id, user.id));
        res.status(403).json({
          error: `Cuenta bloqueada temporalmente por ${LOCKOUT_MINUTES} minutos tras múltiples intentos fallidos.`,
        });
        return;
      }

      res.status(401).json({ error: "Documento o contraseña incorrectos" });
      return;
    }

    await db
      .update(users)
      .set({ intentos_fallidos: 0 })
      .where(eq(users.id, user.id));

    // Validar rol según scope
    if (scope === "admin" && user.rol !== "admin" && user.rol !== "tecnico") {
      res.status(403).json({ error: "No tienes permisos para acceder al panel administrativo" });
      return;
    }

    const tokens = setTokenCookies(res, buildJwtPayload(user, scope), scope, getClientFromRequest(req));
    try {
      await persistRefreshSession(user.id, scope, tokens);
    } catch (error) {
      // Las cookies ya se setearon: limpiarlas antes de fallar
      logger.error("Login persist session failed", { error: (error as Error).message });
      clearTokenCookies(res, scope, getClientFromRequest(req));
      res.status(500).json({ error: "Error interno del servidor" });
      return;
    }

    const client = getClientFromRequest(req);
    const csrfToken = getOrCreateCsrfToken(req, res);
    res.json({ user: userResponse(user), ...(client === "mobile" ? { token: tokens.token } : {}), csrfToken });
  } catch (error) {
    logger.error("Login error", { error: (error as Error).message });
    res.status(500).json({ error: "Error interno del servidor" });
  }
}

/**
 * Obtiene el usuario autenticado actual
 * - Verifica token JWT del header/cookies
 * - Genera nuevo token CSRF
 *
 * @throws 401 - Sesión inválida o token expirado
 * @throws 500 - Error interno del servidor
 */
export async function me(req: Request, res: Response): Promise<void> {
  try {
    const [user] = await db
      .select({
        id: users.id,
        documento: users.documento,
        nombre: users.nombre,
        rol: users.rol,
        created_at: users.created_at,
      })
      .from(users)
      .where(and(eq(users.id, req.user!.userId), isNull(users.deleted_at)))
      .limit(1);

    if (!user) {
      res.status(401).json({ error: "Sesión inválida" });
      return;
    }

    const csrfToken = getOrCreateCsrfToken(req, res);

    res.json({ ...user, csrfToken });
  } catch (error) {
    logger.error("Me error", { error: (error as Error).message });
    res.status(500).json({ error: "Error interno del servidor" });
  }
}

/**
 * Renueva el token JWT usando refresh token
 *
 * Sesiones con scope (frontends): rotación real — la fila de refresh_tokens
 * se marca revocada de forma atómica y se emite un refresh nuevo. Si el JWT
 * es válido pero su fila ya está revocada, hay reuso (robo): se revocan
 * todas las sesiones del usuario y se bumpea la versión global.
 *
 * Tokens legacy (sin jti/scope): validación por token_version como antes.
 *
 * @throws 401 - Refresh token inválido, revocado o expirado
 * @throws 500 - Error interno del servidor
 */
export async function refresh(req: Request, res: Response): Promise<void> {
  const scope = detectRefreshScope(req);
  const client = getClientFromRequest(req);

  try {
    const refreshToken = extractRefreshToken(req);

    if (!refreshToken) {
      // Sin refresh token la sesión no puede renovarse: limpiar también el
      // access token para no dejar una cookie "muerta" que el middleware del
      // web considera válida por firma (bucle /login ↔ /dashboard)
      clearTokenCookies(res, scope, client);
      res.status(401).json({ error: "Refresh token no proporcionado" });
      return;
    }

    const payload = verifyRefreshToken(refreshToken);

    // ---- Flujo con sesión persistida (jti + scope) ----
    if (payload.jti && payload.scope) {
      const [user] = await db
        .select({
          id: users.id,
          documento: users.documento,
          rol: users.rol,
          estado: users.estado,
          token_version: users.token_version,
          token_version_admin: users.token_version_admin,
          token_version_user: users.token_version_user,
        })
        .from(users)
        .where(and(eq(users.id, payload.userId), isNull(users.deleted_at)))
        .limit(1);

      const userValid =
        !!user &&
        user.estado !== "bloqueado" &&
        user.token_version === payload.tokenVersion &&
        (payload.scope === "admin"
          ? user.token_version_admin
          : user.token_version_user) === payload.scopeVersion;

      if (!userValid) {
        clearTokenCookies(res, scope, client);
        res.status(401).json({ error: "Sesión inválida, inicia sesión nuevamente" });
        return;
      }

      // Rotación atómica: solo un portador del token puede ganar la carrera
      const [claimed] = await db
        .update(refreshTokens)
        .set({ revoked_at: new Date() })
        .where(
          and(
            eq(refreshTokens.id, payload.jti),
            eq(refreshTokens.user_id, user.id),
            isNull(refreshTokens.revoked_at)
          )
        )
        .returning({ expires_at: refreshTokens.expires_at });

      if (!claimed) {
        // Reuso detectado: el refresh ya fue rotado pero alguien lo vuelve a
        // usar. Señal de robo → revocar TODAS las sesiones del usuario.
        logger.warn("Refresh token reuse detected", {
          userId: payload.userId,
          scope: payload.scope,
        });
        await db
          .update(refreshTokens)
          .set({ revoked_at: new Date() })
          .where(and(eq(refreshTokens.user_id, user.id), isNull(refreshTokens.revoked_at)));
        await db
          .update(users)
          .set({ token_version: sql`${users.token_version} + 1` })
          .where(and(eq(users.id, user.id), isNull(users.deleted_at)));
        clearTokenCookies(res, scope, client);
        res.status(401).json({ error: "Sesión inválida, inicia sesión nuevamente" });
        return;
      }

      if (claimed.expires_at <= new Date()) {
        // Expiración benigna: sin sesiones nuevas, solo cookies
        clearTokenCookies(res, scope, client);
        res.status(401).json({ error: "Sesión expirada, inicia sesión nuevamente" });
        return;
      }

      const newScope: AuthScope = payload.scope;
      const tokens = setTokenCookies(res, buildJwtPayload(user, newScope), newScope, client);

      try {
        await db.insert(refreshTokens).values({
          id: tokens.refreshJti,
          user_id: user.id,
          scope: newScope,
          token_hash: hashToken(tokens.refreshToken),
          expires_at: refreshExpiry(),
        });
      } catch (error) {
        // Sin fila persistida, el próximo refresh dispararía detección de
        // reuso (falso robo) y revocaría todas las sesiones del usuario.
        // Mejor cerrar esta sesión limpiamente y pedir re-login.
        logger.error("Refresh rotation persist failed", { error: (error as Error).message });
        clearTokenCookies(res, scope, client);
        res.status(401).json({ error: "Sesión inválida, inicia sesión nuevamente" });
        return;
      }

      // Higiene: eliminar filas expiradas del usuario (incluye la recién revocada cuando venza)
      try {
        await db
          .delete(refreshTokens)
          .where(
            and(
              eq(refreshTokens.user_id, user.id),
              lt(refreshTokens.expires_at, new Date())
            )
          );
      } catch (error) {
        // No fatal: solo acumula filas expiradas que la próxima rotación limpiará
        logger.warn("Refresh hygiene failed", { error: (error as Error).message });
      }

      const csrfToken = getOrCreateCsrfToken(req, res);
      res.json({ ok: true, ...(client === "mobile" ? { token: tokens.token } : {}), csrfToken });
      return;
    }


    // ---- Flujo legacy: refresh sin sesión persistida ----
    const [user] = await db
      .select({ token_version: users.token_version, estado: users.estado })
      .from(users)
      .where(and(eq(users.id, payload.userId), isNull(users.deleted_at)))
      .limit(1);

    if (!user || user.estado === "bloqueado" || user.token_version !== payload.tokenVersion) {
      // Solo limpiar cookies del scope — NO todas (sesiones aisladas)
      clearTokenCookies(res, scope, client);
      res.status(401).json({ error: "Sesión inválida, inicia sesión nuevamente" });
      return;
    }

    const tokens = setTokenCookies(res, {
      userId: payload.userId,
      documento: payload.documento,
      rol: payload.rol,
      tokenVersion: user.token_version,
    }, scope, client);

    const csrfToken = getOrCreateCsrfToken(req, res);
    res.json({ ok: true, ...(client === "mobile" ? { token: tokens.token } : {}), csrfToken });
  } catch {
    // Solo limpiar cookies del scope — NO todas (sesiones aisladas)
    clearTokenCookies(res, scope, client);
    res.status(401).json({ error: "Sesión expirada, inicia sesión nuevamente" });
  }
}

/**
 * Cierra la sesión del usuario
 * - Detecta el scope (admin/user) desde header X-Auth-Scope o el payload del token
 * - Revoca las filas de refresh token del scope (rotación terminal)
 * - Bumpea la versión de token SOLO del scope: logout aislado real
 * - Limpia únicamente las cookies del scope correspondiente
 *
 * Sesiones aisladas: logout en mobile no afecta dashboard y viceversa.
 * Sin scope conocido (API directa): fallback a invalidación global.
 */
export async function logout(req: Request, res: Response): Promise<void> {
  const headerScope = req.headers["x-auth-scope"];
  const scope: AuthScope | undefined = headerScope === "admin" || headerScope === "user" ? headerScope : undefined;

  let tokenScope: AuthScope | undefined = scope;

  try {
    let userId: string | undefined;

    const token = extractToken(req);
    if (token) {
      try {
        const payload = verifyToken(token);
        userId = payload.userId;
        tokenScope = tokenScope ?? payload.scope;
      } catch {
        userId = undefined;
      }
    }
    if (!userId) {
      const refreshToken = extractRefreshToken(req);
      if (refreshToken) {
        try {
          const payload = verifyRefreshToken(refreshToken);
          userId = payload.userId;
          tokenScope = tokenScope ?? payload.scope;
        } catch {
          // refresh inválido: solo limpiar cookies
        }
      }
    }

    if (userId) {
      // Revocar sesiones de refresh del scope (todas si no se conoce el scope)
      const revokeConditions = [
        eq(refreshTokens.user_id, userId),
        isNull(refreshTokens.revoked_at),
      ];
      if (tokenScope) revokeConditions.push(eq(refreshTokens.scope, tokenScope));
      await db
        .update(refreshTokens)
        .set({ revoked_at: new Date() })
        .where(and(...revokeConditions));

      // Invalidar access tokens SOLO del scope (logout aislado)
      if (tokenScope === "admin") {
        await db
          .update(users)
          .set({ token_version_admin: sql`${users.token_version_admin} + 1` })
          .where(and(eq(users.id, userId), isNull(users.deleted_at)));
      } else if (tokenScope === "user") {
        await db
          .update(users)
          .set({ token_version_user: sql`${users.token_version_user} + 1` })
          .where(and(eq(users.id, userId), isNull(users.deleted_at)));
      } else {
        // Scope desconocido: preservar comportamiento anterior (global)
        await db
          .update(users)
          .set({ token_version: sql`${users.token_version} + 1` })
          .where(and(eq(users.id, userId), isNull(users.deleted_at)));
      }
    }
  } catch (error) {
    logger.warn("Logout token invalidate failed", { error: (error as Error).message });
  }

  // Siempre limpiar solo las cookies del scope/cliente correspondiente
  // NUNCA clearAllTokenCookies — destruiría sesiones de otros scopes
  clearTokenCookies(res, tokenScope ?? scope, getClientFromRequest(req));

  res.json({ ok: true });
}
