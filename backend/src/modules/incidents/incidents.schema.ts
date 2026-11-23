import { z } from "zod";

// Tipos de incidente válidos. Deben coincidir con los códigos de
// mobile/src/constants/categorias.ts
export const CATEGORIAS_INCIDENTE = [
  "aplicativos",
  "bloqueo_usuario",
  "internet_vpn",
  "impresoras_pda",
  "baterias",
  "energia",
  "otro",
] as const;

export const uuidParamsSchema = z.object({ id: z.string().uuid("ID inválido") });

export const createIncidentSchema = z.object({
  punto_venta: z.string().min(1, "El punto de venta es requerido").max(150),
  telefono: z.string().regex(/^\d{6,20}$/, "El teléfono debe tener entre 6 y 20 dígitos").or(z.literal("")).optional().default(""),
  descripcion: z.string().min(1, "La descripción es requerida").max(2000),
  urgencia: z.enum(["baja", "media", "alta"]).default("media"),
    categoria: z.enum(CATEGORIAS_INCIDENTE).optional(),
  // Solo admins: atribuir el ticket a otro usuario por documento
    reportante_nombre: z.string().trim().min(3, "El nombre debe tener al menos 3 letras").max(100).optional(),
  reportante_cedula: z.string().trim().regex(/^\d{6,10}$/, "La cédula debe tener entre 6 y 10 números").optional(),
    imagenes: z
    .array(z.string().regex(/^incidentes\/\d{4}\/\d{2}\/[0-9a-f-]{36}\.(jpg|png|webp)$/, "Foto inválida"))
    .max(3, "Máximo 3 fotos por reporte")
    .optional(),
  
  documento: z.string().max(20).optional(),
});

export const updateIncidentSchema = z.object({
  estado: z.enum(["pendiente", "en_proceso", "resuelto"]).optional(),
  agente: z.string().min(1, "El técnico no puede estar vacío").max(100).optional(),
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
    comentario: z.string().optional(),
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
    assignedOnly: z.enum(["true", "false"]).optional().transform((value) => value === "true"),
    estado: z.enum(["pendiente", "en_proceso", "resuelto"]).optional(),
    urgencia: z.enum(["baja", "media", "alta"]).optional(),
     categoria: z.enum(CATEGORIAS_INCIDENTE).optional(),
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
    assignedOnly: z.enum(["true", "false"]).optional().transform((value) => value === "true"),
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
