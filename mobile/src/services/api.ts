import {
  saveToken,
  getSavedToken,
  deleteToken,
  saveUser,
  getSavedUser,
  deleteUser,
  saveCache,
  getCache,
  clearApiCache,
} from "./storage";
import { logger } from "./logger";

export const API_URL = process.env.EXPO_PUBLIC_API_URL || "";
if (!API_URL) {
  throw new Error("EXPO_PUBLIC_API_URL environment variable is required");
}

const REQUEST_TIMEOUT = 15000;

let authToken: string | null = null;
let csrfToken: string | null = null;
let onForceLogout: (() => void) | null = null;
let onBlocked: (() => void) | null = null;
let isRefreshing = false;
let refreshPromise: Promise<boolean> | null = null;

export function setForceLogoutHandler(handler: () => void) {
  onForceLogout = handler;
}

export function setBlockedHandler(handler: () => void) {
  onBlocked = handler;
}

export async function initToken(): Promise<string | null> {
  try {
    authToken = await getSavedToken();
    return authToken;
  } catch {
    return null;
  }
}

export async function setToken(token: string) {
  authToken = token;
  await saveToken(token);
}

export async function clearToken() {
  authToken = null;
  csrfToken = null;
  try {
    await deleteToken();
    await deleteUser();
  } catch (err) {
    logger.error("clearToken error", { error: (err as Error).message });
  }
  clearApiCache().catch(() => {});
}

export { saveUser, getSavedUser };

async function tryRefresh(): Promise<boolean> {
  if (isRefreshing) {
    try {
      return (await refreshPromise) ?? false;
    } catch {
      return false;
    }
  }
  isRefreshing = true;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

  refreshPromise = (async () => {
    try {
      const r = await fetch(`${API_URL}/auth/refresh`, {
        method: "POST",
        credentials: "include",
        headers: {
          "X-Auth-Scope": "user",
          "X-Auth-Client": "mobile",
          ...(csrfToken ? { "X-CSRF-Token": csrfToken } : {}),
        },
        signal: controller.signal,
      });
      if (r.ok) {
        const body = await r.json().catch(() => ({}));
        if (body.token) {
          await setToken(body.token);
        }
        if (typeof body.csrfToken === "string") csrfToken = body.csrfToken;
        return Boolean(body.token);
      }
      return false;
    } catch (err) {
      logger.error("Refresh error", { error: (err as Error).message });
      return false;
    } finally {
      clearTimeout(timeoutId);
    }
  })();

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
  timeoutMs?: number
): Promise<T> {
  const isGet = !options.method || options.method === "GET";

  const isFormData = options.body instanceof FormData;
  const headers: Record<string, string> = {
    ...(isFormData ? {} : { "Content-Type": "application/json" }),
    "X-Auth-Scope": "user",
    // Cookies propias (mobile_*): sin esto, la PWA y el web compartirían
    // user_token/user_refreshToken en localhost (las cookies no distinguen puertos)
    // y sus sesiones se pisarían entre sí
    "X-Auth-Client": "mobile",
    ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
    ...(csrfToken && !isGet ? { "X-CSRF-Token": csrfToken } : {}),
    ...((options.headers as Record<string, string>) || {}),
  };
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs ?? REQUEST_TIMEOUT);

  let res: Response;

  try {
    res = await fetch(`${API_URL}${endpoint}`, {
      ...options,
      headers,
      credentials: "include",
      signal: controller.signal,
    });
  } catch (err) {
    clearTimeout(timeoutId);
    if (err instanceof DOMException && err.name === "AbortError") {
      throw new Error("La solicitud tardó demasiado. Intenta de nuevo.");
    }
    logger.error("Network error", { endpoint, error: (err as Error).message });
    if (isGet) {
      const cached = await getCache<T>(endpoint);
      if (cached) return cached;
    }
    throw new Error("No se pudo conectar con el servidor. Verifica tu conexión a internet.");
  }

  clearTimeout(timeoutId);

  // 401 en login/register = credenciales incorrectas: mostrar el error real,
  // no disparar refresh ni force-logout
  const isAuthEntryPoint =
    endpoint.startsWith("/auth/login") || endpoint.startsWith("/auth/register");

  if (res.status === 401 && !isAuthEntryPoint) {
    const refreshed = await tryRefresh();
    if (refreshed) {
      if (authToken) headers.Authorization = `Bearer ${authToken}`;
      else delete headers.Authorization;
      if (csrfToken) headers["X-CSRF-Token"] = csrfToken;
      const retryController = new AbortController();
      const retryTimeoutId = setTimeout(() => retryController.abort(), REQUEST_TIMEOUT);
      try {
        res = await fetch(`${API_URL}${endpoint}`, {
          ...options,
          headers,
          credentials: "include",
          signal: retryController.signal,
        });
      } catch (err) {
        clearTimeout(retryTimeoutId);
        if (err instanceof DOMException && err.name === "AbortError") {
          throw new Error("La solicitud tardó demasiado. Intenta de nuevo.");
        }
        logger.error("Network error after refresh", { endpoint, error: (err as Error).message });
        if (isGet) {
          const cached = await getCache<T>(endpoint);
          if (cached) return cached;
        }
        throw new Error("Error de conexión");
      } finally {
        clearTimeout(retryTimeoutId);
      }
    }

    if (!refreshed || res.status === 401) {
      await clearToken();
      onForceLogout?.();
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

  if (!res.ok) {
    if (res.status === 403) {
      const msg =
        typeof data === "object" && data !== null && "error" in data
          ? (data as { error: string }).error
          : "";
      if (msg.includes("bloqueado")) {
        await clearToken();
        onBlocked?.();
        onForceLogout?.();
        const err = new Error("bloqueado");
        (err as { originalMsg?: string }).originalMsg = msg;
        throw err;
      }
    }
    const msg =
      typeof data === "object" && data !== null && "error" in data
        ? (data as { error: string }).error
        : "Error en la petición";
    throw new Error(msg);
  }

  if (typeof data === "object" && data !== null && "csrfToken" in data) {
    const responseCsrfToken = (data as { csrfToken?: unknown }).csrfToken;
    if (typeof responseCsrfToken === "string") csrfToken = responseCsrfToken;
  }

  if (data === null || data === undefined) {
    throw new Error(`Respuesta inválida: ${endpoint} retornó ${data === null ? "null" : "undefined"}`);
  }
  if (typeof data !== "object") {
    throw new Error(`Respuesta inválida: ${endpoint} retornó un tipo inesperado (${typeof data})`);
  }

  if (isGet && !endpoint.includes("/auth/") && !endpoint.includes("/users")) {
    saveCache(endpoint, data).catch(() => {});
  }

  if (!isGet && !endpoint.startsWith("/auth/")) {
    clearApiCache().catch(() => {});
  }

  return data as T;
}

export const api = {
  get: <T>(endpoint: string, timeoutMs?: number) => request<T>(endpoint, undefined, timeoutMs),
  post: <T>(endpoint: string, body?: unknown) =>
    request<T>(endpoint, { method: "POST", body: JSON.stringify(body) }),
  upload: <T>(endpoint: string, formData: FormData) =>
    request<T>(endpoint, { method: "POST", body: formData }),
};