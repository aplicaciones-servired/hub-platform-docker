import { describe, it, expect } from "vitest";
import { loginSchema, registerSchema } from "./auth.schema";

describe("loginSchema", () => {
  it("accepts valid input", () => {
    const result = loginSchema.parse({
      documento: "12345678",
      contrasena: "password",
    });
    expect(result.documento).toBe("12345678");
    expect(result.contrasena).toBe("password");
  });

  it("rejects empty documento", () => {
    expect(() =>
      loginSchema.parse({ documento: "", contrasena: "password" })
    ).toThrow();
  });

  it("rejects documento over 50 characters", () => {
    expect(() =>
      loginSchema.parse({
        documento: "a".repeat(51),
        contrasena: "password",
      })
    ).toThrow();
  });

  it("rejects contrasena under 4 characters", () => {
    expect(() =>
      loginSchema.parse({ documento: "123", contrasena: "ab" })
    ).toThrow();
  });

  it("rejects missing contrasena", () => {
    expect(() => loginSchema.parse({ documento: "123" })).toThrow();
  });
});

describe("registerSchema", () => {
  it("accepts valid input", () => {
    const result = registerSchema.parse({
      documento: "12345678",
      nombre: "Test User",
      contrasena: "password",
    });
    expect(result.documento).toBe("12345678");
    expect(result.nombre).toBe("Test User");
  });

  it("rejects empty nombre", () => {
    expect(() =>
      registerSchema.parse({
        documento: "12345678",
        nombre: "",
        contrasena: "password",
      })
    ).toThrow();
  });

  it("rejects contrasena under 6 characters", () => {
    expect(() =>
      registerSchema.parse({
        documento: "12345678",
        nombre: "Test",
        contrasena: "12345",
      })
    ).toThrow();
  });
});
