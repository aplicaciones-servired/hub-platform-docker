import { z } from "zod";

export const uuidParamsSchema = z.object({ id: z.string().uuid("ID inválido") });

export const createIncidentSchema = z.object({
  punto_venta: z.string().min(1, "El punto de venta es requerido").max(150),
  telefono: z.string().regex(/^\d{6,20}$/, "El teléfono debe tener entre 6 y 20 dígitos").or(z.literal("")).optional().default(""),
  descripcion: z.string().min(1, "La descripción es requerida").max(2000),
  urgencia: z.enum(["baja", "media", "alta"]).default("media"),
  // Solo admins: atribuir el ticket a otro usuario por documento
  documento: z.string().max(20).optional(),
});

export const updateIncidentSchema = z.object({
  estado: z.enum(["pendiente", "en_proceso", "resuelto"]).optional(),
  agente: z.string().min(1, "El agente no puede estar vacío").max(100).optional(),
  tecnico_id: z.string().uuid().nullable().optional(),
  solucion: z.string().max(5000).optional(),
  imagen_url: z
    .string()
    .max(500)
    .refine(
      (v) => v === "" || v.startsWith("/uploads/") || /^https?:\/\//.test(v),
      "imagen_url debe ser una URL http(s) o una ruta /uploads/"
    )
    .optional(),
});

export const commentSchema = z.object({
  texto: z.string().min(1, "El comentario es requerido").max(5000),
});

export const listIncidentsQuerySchema = {
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
      .default("20")
      .transform(Number)
      .pipe(z.number().int().min(1).max(100)),
    search: z.string().max(100).optional(),
    estado: z.enum(["pendiente", "en_proceso", "resuelto"]).optional(),
    urgencia: z.enum(["baja", "media", "alta"]).optional(),
    start: z
      .string()
      .optional()
      .refine((val) => !val || !isNaN(Date.parse(val)), "start debe ser una fecha válida"),
    end: z
      .string()
      .optional()
      .refine((val) => !val || !isNaN(Date.parse(val)), "end debe ser una fecha válida"),
  }),
};

export const exportQuerySchema = {
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
      .default("1000")
      .transform(Number)
      .pipe(z.number().int().min(1).max(2000)),
    start: z
      .string()
      .optional()
      .refine((val) => !val || !isNaN(Date.parse(val)), "start debe ser una fecha válida"),
    end: z
      .string()
      .optional()
      .refine((val) => !val || !isNaN(Date.parse(val)), "end debe ser una fecha válida"),
  }),
};

export const statsQuerySchema = {
  query: z.object({
    start: z
      .string()
      .optional()
      .refine((val) => !val || !isNaN(Date.parse(val)), "start debe ser una fecha válida"),
    end: z
      .string()
      .optional()
      .refine((val) => !val || !isNaN(Date.parse(val)), "end debe ser una fecha válida"),
    agente: z.string().max(100).optional(),
  }),
};
