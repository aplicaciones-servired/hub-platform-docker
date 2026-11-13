import { z } from "zod";

export const loginSchema = z.object({
  documento: z
    .string()
    .min(1, "La sucursal es requerida")
    .max(50, "El nombre o código es demasiado largo"), 
  contrasena: z.string().min(6, "Mínimo 6 caracteres"),
  scope: z.enum(["admin", "user"]).optional(),
});