import { z } from "zod";

export const loginSchema = z.object({
  documento: z
    .string()
    .min(1, "La sucursal es requerida")
    .max(50, "El nombre o código es demasiado largo"), 
  contrasena: z.string().min(6, "Mínimo 6 caracteres"),
  scope: z.enum(["admin", "user"]).optional(),
});


export const registerSchema = z.object({
  documento: z
    .string()
    .min(1, "El documento es requerido")
    .max(20)
    .regex(/^\d+$/, "El documento debe contener solo números"),
  nombre: z.string().min(1, "El nombre es requerido").max(100),
  contrasena: z.string().min(8, "Mínimo 8 caracteres"),
});