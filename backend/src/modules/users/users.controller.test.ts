import { describe, it, expect, vi, beforeEach } from "vitest";
import { Request, Response } from "express";
import { createUser, listUsers, toggleUserStatus, resetPassword, updateUser, deleteUser } from "./users.controller";
import { db } from "../../db";
import { users } from "../../db/schema";
import bcrypt from "bcryptjs";

vi.mock("../../db", () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    transaction: vi.fn(),
  },
}));

vi.mock("bcryptjs", () => ({
  default: {
    hash: vi.fn(),
  },
}));

describe("Users Controller", () => {
  let req: Partial<Request>;
  let res: Partial<Response>;
  let jsonMock: ReturnType<typeof vi.fn>;
  let statusMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    jsonMock = vi.fn();
    statusMock = vi.fn().mockReturnValue({ json: jsonMock });
    req = { body: {}, user: { userId: "admin-123", rol: "admin" } as any };
    res = {
      json: jsonMock,
      status: statusMock,
    } as Partial<Response>;
    vi.clearAllMocks();
  });

  describe("createUser", () => {
    it("should create a new user successfully", async () => {
      const selectChain = {
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      };
      (db.select as ReturnType<typeof vi.fn>).mockReturnValue(selectChain);

      const insertChain = {
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{
            id: "user-id",
            documento: "123456789",
            nombre: "Test User",
            email: "123456789@hub.ai",
            rol: "user",
            estado: "activo",
            created_at: new Date(),
          }]),
        }),
      };
      (db.insert as ReturnType<typeof vi.fn>).mockReturnValue(insertChain);

      (bcrypt.hash as ReturnType<typeof vi.fn>).mockResolvedValue("hashed");

      req.body = {
        documento: "123456789",
        nombre: "Test User",
        contrasena: "password123",
      };

      await createUser(req as Request, res as Response);

      expect(statusMock).toHaveBeenCalledWith(201);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          documento: "123456789",
          nombre: "Test User",
          rol: "user",
        })
      );
    });

    it("should return 409 if document already exists", async () => {
      const selectChain = {
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([{ id: "existing-user" }]),
          }),
        }),
      };
      (db.select as ReturnType<typeof vi.fn>).mockReturnValue(selectChain);

      req.body = {
        documento: "123456789",
        nombre: "Test User",
        contrasena: "password123",
      };

      await createUser(req as Request, res as Response);

      expect(statusMock).toHaveBeenCalledWith(409);
      expect(jsonMock).toHaveBeenCalledWith({ error: "El documento ya está registrado" });
    });
  });

  describe("toggleUserStatus", () => {
    it("should toggle user status from activo to bloqueado", async () => {
      const selectChain = {
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([{
              id: "user-id",
              estado: "activo",
              rol: "user",
            }]),
          }),
        }),
      };
      (db.select as ReturnType<typeof vi.fn>).mockReturnValue(selectChain);

      const updateChain = {
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([{
              id: "user-id",
              nombre: "Test User",
              rol: "user",
              estado: "bloqueado",
              bloqueado_por: "admin-123",
            }]),
          }),
        }),
      };
      (db.update as ReturnType<typeof vi.fn>).mockReturnValue(updateChain);

      req.params = { id: "user-id" };

      await toggleUserStatus(req as Request, res as Response);

      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          estado: "bloqueado",
        })
      );
    });

    it("should return 403 for admin user", async () => {
      const selectChain = {
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([{
              id: "admin-id",
              estado: "activo",
              rol: "admin",
            }]),
          }),
        }),
      };
      (db.select as ReturnType<typeof vi.fn>).mockReturnValue(selectChain);

      req.params = { id: "admin-id" };

      await toggleUserStatus(req as Request, res as Response);

      expect(statusMock).toHaveBeenCalledWith(403);
    });
  });

  describe("updateUser", () => {
    it("should return 400 if no fields to update", async () => {
      req.params = { id: "user-id" };
      req.body = {};

      await updateUser(req as Request, res as Response);

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({ error: "No hay campos para actualizar" });
    });

    it("should return 409 if document already exists for another user", async () => {
      const selectChain = {
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([{ id: "duplicate-user" }]),
          }),
        }),
      };
      (db.select as ReturnType<typeof vi.fn>).mockReturnValue(selectChain);

      req.params = { id: "user-id" };
      req.body = { documento: "999999999" };

      await updateUser(req as Request, res as Response);

      expect(statusMock).toHaveBeenCalledWith(409);
      expect(jsonMock).toHaveBeenCalledWith({ error: "El documento ya está registrado por otro usuario" });
    });

    describe("deleteUser", () => {
      it("does not allow deleting the current account", async () => {
        req.params = { id: "admin-123" };

        await deleteUser(req as Request, res as Response);

        expect(statusMock).toHaveBeenCalledWith(403);
        expect(db.transaction).not.toHaveBeenCalled();
      });

      it("does not allow deleting an admin account", async () => {
        const selectChain = {
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([{ id: "admin-2", rol: "admin" }]),
            }),
          }),
        };
        (db.select as ReturnType<typeof vi.fn>).mockReturnValue(selectChain);
        req.params = { id: "admin-2" };

        await deleteUser(req as Request, res as Response);

        expect(statusMock).toHaveBeenCalledWith(403);
        expect(db.transaction).not.toHaveBeenCalled();
      });

      it("soft deletes a technician and releases assigned tickets transactionally", async () => {
        const selectChain = {
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([{ id: "tech-1", rol: "tecnico" }]),
            }),
          }),
        };
        const incidentUpdateChain = {
          set: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([]),
          }),
        };
        const userUpdateChain = {
          set: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([]),
          }),
        };
        const tx = {
          update: vi.fn()
            .mockReturnValueOnce(incidentUpdateChain)
            .mockReturnValueOnce(userUpdateChain),
        };
        (db.select as ReturnType<typeof vi.fn>).mockReturnValue(selectChain);
        (db.transaction as ReturnType<typeof vi.fn>).mockImplementation(async (callback) => callback(tx));
        req.params = { id: "tech-1" };

        await deleteUser(req as Request, res as Response);

        expect(incidentUpdateChain.set).toHaveBeenCalledWith(expect.objectContaining({
          tecnico_id: null,
        }));
        expect(userUpdateChain.set).toHaveBeenCalledWith(expect.objectContaining({
          deleted_at: expect.any(Date),
        }));
        expect(jsonMock).toHaveBeenCalledWith({ message: "Usuario eliminado" });
      });
    });
  });
});
