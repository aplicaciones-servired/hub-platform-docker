import { Request, Response } from "express";
import { eq, ilike, or, and, desc, gte, lte, isNotNull, ne, inArray, isNull, sql } from "drizzle-orm";
import { db } from "../../db";
import { incidents, incidentComments, users, messages, pushTokens } from "../../db/schema";
import { logger } from "../../lib/logger";
import { env } from "../../config/env";
import { escapeLike } from "../../lib/like";
import { colombiaDayStart, colombiaDayEnd } from "../../lib/dates";

type ExpoPushMessage = { to: string } & Record<string, unknown>;

/**
 * Envía push vía Expo en lotes de <=100 (límite de la API) y hace best-effort
 * de limpieza: tokens que Expo reporta como DeviceNotRegistered se eliminan
 * para no acumular tokens muertos ni desperdiciar cuota.
 */
async function sendExpoPush(messages: ExpoPushMessage[]): Promise<void> {
  const CHUNK_SIZE = 100;
  for (let offset = 0; offset < messages.length; offset += CHUNK_SIZE) {
    const chunk = messages.slice(offset, offset + CHUNK_SIZE);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    try {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        Accept: "application/json",
      };
      if (env.EXPO_ACCESS_TOKEN) {
        headers["Expo-Access-Token"] = env.EXPO_ACCESS_TOKEN;
      }
      const response = await fetch("https://exp.host/--/api/v2/push/send", {
        method: "POST",
        headers,
        body: JSON.stringify(chunk),
        signal: controller.signal,
      });
      if (!response.ok) {
        logger.warn("Push notification response", { status: response.status });
        continue;
      }
      const body = (await response.json().catch(() => null)) as {
        data?: Array<{ status?: string; message?: { details?: Array<{ errorCode?: string }> } }>;
      } | null;
      const tickets = body?.data;
      if (!Array.isArray(tickets)) continue;
      for (let i = 0; i < tickets.length; i++) {
        const ticket = tickets[i];
        const errorCodes = (ticket.message?.details ?? [])
          .map((d) => d.errorCode)
          .join(",");
        if (errorCodes.includes("DeviceNotRegistered")) {
          await db
            .delete(pushTokens)
            .where(eq(pushTokens.token, chunk[i].to))
            .catch(() => {});
        }
      }
    } catch (err) {
      logger.warn("Push notification send error", { error: (err as Error).message });
    } finally {
      clearTimeout(timeout);
    }
  }
}

export async function createIncident(
  req: Request,
  res: Response
): Promise<void> {
  try {
    // Un admin puede abrir un ticket A NOMBRE DE un usuario (documento en el
    // body); para usuarios normales el documento se ignora y el ticket es suyo
    const targetDocumento =
      (req.user!.rol === "admin" || req.user!.rol === "tecnico") &&
      typeof req.body.documento === "string" &&
      req.body.documento.trim().length > 0
        ? req.body.documento.trim()
        : undefined;

    let owner: { id: string; nombre: string; documento: string } | undefined;

    if (targetDocumento) {
      const [targetUser] = await db
        .select({ id: users.id, nombre: users.nombre, documento: users.documento })
        .from(users)
        .where(and(eq(users.documento, targetDocumento), isNull(users.deleted_at)))
        .limit(1);

      if (!targetUser) {
        res.status(404).json({ error: "No existe un usuario con ese documento" });
        return;
      }
      owner = targetUser;
    } else {
      const [self] = await db
        .select({ id: users.id, nombre: users.nombre, documento: users.documento })
        .from(users)
        .where(and(eq(users.id, req.user!.userId), isNull(users.deleted_at)))
        .limit(1);

      if (!self) {
        res.status(401).json({ error: "Usuario no encontrado" });
        return;
      }
      owner = self;
    }

    const [incident] = await db
      .insert(incidents)
      .values({
        user_id: owner.id,
        nombre: owner.nombre,
        documento: owner.documento,
        punto_venta: targetDocumento ? req.body.punto_venta : owner.nombre,
        telefono: req.body.telefono || "",
        descripcion: req.body.descripcion,
        urgencia: req.body.urgencia || "media",
        estado: "pendiente",
        visto_por_admin: false,
      })
      .returning();

    res.status(201).json(incident);
  } catch (error) {
    logger.error("Create incident error", { error: (error as Error).message });
    res.status(500).json({ error: "Error al crear el incidente" });
  }
}

export async function listIncidents(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const q = req.validatedQuery!;
    const page = q.page as number;
    const limit = q.limit as number;
    const offset = (page - 1) * limit;
    const search = q.search as string | undefined;
    const estado = q.estado as string | undefined;
    const urgencia = q.urgencia as string | undefined;

    const conditions = [isNull(incidents.deleted_at)];

    // Non-admin users only see their own incidents
    if (req.user!.rol !== "admin" && req.user!.rol !== "tecnico") {
      conditions.push(eq(incidents.user_id, req.user!.userId));
    }

    if (q.start && q.end) {
      conditions.push(gte(incidents.created_at, colombiaDayStart(q.start as string)));
      conditions.push(lte(incidents.created_at, colombiaDayEnd(q.end as string)));
    }

    if (search) {
      const hexChars = search.replace(/[^A-Fa-f0-9]/g, "").toLowerCase();
      const term = escapeLike(search);
      conditions.push(
        or(
          hexChars.length >= 4 ? sql`replace(${incidents.id}::text, '-', '') ILIKE ${`%${escapeLike(hexChars)}`}` : sql`1=0`,
          ilike(incidents.nombre, `%${term}%`),
          ilike(incidents.punto_venta, `%${term}%`),
          ilike(incidents.descripcion, `%${term}%`)
        ) ?? sql`1=0`
      );
    }

    if (estado) {
      conditions.push(
        eq(incidents.estado, estado as "pendiente" | "en_proceso" | "resuelto")
      );
    }

    if (urgencia) {
      conditions.push(
        eq(incidents.urgencia, urgencia as "baja" | "media" | "alta")
      );
    }

    const whereClause =
      conditions.length > 0 ? and(...conditions) : undefined;

    const totalResult = await db.$count(
      incidents,
      whereClause
    );

    const items = await db
      .select()
      .from(incidents)
      .where(whereClause)
      .orderBy(desc(incidents.created_at))
      .limit(limit)
      .offset(offset);

    res.json({
      items,
      total: totalResult,
      page,
      limit,
      totalPages: Math.ceil(totalResult / limit),
    });
  } catch (error) {
    logger.error("List incidents error", { error: (error as Error).message });
    res.status(500).json({ error: "Error al listar incidentes" });
  }
}

export async function getIncident(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const { id } = req.params as { id: string };

    const [incident] = await db
      .select()
      .from(incidents)
      .where(and(eq(incidents.id, id), isNull(incidents.deleted_at)))
      .limit(1);

    if (!incident) {
      res.status(404).json({ error: "Incidente no encontrado" });
      return;
    }

    // Non-admin users can only see their own incidents
    if (req.user!.rol !== "admin" && req.user!.rol !== "tecnico" && incident.user_id !== req.user!.userId) {
      res.status(403).json({ error: "Acceso denegado" });
      return;
    }

    let cerrado_por_nombre: string | null = null;
    if (incident.cerrado_por) {
      const [user] = await db
        .select({ nombre: users.nombre })
        .from(users)
        .where(and(eq(users.id, incident.cerrado_por), isNull(users.deleted_at)))
        .limit(1);
      cerrado_por_nombre = user?.nombre || null;
    }

    const comments = await db
      .select()
      .from(incidentComments)
      .where(eq(incidentComments.incident_id, id))
      .orderBy(desc(incidentComments.fecha));

    res.json({ ...incident, cerrado_por_nombre, comments });
  } catch (error) {
    logger.error("Get incident error", { error: (error as Error).message });
    res.status(500).json({ error: "Error al obtener el incidente" });
  }
}

const VALID_TRANSITIONS: Record<string, string[]> = {
  pendiente: ["en_proceso", "resuelto"],
  en_proceso: ["resuelto"],
  resuelto: [],
};

export async function updateIncident(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const { id } = req.params as { id: string };
    const { estado, agente, solucion, imagen_url } = req.body;

    let previousEstado: "pendiente" | "en_proceso" | "resuelto" | undefined;

    if (estado) {
      const [current] = await db
        .select({ estado: incidents.estado })
        .from(incidents)
        .where(and(eq(incidents.id, id), isNull(incidents.deleted_at)))
        .limit(1);

      previousEstado = current?.estado;

      if (current && estado !== current.estado) {
        const allowed = VALID_TRANSITIONS[current.estado];
        if (!allowed || !allowed.includes(estado)) {
          res.status(400).json({
            error: `Transición inválida: de "${current.estado}" a "${estado}"`,
          });
          return;
        }
      }
    }

    const updateData: Record<string, unknown> = { updated_at: new Date() };
    if (estado) updateData.estado = estado;
    if (agente !== undefined) updateData.agente = agente;
    if (solucion !== undefined) updateData.solucion = solucion;
    if (imagen_url !== undefined) updateData.imagen_url = imagen_url;

    if (estado === "resuelto") {
      updateData.cerrado_por = req.user!.userId;
      updateData.fecha_cierre = new Date();
    }

    // Condicionar el UPDATE por el estado leído: cierra la carrera entre el
    // SELECT de validación y el UPDATE (dos PATCH concurrentes a "resuelto"
    // ya no pueden ganar ambos y duplicar mensaje bot + push)
    const updateConditions = [eq(incidents.id, id), isNull(incidents.deleted_at)];
    if (estado && previousEstado !== undefined) {
      updateConditions.push(eq(incidents.estado, previousEstado));
    }

    const [updated] = await db
      .update(incidents)
      .set(updateData)
      .where(and(...updateConditions))
      .returning();

    if (!updated) {
      // Distinguir: ¿no existe, o cambió el estado debajo nuestro?
      if (estado && previousEstado !== undefined) {
        const [still] = await db
          .select({ estado: incidents.estado })
          .from(incidents)
          .where(and(eq(incidents.id, id), isNull(incidents.deleted_at)))
          .limit(1);
        if (still) {
          res.status(409).json({
            error: `El estado del ticket cambió concurrentemente (ahora "${still.estado}"). Refresca e intenta de nuevo.`,
          });
          return;
        }
      }
      res.status(404).json({ error: "Incidente no encontrado" });
      return;
    }

    // Notificar solo en la TRANSICIÓN a resuelto (no al re-guardar la solución)
    if (estado === "resuelto" && previousEstado !== "resuelto") {
      const shortId = id.replace(/-/g, "").slice(-8).toUpperCase();
      const botMessage = `Tu ticket #TK-${shortId} ha sido marcado como **Resuelto**.\n\n${solucion ? `**Solucion:** ${solucion}\n\n` : ""}Si necesita mas ayuda, contactenos.`;

      try {
        await db.insert(messages).values({
          user_id: updated.user_id,
          content: botMessage,
          is_bot: true,
          metadata: { ticketId: updated.id },
        });

        // Send push notification
        const userTokens = await db
          .select({ token: pushTokens.token })
          .from(pushTokens)
          .where(eq(pushTokens.user_id, updated.user_id));

        if (userTokens.length > 0) {
          const pushMessages = userTokens.map((t) => ({
            to: t.token,
            sound: "default" as const,
            title: "Ticket resuelto",
            body: `Tu ticket #TK-${shortId} ha sido resuelto.${solucion ? ` Solución: ${solucion}` : ""}`,
            data: { incidentId: id },
          }));

          await sendExpoPush(pushMessages);
        }
      } catch (notifyErr) {
        // La actualización ya se aplicó; un fallo de notificación no debe dar 500
        logger.error("Resolved notification error", { error: (notifyErr as Error).message });
      }
    }

    res.json(updated);
  } catch (error) {
    logger.error("Update incident error", { error: (error as Error).message });
    res.status(500).json({ error: "Error al actualizar el incidente" });
  }
}

export async function addComment(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const { id } = req.params as { id: string };
    const { texto } = req.body;

    const [incident] = await db
      .select()
      .from(incidents)
      .where(and(eq(incidents.id, id), isNull(incidents.deleted_at)))
      .limit(1);

    if (!incident) {
      res.status(404).json({ error: "Incidente no encontrado" });
      return;
    }

    if (req.user!.rol !== "admin" && req.user!.rol !== "tecnico" && incident.user_id !== req.user!.userId) {
      res.status(403).json({ error: "No puedes comentar incidentes de otros usuarios" });
      return;
    }

    const [user] = await db
      .select({ nombre: users.nombre })
      .from(users)
      .where(eq(users.id, req.user!.userId))
      .limit(1);

    const autor = user?.nombre || req.user!.documento;

    const [comment] = await db
      .insert(incidentComments)
      .values({
        incident_id: id,
        autor,
        texto,
      })
      .returning();

    // Notify ticket owner when admin/technician responds
    if (req.user!.rol === "admin" || req.user!.rol === "tecnico") {
      const shortId = id.replace(/-/g, "").slice(-8).toUpperCase();
      const botMessage = `📝 Tu ticket #TK-${shortId} tiene un nuevo comentario de **${autor}**:\n\n${texto}\n\nPuedes ver el detalle en la app.`;

      try {
        await db.insert(messages).values({
          user_id: incident.user_id,
          content: botMessage,
          is_bot: true,
        });
      } catch (err) {
        logger.warn("Comment notification insert failed", { error: (err as Error).message });
      }

      try {
        const userTokens = await db
          .select({ token: pushTokens.token })
          .from(pushTokens)
          .where(eq(pushTokens.user_id, incident.user_id));

        if (userTokens.length > 0) {
          const pushMessages = userTokens.map((t) => ({
            to: t.token,
            sound: "default" as const,
            title: "Nuevo comentario en tu ticket",
            body: `${autor} respondió en tu ticket #TK-${shortId}`,
            data: { incidentId: id },
          }));

          await sendExpoPush(pushMessages);
        }
      } catch (pushErr) {
        logger.error("Push notification error (comment)", { error: (pushErr as Error).message });
      }
    }

    res.status(201).json(comment);
  } catch (error) {
    logger.error("Add comment error", { error: (error as Error).message });
    res.status(500).json({ error: "Error al agregar comentario" });
  }
}

export async function exportIncidents(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const start = req.validatedQuery?.start as string | undefined;
    const end = req.validatedQuery?.end as string | undefined;
    const limit = Number(req.validatedQuery?.limit ?? 1000);
    const page = Number(req.validatedQuery?.page ?? 1);
    const offset = (page - 1) * limit;
    const conditions = [isNull(incidents.deleted_at)];

    if (start) {
      conditions.push(gte(incidents.created_at, colombiaDayStart(start)));
    }
    if (end) {
      conditions.push(lte(incidents.created_at, colombiaDayEnd(end)));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const allIncidents = await db
      .select()
      .from(incidents)
      .where(whereClause)
      .orderBy(desc(incidents.created_at))
      .limit(limit)
      .offset(offset);

    const incidentIds = allIncidents.map((inc) => inc.id);

    const allComments = incidentIds.length > 0
      ? await db
          .select()
          .from(incidentComments)
          .where(inArray(incidentComments.incident_id, incidentIds))
          .orderBy(desc(incidentComments.fecha))
      : [];

    const commentsByIncident = new Map<string, typeof allComments>();
    for (const comment of allComments) {
      const list = commentsByIncident.get(comment.incident_id) || [];
      list.push(comment);
      commentsByIncident.set(comment.incident_id, list);
    }

    const result = allIncidents.map((inc) => ({
      ...inc,
      comments: commentsByIncident.get(inc.id) || [],
    }));

    res.json({ items: result, total: result.length });
  } catch (error) {
    logger.error("Export incidents error", { error: (error as Error).message });
    res.status(500).json({ error: "Error al exportar incidentes" });
  }
}

export async function getAgentes(
  _req: Request,
  res: Response
): Promise<void> {
  try {
    const agentes = await db
      .selectDistinct({ agente: incidents.agente })
      .from(incidents)
      .where(and(isNotNull(incidents.agente), ne(incidents.agente, ""), isNull(incidents.deleted_at)));

    res.json(agentes.map((a) => a.agente).filter(Boolean));
  } catch (error) {
    logger.error("Get agentes error", { error: (error as Error).message });
    res.status(500).json({ error: "Error al listar agentes" });
  }
}

export async function getStats(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const q = req.validatedQuery!;
    const start = q.start as string | undefined;
    const end = q.end as string | undefined;
    const agente = q.agente as string | undefined;
    const conditions = [isNull(incidents.deleted_at)];

    if (agente) {
      conditions.push(eq(incidents.agente, agente));
    }

    if (start) {
      conditions.push(gte(incidents.created_at, colombiaDayStart(start)));
    }
    if (end) {
      conditions.push(lte(incidents.created_at, colombiaDayEnd(end)));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const dayExpr = sql`date_trunc('day', ${incidents.created_at})`;

    const timelineRows = await db
      .select({
        day: sql<string>`to_char(${dayExpr}, 'YYYY-MM-DD')`,
        total: sql<number>`count(*)::int`,
        resueltos: sql<number>`(count(*) filter (where ${incidents.estado} = 'resuelto'))::int`,
      })
      .from(incidents)
      .where(whereClause)
      .groupBy(dayExpr)
      .orderBy(dayExpr);

    const timeline = timelineRows.map(({ day, total, resueltos }) => ({
      date: day,
      fecha: new Date(day + "T00:00:00").toLocaleDateString("es-CO", {
        day: "2-digit",
        month: "short",
      }),
      incidentes: total,
      resueltos,
    }));

    const pvRows = await db
      .select({
        punto_venta: incidents.punto_venta,
        total: sql<number>`count(*)::int`,
      })
      .from(incidents)
      .where(whereClause)
      .groupBy(incidents.punto_venta);

    const pvCount = new Map<string, number>();
    for (const row of pvRows) {
      const pv = row.punto_venta || "Sin especificar";
      pvCount.set(pv, (pvCount.get(pv) || 0) + row.total);
    }

    const colors = ["#25207E", "#7C3AED", "#3B82F6", "#F59E0B", "#EF4444", "#22C55E", "#EC4899", "#14B8A6"];
    const sorted = Array.from(pvCount.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8);

    const statusRows = await db
      .select({
        estado: incidents.estado,
        total: sql<number>`count(*)::int`,
      })
      .from(incidents)
      .where(whereClause)
      .groupBy(incidents.estado);

    const total = statusRows.reduce((sum, row) => sum + row.total, 0);
    const distribution = total === 0
      ? [{ name: "Sin datos", value: 100, color: "#E5E7EB" }]
      : sorted.map(([name, count], i) => ({
          name,
          value: Math.round((count / total) * 100),
          color: colors[i % colors.length],
        }));

    const statusCounts = {
      pendientes: 0,
      enProceso: 0,
      resueltos: 0,
    };
    for (const row of statusRows) {
      if (row.estado === "pendiente") statusCounts.pendientes += row.total;
      else if (row.estado === "en_proceso") statusCounts.enProceso += row.total;
      else if (row.estado === "resuelto") statusCounts.resueltos += row.total;
    }

    res.json({ timeline, distribution, statusCounts });
  } catch (error) {
    logger.error("Get stats error", { error: (error as Error).message });
    res.status(500).json({ error: "Error al obtener estadísticas" });
  }
}

export async function unreadCount(
  _req: Request,
  res: Response
): Promise<void> {
  try {
    const [result] = await db
      .select({ count: sql<number>`count(*)`.mapWith(Number) })
      .from(incidents)
      .where(and(
        eq(incidents.visto_por_admin, false),
        eq(incidents.estado, "pendiente"),
        isNull(incidents.deleted_at)
      ));

    res.json({ count: result.count });
  } catch (error) {
    logger.error("Unread count error", { error: (error as Error).message });
    res.status(500).json({ error: "Error al obtener notificaciones" });
  }
}

export async function markSeen(
  _req: Request,
  res: Response
): Promise<void> {
  try {
    await db
      .update(incidents)
      .set({ visto_por_admin: true })
      .where(and(
        eq(incidents.visto_por_admin, false),
        eq(incidents.estado, "pendiente"),
        isNull(incidents.deleted_at)
      ));

    res.json({ message: "Marcados como vistos" });
  } catch (error) {
    logger.error("Mark seen error", { error: (error as Error).message });
    res.status(500).json({ error: "Error al marcar como vistos" });
  }
}

export async function deleteIncident(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const { id } = req.params as { id: string };

    const [deleted] = await db
      .update(incidents)
      .set({ deleted_at: new Date() })
      .where(and(eq(incidents.id, id), isNull(incidents.deleted_at)))
      .returning();

    if (!deleted) {
      res.status(404).json({ error: "Incidente no encontrado" });
      return;
    }

    res.json({ message: "Incidente eliminado", id: deleted.id });
  } catch (error) {
    logger.error("Delete incident error", { error: (error as Error).message });
    res.status(500).json({ error: "Error al eliminar el incidente" });
  }
}
