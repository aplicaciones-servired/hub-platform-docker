import { Request, Response } from "express";
import { ilike, eq, and, or, isNull } from "drizzle-orm";
import { db } from "../../db";
import { puntosVenta, users } from "../../db/schema";
import { logger } from "../../lib/logger";
import { escapeLike } from "../../lib/like";
import { PV_SEED_NAMES } from "../../db/constants";

export async function seedPuntosVenta(
  req: Request,
  res: Response
): Promise<void> {
  try {
    let created = 0;
    for (const nombre of PV_SEED_NAMES) {
      const [existing] = await db
        .select({ id: puntosVenta.id })
        .from(puntosVenta)
        .where(eq(puntosVenta.nombre, nombre))
        .limit(1);

      if (!existing) {
        await db.insert(puntosVenta).values({ nombre });
        created++;
      }
    }

    logger.info(`Seed PV: ${created} created, ${PV_SEED_NAMES.length - created} already existed`);
    res.json({ ok: true, created, total: PV_SEED_NAMES.length });
  } catch (error) {
    logger.error("Seed PV error", { error: (error as Error).message });
    res.status(500).json({ error: "Error al sembrar puntos de venta" });
  }
}

// Lista de puntos de venta REALES: los usuarios con rol "user"
// creados en Gestión de Usuarios (no la lista de ejemplo de puntos_venta).
export async function listPuntosVenta(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const search = String(req.query.search ?? "").slice(0, 100);
    const busqueda = search
      ? or(
          ilike(users.nombre, `%${escapeLike(search)}%`),
          ilike(users.documento, `%${escapeLike(search)}%`)
        )
      : undefined;

    const items = await db
      .select({ id: users.id, documento: users.documento, nombre: users.nombre })
      .from(users)
      .where(and(eq(users.rol, "user"), isNull(users.deleted_at), busqueda))
      .orderBy(users.nombre)
      .limit(5000);

    res.json(items);
  } catch (error) {
    logger.error("List puntos venta error", { error: (error as Error).message });
    res.status(500).json({ error: "Error al listar puntos de venta" });
  }
}
