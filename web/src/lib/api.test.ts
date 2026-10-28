import { describe, it, expect, vi, beforeEach } from "vitest";
import { z } from "zod";
import { api, setCsrfToken } from "./api";

const TEST_SCHEMA = z.object({
  id: z.string(),
  name: z.string(),
});

const TEST_DATA = { id: "1", name: "test" };

function createFetch(response: Partial<Response>, data?: unknown) {
  return vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: vi.fn().mockResolvedValue(data ?? TEST_DATA),
    headers: new Headers(),
    ...response,
  });
}

beforeEach(() => {
  vi.restoreAllMocks();
  setCsrfToken(null);
  Object.defineProperty(document, "cookie", {
    writable: true,
    value: "",
  });
});

describe("api.get", () => {
  it("makes a GET request and returns parsed data", async () => {
    const fetchMock = createFetch({});
    vi.stubGlobal("fetch", fetchMock);

    const result = await api.get("/test", TEST_SCHEMA);
    expect(result).toEqual(TEST_DATA);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, opts] = fetchMock.mock.calls[0];
    expect(url).toContain("/test");
    expect(opts.method).toBeUndefined();
  });

  it("returns data without schema", async () => {
    const fetchMock = createFetch({});
    vi.stubGlobal("fetch", fetchMock);

    const result = await api.get("/test");
    expect(result).toEqual(TEST_DATA as any);
  });

  it("throws on network error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new Error("Failed to fetch"))
    );

    await expect(api.get("/test")).rejects.toThrow(
      "No se pudo conectar con el servidor"
    );
  });

  it("throws generic (non-leaking) error on unknown backend message", async () => {
    const fetchMock = createFetch({
      ok: false,
      status: 400,
      json: vi.fn().mockResolvedValue({ error: "Bad request" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(api.get("/test")).rejects.toThrow("Solicitud inválida");
  });

  it("passes through known backend messages", async () => {
    const fetchMock = createFetch({
      ok: false,
      status: 409,
      json: vi.fn().mockResolvedValue({ error: "El documento ya está registrado" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(api.get("/test")).rejects.toThrow(
      "El documento ya está registrado"
    );
  });

  it("shows field validation details from the backend", async () => {
    const fetchMock = createFetch({
      ok: false,
      status: 400,
      json: vi.fn().mockResolvedValue({
        error: "Datos inválidos",
        details: {
          contrasena: ["Mínimo 8 caracteres"],
          documento: ["El documento no puede superar 20 caracteres"],
        },
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(api.post("/users", {})).rejects.toThrow(
      "Contraseña: Mínimo 8 caracteres. Documento: El documento no puede superar 20 caracteres"
    );
  });

  it("throws generic error when no error message", async () => {
    const fetchMock = createFetch({
      ok: false,
      status: 500,
      json: vi.fn().mockResolvedValue({}),
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(api.get("/test")).rejects.toThrow("Ocurrió un error inesperado");
  });

  it("throws on schema validation failure", async () => {
    const fetchMock = createFetch({}, { id: 1, name: 2 });
    vi.stubGlobal("fetch", fetchMock);

    await expect(api.get("/test", TEST_SCHEMA)).rejects.toThrow(
      "Respuesta inválida del servidor"
    );
  });

  it("throws on JSON parse error", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: vi.fn().mockRejectedValue(new Error("parse fail")),
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(api.get("/test")).rejects.toThrow(
      "Respuesta inesperada del servidor"
    );
  });
});

describe("api.post", () => {
  it("makes a POST request with body", async () => {
    const fetchMock = createFetch({});
    vi.stubGlobal("fetch", fetchMock);

    const body = { name: "new" };
    const result = await api.post("/test", body, TEST_SCHEMA);
    expect(result).toEqual(TEST_DATA);
    const [, opts] = fetchMock.mock.calls[0];
    expect(opts.method).toBe("POST");
    expect(opts.body).toBe(JSON.stringify(body));
  });
});

describe("api.put", () => {
  it("makes a PUT request with body", async () => {
    const fetchMock = createFetch({});
    vi.stubGlobal("fetch", fetchMock);

    const body = { name: "updated" };
    await api.put("/test/1", body);
    const [, opts] = fetchMock.mock.calls[0];
    expect(opts.method).toBe("PUT");
    expect(opts.body).toBe(JSON.stringify(body));
  });
});

describe("api.patch", () => {
  it("makes a PATCH request with body", async () => {
    const fetchMock = createFetch({});
    vi.stubGlobal("fetch", fetchMock);

    await api.patch("/test/1", { name: "patched" });
    const [, opts] = fetchMock.mock.calls[0];
    expect(opts.method).toBe("PATCH");
  });
});

describe("api.delete", () => {
  it("makes a DELETE request", async () => {
    const fetchMock = createFetch({});
    vi.stubGlobal("fetch", fetchMock);

    await api.delete("/test/1");
    const [, opts] = fetchMock.mock.calls[0];
    expect(opts.method).toBe("DELETE");
  });
});

describe("401 refresh flow", () => {
  it("retries after successful refresh", async () => {
    let callCount = 0;
    const fetchMock = vi.fn().mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return Promise.resolve({
          ok: false,
          status: 401,
          json: vi.fn().mockResolvedValue({}),
        });
      }
      if (callCount === 2) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: vi.fn().mockResolvedValue({ csrfToken: "new-token" }),
        });
      }
      return Promise.resolve({
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValue(TEST_DATA),
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await api.get("/test", TEST_SCHEMA);
    expect(result).toEqual(TEST_DATA);
    expect(callCount).toBe(3);
  });

  it("throws expired session when refresh also 401", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: vi.fn().mockResolvedValue({}),
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(api.get("/test")).rejects.toThrow("Sesión expirada");
  });
});

describe("403 bloqueado", () => {
  it("throws 'Usuario bloqueado' on 403 with bloqueado message", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 403,
      json: vi.fn().mockResolvedValue({ error: "Usuario bloqueado" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(api.get("/test")).rejects.toThrow("Usuario bloqueado");
  });
});

describe("CSRF token", () => {
  it("includes x-csrf-token header for non-GET requests when token is set", async () => {
    setCsrfToken("csrf-123");
    const fetchMock = createFetch({});
    vi.stubGlobal("fetch", fetchMock);

    await api.post("/test", {});
    const [, opts] = fetchMock.mock.calls[0];
    expect(opts.headers["x-csrf-token"]).toBe("csrf-123");
  });

  it("reads CSRF token from cookie as fallback", async () => {
    document.cookie = "csrf-token=cookie-csrf; path=/";
    const fetchMock = createFetch({});
    vi.stubGlobal("fetch", fetchMock);

    await api.post("/test", {});
    const [, opts] = fetchMock.mock.calls[0];
    expect(opts.headers["x-csrf-token"]).toBe("cookie-csrf");
  });

  it("does not include CSRF header for GET requests", async () => {
    setCsrfToken("csrf-123");
    const fetchMock = createFetch({});
    vi.stubGlobal("fetch", fetchMock);

    await api.get("/test");
    const [, opts] = fetchMock.mock.calls[0];
    expect(opts.headers["x-csrf-token"]).toBeUndefined();
    expect(opts.headers["Content-Type"]).toBe("application/json");
  });
});
