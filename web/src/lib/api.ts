import { z } from "zod";
import { logger } from "./logger";

const API_URL = "/api";

let isRefreshing = false;
let refreshPromise: Promise<boolean> | null = null;
let csrfToken: string | null = null;
let currentScope: "admin" | "user" | null = null;

export function setCsrfToken(token: string | null) {
  csrfToken = token;
}

export function setAuthScope(scope: "admin" | "user" | null) {
  currentScope = scope;
}

function getCsrfToken(): string | null {
  if (csrfToken) return csrfToken;
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(/csrf-token=([^;]+)/);
  return match?.[1] || null;
}

function getCurrentScope(): "admin" | "user" | null {
  if (typeof window !== "undefined") {
    return window.location.pathname.startsWith("/user") ? "user" : "admin";
  }
  return null;
}

function requestHeaders(options: RequestInit): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...((options.headers as Record<string, string>) || {}),
  };

  const scope = getCurrentScope();
  if (scope) {
    headers["X-Auth-Scope"] = scope;
  }

  const csrf = getCsrfToken();
  if (csrf && options.method && options.method !== "GET") {
    headers["x-csrf-token"] = csrf;
  }

  return headers;
}

async function tryRefresh(): Promise<boolean> {
  if (isRefreshing) return refreshPromise ?? false;
  isRefreshing = true;
  const headers: Record<string, string> = {};
  const scope = getCurrentScope();
  if (scope) headers["X-Auth-Scope"] = scope;
  // /auth/refresh exige CSRF (cookie + header): sin esto el refresh del web
  // siempre fallaba con 403 y la sesión se perdía en vez de rotar
  const csrf = getCsrfToken();
  if (csrf) headers["x-csrf-token"] = csrf;
  refreshPromise = fetch(`${API_URL}/auth/refresh`, {
    method: "POST",
    headers,
    credentials: "include",
  }).then(async (r) => {
    if (r.status === 401 || r.status === 403) {
      // Refresh inválido o sesión bloqueada → no reintentar, sino redirigir al login
      return false;
    }
    if (r.ok) {
      const body = await r.json().catch(() => ({}));
      if (body.csrfToken) setCsrfToken(body.csrfToken);
    }
    return r.ok;
  });

  try {
    return await refreshPromise;
  } finally {
    isRefreshing = false;
    refreshPromise = null;
  }
}

async function request<T>(
  endpoint: string,
  options: RequestInit = {},
  schema?: z.ZodType<T>
): Promise<T> {
  const headers = requestHeaders(options);

  let res: Response;

  try {
    res = await fetch(`${API_URL}${endpoint}`, {
      ...options,
      headers,
      credentials: "include",
    });
  } catch (err) {
    logger.error("Network error", { endpoint, error: (err as Error).message });
    throw new Error(
      `No se pudo conectar con el servidor (${API_URL}). Verifica que la API esté corriendo.`
    );
  }

  // Un 401 de login/registro NO es una sesión expirada: son credenciales
  // incorrectas. No hay nada que refrescar ni a dónde redirigir — dejar que
  // el manejo de errores de abajo muestre el mensaje real del backend.
  const isAuthEndpoint =
    endpoint === "/auth/login" || endpoint === "/auth/register" ||
    endpoint === "/auth/refresh";

  if (res.status === 401 && !isAuthEndpoint) {
    const refreshed = await tryRefresh();
    if (refreshed) {
      const retryHeaders = requestHeaders(options);
      try {
        res = await fetch(`${API_URL}${endpoint}`, {
          ...options,
          headers: retryHeaders,
          credentials: "include",
        });
      } catch (err) {
        logger.error("Network error after refresh", { endpoint, error: (err as Error).message });
        throw new Error("Error de conexión");
      }
    }

    if (!refreshed || res.status === 401) {
      if (typeof window !== "undefined") {
        const loginPath = getCurrentScope() === "user" ? "/user/login" : "/login";
        if (window.location.pathname !== loginPath && window.location.pathname !== "/login" && window.location.pathname !== "/user/login") {
          window.location.href = loginPath;
        }
      }
      throw new Error("Sesión expirada");
    }
  }

  let data: unknown;

  try {
    data = await res.json();
  } catch {
    logger.error("JSON parse error", { endpoint, status: res.status });
    throw new Error(`Respuesta inesperada del servidor (${res.status})`);
  }

  if (res.status === 403) {
    const msg =
      typeof data === "object" && data !== null && "error" in data
        ? (data as { error: string }).error
        : "";
    if (msg.includes("bloqueado")) {
      if (typeof window !== "undefined") {
        const loginPath = getCurrentScope() === "user" ? "/user/login" : "/login";
        if (window.location.pathname !== loginPath && window.location.pathname !== "/login" && window.location.pathname !== "/user/login") {
          window.location.href = loginPath;
        }
      }
      throw new Error("Usuario bloqueado");
    }
  }

  if (!res.ok) {
    const rawMsg =
      typeof data === "object" && data !== null && "error" in data
        ? String((data as { error: unknown }).error)
        : "";
    logger.warn("API error", { endpoint, status: res.status, detail: rawMsg });

    if (
      rawMsg === "Datos inválidos" &&
      typeof data === "object" &&
      data !== null &&
      "details" in data &&
      typeof data.details === "object" &&
      data.details !== null
    ) {
      const fieldLabels: Record<string, string> = {
        documento: "Documento",
        nombre: "Nombre",
        contrasena: "Contraseña",
        rol: "Rol",
      };
      const details = Object.entries(data.details)
        .flatMap(([field, messages]) =>
          Array.isArray(messages)
            ? messages
                .filter((message): message is string => typeof message === "string")
                .map((message) => `${fieldLabels[field] ?? field}: ${message}`)
            : []
        );
      if (details.length > 0) {
        throw new Error(details.join(". "));
      }
    }

    // Mensajes conocidos del backend se muestran tal cual; el resto se
    // generaliza para no exponer detalles internos al usuario
    const KNOWN_ERRORS = [
      "Documento o contraseña incorrectos",
      "Datos inválidos",
      "No autorizado",
      "Token inválido o expirado",
      "El registro ya existe",
      "El documento ya está registrado",
      "No tienes permisos",
      "Usuario bloqueado",
      "Cuenta bloqueada temporalmente",
      "No se puede cambiar el estado de una cuenta de administrador",
      "Solo un administrador",
      "Ruta no encontrada",
      "Demasiadas solicitudes",
    ];
    const isKnown = KNOWN_ERRORS.some((k) => rawMsg.startsWith(k));
    if (isKnown) throw new Error(rawMsg);

    const friendly: Record<number, string> = {
      400: "Solicitud inválida. Revisa los datos e intenta de nuevo.",
      401: "Tu sesión ha expirado. Inicia sesión nuevamente.",
      403: "No tienes permisos para realizar esta acción.",
      404: "No se encontró el recurso solicitado.",
      409: "El registro ya existe o hay un conflicto con los datos actuales.",
      413: "El archivo es demasiado grande.",
      429: "Demasiadas solicitudes. Espera un momento e intenta de nuevo.",
    };
    throw new Error(friendly[res.status] || "Ocurrió un error inesperado. Intenta de nuevo.");
  }

  if (schema) {
    try {
      return schema.parse(data);
    } catch (err) {
      if (err instanceof z.ZodError) {
        logger.error("Validation error", { endpoint, issues: err.issues });
        throw new Error(`Respuesta inválida del servidor (${endpoint})`);
      }
      throw err;
    }
  }

  if (process.env.NODE_ENV !== "production") {
    logger.warn(`Respuesta sin schema de validación para ${endpoint}`);
  }

  return data as T;
}

export const api = {
  get: <T>(endpoint: string, schema?: z.ZodType<T>) =>
    request<T>(endpoint, undefined, schema),
  post: <T>(endpoint: string, body?: unknown, schema?: z.ZodType<T>) =>
    request<T>(endpoint, { method: "POST", body: JSON.stringify(body) }, schema),
  put: <T>(endpoint: string, body?: unknown, schema?: z.ZodType<T>) =>
    request<T>(endpoint, { method: "PUT", body: JSON.stringify(body) }, schema),
  patch: <T>(endpoint: string, body?: unknown, schema?: z.ZodType<T>) =>
    request<T>(endpoint, { method: "PATCH", body: JSON.stringify(body) }, schema),
  delete: <T>(endpoint: string, schema?: z.ZodType<T>) =>
    request<T>(endpoint, { method: "DELETE" }, schema),
};
