import { Request, Response } from "express";
import { ilike, eq } from "drizzle-orm";
import { db } from "../../db";
import { puntosVenta } from "../../db/schema";
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

export async function listPuntosVenta(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const search = String(req.query.search ?? "").slice(0, 100);

    const items = await db
      .select()
      .from(puntosVenta)
      .where(search ? ilike(puntosVenta.nombre, `%${escapeLike(search)}%`) : undefined)
      .orderBy(puntosVenta.nombre)
      .limit(100);

    res.json(items);
  } catch (error) {
    logger.error("List puntos venta error", { error: (error as Error).message });
    res.status(500).json({ error: "Error al listar puntos de venta" });
  }
}
