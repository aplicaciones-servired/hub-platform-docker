import { describe, it, expect, vi, beforeEach } from "vitest";
import { Request, Response } from "express";
import { createIncident, getIncident, deleteIncident } from "./incidents.controller";
import { db } from "../../db";
import { incidents } from "../../db/schema";

vi.mock("../../db", () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
  },
}));

describe("Incidents Controller", () => {
  let req: Partial<Request>;
  let res: Partial<Response>;
  let jsonMock: ReturnType<typeof vi.fn>;
  let statusMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    jsonMock = vi.fn();
    statusMock = vi.fn().mockReturnValue({ json: jsonMock });
    req = { body: {}, params: {}, user: { userId: "user-123", rol: "user" } as any };
    res = {
      json: jsonMock,
      status: statusMock,
    } as Partial<Response>;
    vi.clearAllMocks();
  });

  describe("createIncident", () => {
    it("should create incident successfully", async () => {
      const insertChain = {
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{
            id: "incident-id",
            user_id: "user-123",
            nombre: "Test Incident",
            punto_venta: "PV-001",
            descripcion: "Test description",
            urgencia: "media",
            estado: "pendiente",
            created_at: new Date(),
          }]),
        }),
      };
      (db.insert as ReturnType<typeof vi.fn>).mockReturnValue(insertChain);

      const userSelectChain = {
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([{
              id: "user-123",
              nombre: "Test User",
              documento: "123456789",
            }]),
          }),
        }),
      };
      (db.select as ReturnType<typeof vi.fn>).mockReturnValue(userSelectChain);

      req.body = {
        nombre: "Nombre ignorado",
        documento: "Documento ignorado",
        punto_venta: "PV-001",
        descripcion: "Test description",
      };

      await createIncident(req as Request, res as Response);

      expect(statusMock).toHaveBeenCalledWith(201);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          nombre: "Test Incident",
          estado: "pendiente",
        })
      );
    });

    it("un usuario normal con documento en el body: SIEMPRE crea a su nombre (no roba identidad)", async () => {
      const insertChain = {
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{
            id: "incident-id",
            user_id: "user-123",
            nombre: "Test User",
            estado: "pendiente",
          }]),
        }),
      };
      (db.insert as ReturnType<typeof vi.fn>).mockReturnValue(insertChain);

      const userSelectChain = {
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([{
              id: "user-123",
              nombre: "Test User",
              documento: "123456789",
            }]),
          }),
        }),
      };
      (db.select as ReturnType<typeof vi.fn>).mockReturnValue(userSelectChain);

      // Usuario rol "user" intenta atribuir a otro documento: se ignora
      req.body = {
        documento: "999999999",
        punto_venta: "Punto enviado por el cliente",
        descripcion: "Test description",
      };

      await createIncident(req as Request, res as Response);

      const insertValues = insertChain.values.mock.calls[0][0];
      expect(insertValues.user_id).toBe("user-123");
      expect(insertValues.documento).toBe("123456789");
      expect(insertValues.punto_venta).toBe("Test User");
    });

    it("admin con documento en el body: atribuye el ticket al usuario dueño del documento", async () => {
      const insertChain = {
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{
            id: "incident-id",
            user_id: "target-user",
            nombre: "Target User",
            estado: "pendiente",
          }]),
        }),
      };
      (db.insert as ReturnType<typeof vi.fn>).mockReturnValue(insertChain);

      const targetSelectChain = {
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([{
              id: "target-user",
              nombre: "Target User",
              documento: "999999999",
            }]),
          }),
        }),
      };
      (db.select as ReturnType<typeof vi.fn>).mockReturnValue(targetSelectChain);

      req.user = { userId: "admin-1", rol: "admin" } as any;
      req.body = {
        documento: "999999999",
        punto_venta: "PV-001",
        descripcion: "Ticket para otro usuario",
      };

      await createIncident(req as Request, res as Response);

      expect(statusMock).toHaveBeenCalledWith(201);
      const insertValues = insertChain.values.mock.calls[0][0];
      expect(insertValues.user_id).toBe("target-user");
      expect(insertValues.nombre).toBe("Target User");
      expect(insertValues.documento).toBe("999999999");
    });

    it("admin con documento inexistente: 404", async () => {
      const targetSelectChain = {
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      };
      (db.select as ReturnType<typeof vi.fn>).mockReturnValue(targetSelectChain);

      req.user = { userId: "admin-1", rol: "admin" } as any;
      req.body = {
        documento: "000000000",
        punto_venta: "PV-001",
        descripcion: "Ticket para usuario fantasma",
      };

      await createIncident(req as Request, res as Response);

      expect(statusMock).toHaveBeenCalledWith(404);
      expect(jsonMock).toHaveBeenCalledWith({ error: "No existe un usuario con ese documento" });
    });
  });

  describe("getIncident", () => {
    it("should return 404 if incident not found", async () => {
      const selectChain = {
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      };
      (db.select as ReturnType<typeof vi.fn>).mockReturnValue(selectChain);

      req.params = { id: "incident-id" };

      await getIncident(req as Request, res as Response);

      expect(statusMock).toHaveBeenCalledWith(404);
      expect(jsonMock).toHaveBeenCalledWith({ error: "Incidente no encontrado" });
    });

    it("should return 403 if user tries to access another user's incident", async () => {
      const selectChain = {
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([{
              id: "incident-id",
              user_id: "other-user",
              estado: "pendiente",
            }]),
          }),
        }),
      };
      (db.select as ReturnType<typeof vi.fn>).mockReturnValue(selectChain);

      req.params = { id: "incident-id" };
      req.user = { userId: "user-123", rol: "user" } as any;

      await getIncident(req as Request, res as Response);

      expect(statusMock).toHaveBeenCalledWith(403);
      expect(jsonMock).toHaveBeenCalledWith({ error: "Acceso denegado" });
    });

    it("should return incident with comments if user has access", async () => {
      const incidentSelect = {
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([{
              id: "incident-id",
              user_id: "user-123",
              estado: "pendiente",
              cerrado_por: null,
            }]),
          }),
        }),
      };

      const commentsSelect = {
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockResolvedValue([]),
          }),
        }),
      };

      (db.select as ReturnType<typeof vi.fn>)
        .mockReturnValueOnce(incidentSelect)
        .mockReturnValueOnce(commentsSelect);

      req.params = { id: "incident-id" };
      req.user = { userId: "user-123", rol: "user" } as any;

      await getIncident(req as Request, res as Response);

      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          id: "incident-id",
          comments: [],
        })
      );
    });
  });

  describe("deleteIncident", () => {
    it("should soft delete incident successfully", async () => {
      const updateChain = {
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([{
              id: "incident-id",
              deleted_at: new Date(),
            }]),
          }),
        }),
      };
      (db.update as ReturnType<typeof vi.fn>).mockReturnValue(updateChain);

      req.params = { id: "incident-id" };

      await deleteIncident(req as Request, res as Response);

      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          message: "Incidente eliminado",
          id: "incident-id",
        })
      );
    });

    it("should return 404 if incident not found", async () => {
      const updateChain = {
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([]),
          }),
        }),
      };
      (db.update as ReturnType<typeof vi.fn>).mockReturnValue(updateChain);

      req.params = { id: "incident-id" };

      await deleteIncident(req as Request, res as Response);

      expect(statusMock).toHaveBeenCalledWith(404);
      expect(jsonMock).toHaveBeenCalledWith({ error: "Incidente no encontrado" });
    });
  });
});
