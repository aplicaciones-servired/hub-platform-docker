import { describe, it, expect, vi, beforeEach } from "vitest";
import { obtenerTicketsExportacion } from "./exportar";
import { api } from "@/lib/api";

vi.mock("@/lib/api", () => ({ api: { get: vi.fn() } }));

const getMock = api.get as ReturnType<typeof vi.fn>;

describe("obtenerTicketsExportacion", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("pide todas las páginas y junta los tickets", async () => {
    const pagina1 = Array.from({ length: 500 }, (_, i) => ({ id: `a${i}` }));
    const pagina2 = [{ id: "b1" }, { id: "b2" }];
    getMock
      .mockResolvedValueOnce({ items: pagina1, totalPages: 2 })
      .mockResolvedValueOnce({ items: pagina2, totalPages: 2 });

    const result = await obtenerTicketsExportacion({ start: "2026-11-01", end: "2026-11-30" });

    expect(getMock).toHaveBeenCalledTimes(2);
    expect(getMock.mock.calls[0][0]).toContain("page=1");
    expect(getMock.mock.calls[1][0]).toContain("page=2");
    expect(result).toHaveLength(502);
  });

  it("no repite un ticket que llega en dos páginas", async () => {
    const pagina1 = Array.from({ length: 500 }, (_, i) => ({ id: `a${i}` }));
    const pagina2 = [{ id: "a499" }, { id: "b1" }];
    getMock
      .mockResolvedValueOnce({ items: pagina1, totalPages: 2 })
      .mockResolvedValueOnce({ items: pagina2, totalPages: 2 });

    const result = await obtenerTicketsExportacion({});

    expect(result).toHaveLength(501);
  });

  it("no envía filtros vacíos", async () => {
    getMock.mockResolvedValueOnce({ items: [], totalPages: 1 });

    await obtenerTicketsExportacion({ start: "2026-11-01", assignedOnly: undefined });

    expect(getMock.mock.calls[0][0]).not.toContain("assignedOnly");
  });
});