import { z } from "zod";

const roles = z.enum(["user", "asesor", "admin", "tecnico"]);

export const uuidParamsSchema = z.object({ id: z.string().uuid("ID inválido") });

export const listUsersQuerySchema = {
  query: z.object({
    page: z
      .string()
      .optional()
      .default("1")
      .transform(Number)
      .pipe(z.number().int().min(1)),
    limit: z
      .string()
      .optional()
      .default("50")
      .transform(Number)
      .pipe(z.number().int().min(1).max(200)),
    search: z.string().optional(),
    rol: roles.optional(),
  }),
};

export const createUserSchema = z.object({
  documento: z.string().trim().min(1, "El documento es requerido").max(20, "El documento no puede superar 20 caracteres"),
  nombre: z.string().trim().min(1, "El nombre es requerido").max(100, "El nombre no puede superar 100 caracteres"),
  contrasena: z.string().min(8, "Mínimo 8 caracteres"),
  rol: roles.optional().default("tecnico"),
});

export const updateUserSchema = {
  body: z.object({
    rol: roles.optional(),
    nombre: z.string().min(1).max(100).optional(),
    documento: z.string().min(1).max(20).optional(),
    email: z.string().email("Email inválido").or(z.literal("")).optional(),
  }),
};

export const resetPasswordSchema = z.object({
  contrasena: z.string().min(8, "Mínimo 8 caracteres"),
});