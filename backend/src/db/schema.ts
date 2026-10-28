import { sql } from "drizzle-orm";
import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  boolean,
  integer,
  jsonb,
  pgEnum,
  index,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";

export const rolEnum = pgEnum("rol", ["user", "asesor", "admin", "tecnico"]);
export const userEstadoEnum = pgEnum("user_estado", ["activo", "bloqueado"]);
export const urgenciaEnum = pgEnum("urgencia", ["baja", "media", "alta"]);
export const estadoEnum = pgEnum("estado", [
  "pendiente",
  "en_proceso",
  "resuelto",
]);

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  documento: varchar("documento", { length: 20 }).notNull().unique(),
  nombre: varchar("nombre", { length: 100 }).notNull(),
  email: varchar("email", { length: 150 }),
  contrasena: varchar("contrasena", { length: 255 }).notNull(),
  rol: rolEnum("rol").notNull().default("user"),
  estado: userEstadoEnum("estado").notNull().default("activo"),
  ultima_actividad: timestamp("ultima_actividad"),
  token_version: integer("token_version").notNull().default(0),
  token_version_admin: integer("token_version_admin").notNull().default(0),
  token_version_user: integer("token_version_user").notNull().default(0),
  intentos_fallidos: integer("intentos_fallidos").notNull().default(0),
  bloqueado_hasta: timestamp("bloqueado_hasta"),
  bloqueado_por: uuid("bloqueado_por").references(
    (): AnyPgColumn => users.id,
    {
      onDelete: "set null",
    }
  ),
  deleted_at: timestamp("deleted_at"),
  created_at: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("users_estado_idx").on(table.estado),
  index("users_documento_deleted_at_idx").on(table.documento, table.deleted_at),
  index("users_deleted_at_idx").on(table.deleted_at),
]);

export const incidents = pgTable(
  "incidents",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    user_id: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    nombre: varchar("nombre", { length: 100 }).notNull(),
    documento: varchar("documento", { length: 20 }).notNull(),
    punto_venta: varchar("punto_venta", { length: 150 }).notNull(),
    telefono: varchar("telefono", { length: 20 }).notNull().default(""),
    descripcion: text("descripcion").notNull(),
    urgencia: urgenciaEnum("urgencia").notNull().default("media"),
    estado: estadoEnum("estado").notNull().default("pendiente"),
    agente: varchar("agente", { length: 100 }),
    tecnico_id: uuid("tecnico_id").references(() => users.id, { onDelete: "set null" }),
    solucion: text("solucion"),
    imagen_url: varchar("imagen_url", { length: 500 }),
    cerrado_por: uuid("cerrado_por").references(() => users.id, { onDelete: "set null" }),
    fecha_cierre: timestamp("fecha_cierre"),
    visto_por_admin: boolean("visto_por_admin").notNull().default(false),
    deleted_at: timestamp("deleted_at"),
    created_at: timestamp("created_at").defaultNow().notNull(),
    updated_at: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("incidents_user_id_idx").on(table.user_id),
    index("incidents_estado_idx").on(table.estado),
    index("incidents_urgencia_idx").on(table.urgencia),
    index("incidents_created_at_idx").on(table.created_at),
    index("incidents_user_estado_idx").on(table.user_id, table.estado),
    index("incidents_agente_idx").on(table.agente),
    index("incidents_tecnico_id_idx").on(table.tecnico_id),
    index("incidents_cerrado_por_idx").on(table.cerrado_por),
    index("incidents_deleted_at_idx").on(table.deleted_at),
  ]
);

export const messages = pgTable(
  "messages",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    user_id: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    content: text("content").notNull(),
    is_bot: boolean("is_bot").notNull().default(false),
    metadata: jsonb("metadata"),
    created_at: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("messages_user_id_idx").on(table.user_id),
    index("messages_created_at_idx").on(table.created_at),
  ]
);

export const incidentComments = pgTable(
  "incident_comments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    incident_id: uuid("incident_id")
      .references(() => incidents.id, { onDelete: "cascade" })
      .notNull(),
    autor: varchar("autor", { length: 100 }).notNull(),
    texto: text("texto").notNull(),
    fecha: timestamp("fecha").defaultNow().notNull(),
  },
  (table) => [index("incident_comments_incident_id_idx").on(table.incident_id)]
);



export const puntosVenta = pgTable(
  "puntos_venta",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    nombre: varchar("nombre", { length: 150 }).notNull().unique(),
    activo: boolean("activo").notNull().default(true),
    created_at: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("puntos_venta_nombre_idx").on(table.nombre),
  ]
);

export const companySettings = pgTable("company_settings", {
  id: uuid("id").defaultRandom().primaryKey(),
  key: varchar("key", { length: 10 }).notNull().default("default").unique(),
  nombre: varchar("nombre", { length: 200 }).notNull().default(""),
  contribuyente: varchar("contribuyente", { length: 50 }).notNull().default(""),
  direccion: text("direccion").notNull().default(""),
  updated_at: timestamp("updated_at").defaultNow().notNull(),
});

export const pushTokens = pgTable(
  "push_tokens",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    user_id: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    token: varchar("token", { length: 255 }).notNull().unique(),
    created_at: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("push_tokens_user_id_idx").on(table.user_id),
  ]
);

// Sesiones de refresh token: una fila por refresh emitido.
// id = jti del JWT; token_hash = sha256 (nunca el token en claro).
// La rotación marca revoked_at y crea una nueva fila; un JWT válido cuya
// fila está revocada indica reuso (robo) y revoca todas las sesiones.
export const refreshTokens = pgTable(
  "refresh_tokens",
  {
    id: uuid("id").primaryKey(),
    user_id: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    scope: varchar("scope", { length: 5 }).notNull(),
    token_hash: varchar("token_hash", { length: 64 }).notNull().unique(),
    expires_at: timestamp("expires_at").notNull(),
    created_at: timestamp("created_at").defaultNow().notNull(),
    revoked_at: timestamp("revoked_at"),
  },
  (table) => [
    index("refresh_tokens_user_id_idx").on(table.user_id),
    index("refresh_tokens_user_scope_idx").on(table.user_id, table.scope),
    index("refresh_tokens_expires_at_idx").on(table.expires_at),
  ]
);
