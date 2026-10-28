import { describe, it, expect } from "vitest";
import {
  uuidParamsSchema,
  listUsersQuerySchema,
  createUserSchema,
  updateUserSchema,
  resetPasswordSchema,
} from "./users.schema";

describe("users uuidParamsSchema", () => {
  it("accepts a valid UUID", () => {
    const result = uuidParamsSchema.parse({
      id: "550e8400-e29b-41d4-a716-446655440000",
    });
    expect(result.id).toBe("550e8400-e29b-41d4-a716-446655440000");
  });

  it("rejects invalid UUID", () => {
    expect(() => uuidParamsSchema.parse({ id: "bad" })).toThrow();
  });
});

describe("listUsersQuerySchema", () => {
  it("defaults page and limit", () => {
    const result = listUsersQuerySchema.query.parse({});
    expect(result.page).toBe(1);
    expect(result.limit).toBe(50);
  });

  it("accepts valid rol filter", () => {
    const result = listUsersQuerySchema.query.parse({ rol: "admin" });
    expect(result.rol).toBe("admin");
  });

  it("rejects invalid rol", () => {
    expect(() =>
      listUsersQuerySchema.query.parse({ rol: "superadmin" })
    ).toThrow();
  });

  it("rejects limit > 200", () => {
    expect(() =>
      listUsersQuerySchema.query.parse({ limit: "300" })
    ).toThrow();
  });
});

describe("createUserSchema", () => {
  it("accepts valid input", () => {
    const result = createUserSchema.parse({
      documento: "12345678",
      nombre: "New User",
      contrasena: "password",
    });
    expect(result.rol).toBe("tecnico");
  });

  it("accepts explicit rol", () => {
    const result = createUserSchema.parse({
      documento: "12345678",
      nombre: "Admin User",
      contrasena: "password",
      rol: "admin",
    });
    expect(result.rol).toBe("admin");
  });

  it("trims documento and nombre", () => {
    const result = createUserSchema.parse({
      documento: " 12345678 ",
      nombre: " New User ",
      contrasena: "password",
    });

    expect(result.documento).toBe("12345678");
    expect(result.nombre).toBe("New User");
  });

  it("rejects documento and nombre over their maximum lengths", () => {
    expect(() =>
      createUserSchema.parse({
        documento: "1".repeat(21),
        nombre: "New User",
        contrasena: "password",
      })
    ).toThrow("El documento no puede superar 20 caracteres");

    expect(() =>
      createUserSchema.parse({
        documento: "12345678",
        nombre: "N".repeat(101),
        contrasena: "password",
      })
    ).toThrow("El nombre no puede superar 100 caracteres");
  });

  it("rejects short contrasena", () => {
    expect(() =>
      createUserSchema.parse({
        documento: "12345678",
        nombre: "Test",
        contrasena: "12345",
      })
    ).toThrow();
  });

  it("rejects invalid rol", () => {
    expect(() =>
      createUserSchema.parse({
        documento: "12345678",
        nombre: "Test",
        contrasena: "password",
        rol: "superadmin",
      })
    ).toThrow();
  });
});

describe("updateUserSchema", () => {
  it("accepts empty body", () => {
    const result = updateUserSchema.body.parse({});
    expect(result).toEqual({});
  });

  it("accepts valid email", () => {
    const result = updateUserSchema.body.parse({
      email: "test@hub.ai",
    });
    expect(result.email).toBe("test@hub.ai");
  });

  it("accepts empty string email", () => {
    const result = updateUserSchema.body.parse({ email: "" });
    expect(result.email).toBe("");
  });

  it("rejects invalid email", () => {
    expect(() =>
      updateUserSchema.body.parse({ email: "not-an-email" })
    ).toThrow();
  });

  it("accepts valid rol", () => {
    const result = updateUserSchema.body.parse({ rol: "admin" });
    expect(result.rol).toBe("admin");
  });
});

describe("resetPasswordSchema", () => {
  it("accepts valid password", () => {
    const result = resetPasswordSchema.parse({ contrasena: "newpassword" });
    expect(result.contrasena).toBe("newpassword");
  });

  it("rejects short password", () => {
    expect(() => resetPasswordSchema.parse({ contrasena: "12345" })).toThrow();
  });
});
