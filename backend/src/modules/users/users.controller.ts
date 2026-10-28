import { Request, Response } from "express";
import bcrypt from "bcryptjs";
import { eq, ne, and, sql, ilike, or, isNull } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "../../db";
import { incidents, users } from "../../db/schema";
import { escapeLike } from "../../lib/like";
import { isUniqueViolation } from "../../lib/pg";
import { logger } from "../../lib/logger";
import { env } from "../../config/env";

const blockerUsers = alias(users, "blocker_users");

export async function createUser(req: Request, res: Response): Promise<void> {
  try {
    const { documento, nombre, contrasena, rol } = req.body;

    if (rol === "admin" && req.user!.rol !== "admin") {
      res.status(403).json({ error: "Solo un administrador puede crear usuarios con rol admin" });
      return;
    }

    const [existing] = await db
      .select()
      .from(users)
      .where(and(eq(users.documento, documento), isNull(users.deleted_at)))
      .limit(1);

    if (existing) {
      res.status(409).json({ error: "El documento ya está registrado" });
      return;
    }

    const hashed = await bcrypt.hash(contrasena, 12);

    const [user] = await db
      .insert(users)
      .values({
        documento,
        nombre,
        contrasena: hashed,
        email: `${documento}@${env.EMAIL_DOMAIN}`,
        rol,
      })
      .returning();

    res.status(201).json({
      id: user.id,
      documento: user.documento,
      nombre: user.nombre,
      email: user.email,
      rol: user.rol,
      estado: user.estado,
      created_at: user.created_at,
    });
  } catch (error) {
    // El unique de documento es global (incluye soft-deleted): una carrera
    // entre el check y el INSERT termina aquí → 409, no 500
    if (isUniqueViolation(error)) {
      res.status(409).json({ error: "El documento ya está registrado" });
      return;
    }
    logger.error("Create user error", { error: (error as Error).message });
    res.status(500).json({ error: "Error al crear usuario" });
  }
}

export async function listUsers(req: Request, res: Response): Promise<void> {
  try {
    const q = req.validatedQuery!;
    const page = q.page as number;
    const limit = q.limit as number;
    const offset = (page - 1) * limit;
    const search = q.search as string | undefined;
    const rol = q.rol as string | undefined;

    const conditions: ReturnType<typeof eq>[] = [isNull(users.deleted_at)];

    if (rol) {
      conditions.push(eq(users.rol, rol as "admin" | "user" | "tecnico" | "asesor"));
    }

    if (search) {
      const term = escapeLike(search);
      conditions.push(
        or(
          ilike(users.nombre, `%${term}%`),
          ilike(users.documento, `%${term}%`),
          ilike(users.email, `%${term}%`)
        ) as ReturnType<typeof eq>
      );
    }

    const whereClause = and(...conditions);

    const totalResult = await db.$count(users, whereClause);

    // Distribución por rol SIN filtros: alimenta las tarjetas de resumen
    // aunque la página esté filtrada o paginada
    const roleCounts = await db
      .select({ rol: users.rol, count: sql<number>`count(*)::int` })
      .from(users)
      .where(isNull(users.deleted_at))
      .groupBy(users.rol);

    const countsMap = Object.fromEntries(roleCounts.map((r) => [r.rol, r.count]));

    const items = await db
      .select({
        id: users.id,
        documento: users.documento,
        nombre: users.nombre,
        email: users.email,
        rol: users.rol,
        estado: users.estado,
        ultima_actividad: users.ultima_actividad,
        created_at: users.created_at,
        bloqueado_por: users.bloqueado_por,
        bloqueado_por_documento: blockerUsers.documento,
      })
      .from(users)
      .leftJoin(blockerUsers, eq(users.bloqueado_por, blockerUsers.id))
      .where(whereClause)
      .limit(limit)
      .offset(offset);

    res.json({
      items,
      total: totalResult,
      page,
      limit,
      totalPages: Math.ceil(totalResult / limit),
      counts: {
        total: roleCounts.reduce((acc, r) => acc + r.count, 0),
        admin: countsMap.admin ?? 0,
        user: countsMap.user ?? 0,
        tecnico: countsMap.tecnico ?? 0,
        asesor: countsMap.asesor ?? 0,
      },
    });
  } catch (error) {
    logger.error("List users error", { error: (error as Error).message });
    res.status(500).json({ error: "Error al listar usuarios" });
  }
}

export async function toggleUserStatus(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const { id } = req.params as { id: string };

    const [user] = await db
      .select({ id: users.id, estado: users.estado, rol: users.rol })
      .from(users)
      .where(and(eq(users.id, id), isNull(users.deleted_at)))
      .limit(1);

    if (!user) {
      res.status(404).json({ error: "Usuario no encontrado" });
      return;
    }

    if (user.rol === "admin") {
      res.status(403).json({ error: "No se puede cambiar el estado de una cuenta de administrador" });
      return;
    }

    const newEstado = user.estado === "activo" ? "bloqueado" : "activo";

    const updateData: Record<string, unknown> = { estado: newEstado };
    updateData.token_version = sql`${users.token_version} + 1`;
    if (newEstado === "bloqueado") {
      updateData.bloqueado_por = req.user!.userId;
      updateData.bloqueado_hasta = null; // bloqueo manual = permanente
    } else {
      updateData.bloqueado_por = null;
      updateData.intentos_fallidos = 0;
      updateData.bloqueado_hasta = null;
    }

    const [updated] = await db
      .update(users)
      .set(updateData)
      .where(and(eq(users.id, id), isNull(users.deleted_at)))
      .returning({
        id: users.id,
        nombre: users.nombre,
        rol: users.rol,
        estado: users.estado,
        bloqueado_por: users.bloqueado_por,
      });

    res.json(updated);
  } catch (error) {
    logger.error("Toggle user status error", { error: (error as Error).message });
    res.status(500).json({ error: "Error al cambiar estado del usuario" });
  }
}

export async function resetPassword(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params as { id: string };
    const { contrasena } = req.body;

    const [target] = await db
      .select({ rol: users.rol })
      .from(users)
      .where(and(eq(users.id, id), isNull(users.deleted_at)))
      .limit(1);

    if (!target) {
      res.status(404).json({ error: "Usuario no encontrado" });
      return;
    }

    if (target.rol === "admin" && req.user!.rol !== "admin") {
      res.status(403).json({ error: "Solo un administrador puede restablecer la contraseña de una cuenta admin" });
      return;
    }

    const hashed = await bcrypt.hash(contrasena, 12);

    const [updated] = await db
      .update(users)
      .set({
        contrasena: hashed,
        intentos_fallidos: 0,
        estado: "activo",
        token_version: sql`${users.token_version} + 1`,
      })
      .where(and(eq(users.id, id), isNull(users.deleted_at)))
      .returning({
        id: users.id,
        documento: users.documento,
        nombre: users.nombre,
        rol: users.rol,
        estado: users.estado,
      });

    res.json({ message: "Contraseña restablecida exitosamente", user: updated });
  } catch (error) {
    logger.error("Reset password error", { error: (error as Error).message });
    res.status(500).json({ error: "Error al restablecer la contraseña" });
  }
}

export async function updateUser(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params as { id: string };
    const { rol, nombre, email, documento } = req.body;

    const [targetUser] = await db
      .select({ rol: users.rol })
      .from(users)
      .where(and(eq(users.id, id), isNull(users.deleted_at)))
      .limit(1);

    if (targetUser && targetUser.rol === "admin" && req.user!.rol !== "admin") {
      res.status(403).json({ error: "Solo un administrador puede modificar una cuenta de administrador" });
      return;
    }

    if (rol !== undefined && req.user!.rol !== "admin") {
      res.status(403).json({ error: "Solo un administrador puede cambiar el rol de un usuario" });
      return;
    }

    if (rol !== undefined && rol !== "admin" && rol !== "tecnico") {
      if (targetUser && targetUser.rol === "admin") {
        const [count] = await db
          .select({ total: sql<number>`count(*)`.mapWith(Number) })
          .from(users)
          .where(and(eq(users.rol, "admin"), ne(users.id, id), isNull(users.deleted_at)));

        if (count.total === 0) {
          res.status(403).json({ error: "No se puede degradar al único administrador" });
          return;
        }
      }

    }

    if (documento !== undefined) {
      const [duplicate] = await db
        .select({ id: users.id })
        .from(users)
        .where(and(eq(users.documento, documento), ne(users.id, id), isNull(users.deleted_at)))
        .limit(1);

      if (duplicate) {
        res.status(409).json({ error: "El documento ya está registrado por otro usuario" });
        return;
      }
    }

    const updateData: Record<string, unknown> = {};
    if (rol !== undefined) updateData.rol = rol;
    if (nombre !== undefined) updateData.nombre = nombre;
    if (email !== undefined) updateData.email = email;
    if (documento !== undefined) {
      updateData.documento = documento;
      updateData.email = `${documento}@${env.EMAIL_DOMAIN}`;
    }
    if (rol !== undefined) {
      updateData.token_version = sql`${users.token_version} + 1`;
    }

    if (Object.keys(updateData).length === 0) {
      res.status(400).json({ error: "No hay campos para actualizar" });
      return;
    }

    const [updated] = await db
      .update(users)
      .set(updateData)
      .where(and(eq(users.id, id), isNull(users.deleted_at)))
      .returning({
        id: users.id,
        documento: users.documento,
        nombre: users.nombre,
        email: users.email,
        rol: users.rol,
        created_at: users.created_at,
      });

    if (!updated) {
      res.status(404).json({ error: "Usuario no encontrado" });
      return;
    }

    res.json(updated);
  } catch (error) {
    if (isUniqueViolation(error)) {
      res.status(409).json({ error: "El documento ya está registrado por otro usuario" });
      return;
    }
    logger.error("Update user error", { error: (error as Error).message });
    res.status(500).json({ error: "Error al actualizar usuario" });
  }
}

export async function deleteUser(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params as { id: string };

    if (id === req.user!.userId) {
      res.status(403).json({ error: "No puedes eliminar tu propia cuenta" });
      return;
    }

    const [targetUser] = await db
      .select({ id: users.id, rol: users.rol })
      .from(users)
      .where(and(eq(users.id, id), isNull(users.deleted_at)))
      .limit(1);

    if (!targetUser) {
      res.status(404).json({ error: "Usuario no encontrado" });
      return;
    }

    if (targetUser.rol === "admin") {
      res.status(403).json({ error: "No se puede eliminar una cuenta de administrador" });
      return;
    }

    await db.transaction(async (tx) => {
      if (targetUser.rol === "tecnico") {
        await tx
          .update(incidents)
          .set({ tecnico_id: null, updated_at: new Date() })
          .where(eq(incidents.tecnico_id, id));
      }

      await tx
        .update(users)
        .set({
          deleted_at: new Date(),
          token_version: sql`${users.token_version} + 1`,
        })
        .where(and(eq(users.id, id), isNull(users.deleted_at)));
    });

    res.json({ message: "Usuario eliminado" });
  } catch (error) {
    logger.error("Delete user error", { error: (error as Error).message });
    res.status(500).json({ error: "Error al eliminar usuario" });
  }
}
