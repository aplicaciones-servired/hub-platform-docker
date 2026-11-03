import { Request, Response } from "express";
import { eq, desc, and, sql, isNull } from "drizzle-orm";
import { db } from "../../db";
import { messages, incidents } from "../../db/schema";
import { logger } from "../../lib/logger";

const ESTADO_LABELS: Record<string, string> = {
  pendiente: "Pendiente",
  en_proceso: "En Proceso",
  resuelto: "Resuelto",
};

interface SuggestedAction {
  label: string;
  action: string;
}

interface ChatResponse {
  text: string;
  actions: SuggestedAction[];
  autoAction?: string;
  /** ID del incidente cuando la respuesta es sobre un ticket concreto */
  ticketId?: string;
}

const PROBLEM_OPTIONS: SuggestedAction[] = [
  { label: "Problema con el sistema", action: "problema_sistema" },
  { label: "Problema de hardware", action: "problema_hardware" },
  { label: "Problema con punto de venta", action: "problema_pv" },
  { label: "Problema de acceso", action: "problema_acceso" },
  { label: "Preguntas frecuentes", action: "faq" },
  { label: "Reportar otro incidente", action: "reportar" },
];

const HELP_KEYWORDS = ["hola", "ayuda", "necesito", "problema", "tengo un", "quisiera", "puedes", "buenos dias", "buenas tardes", "buenas noches", "ayudame", "como", "que hago"];

const PROBLEM_RESPONSES: Record<string, ChatResponse> = {
  problema_sistema: {
    text: "Entiendo que tienes un problema con el sistema. Voy a redirigirte al formulario de reporte para que describas el error y el modulo donde ocurre.",
    actions: [],
    autoAction: "reportar",
  },
  problema_hardware: {
    text: "Detecte que tienes un problema de hardware. Te llevo al formulario para que reportes el equipo afectado y la descripcion de la falla.",
    actions: [],
    autoAction: "reportar",
  },
  problema_pv: {
    text: "Veo que hay un problema con tu punto de venta. Te redirijo al formulario de reporte para que detalles la situacion.",
    actions: [],
    autoAction: "reportar",
  },
  problema_acceso: {
    text: "Entiendo que tienes problemas para acceder. Te llevo al formulario para que reportes el problema de acceso y un agente te ayude a restablecerlo.",
    actions: [],
    autoAction: "reportar",
  },
  consultar_estado: {
        text: "Te llevo a 'Mis reportes', donde puedes ver el estado de todos tus reportes.",
    actions: [],
    autoAction: "ir_historial",
  },
  faq: {
    text: "Abro las preguntas frecuentes para ti.",
    actions: [],
    autoAction: "ver_faq",
  },
  reportar: {
    text: "Te redirijo al formulario de reporte.",
    actions: [],
    autoAction: "reportar",
  },
  menu_principal: {
    text: "Claro, puedo ayudarte con lo siguiente:",
    actions: [...PROBLEM_OPTIONS],
  },
};

const INTENT_PATTERNS: Record<string, string[]> = {
  problema_sistema: [
    "sistema no funciona",
    "sistema no responde",
    "sistema caido",
    "sistema lento",
    "error en el sistema",
    "falla del sistema",
    "no puedo usar el sistema",
    "sistema no carga",
    "sistema se congela",
    "sistema se cuelga",
    "aplicacion no funciona",
    "app no funciona",
    "software no funciona",
    "plataforma no funciona",
    "pagina no carga",
    "web no funciona",
    "no puedo ingresar al sistema",
    "sistema no me deja",
  ],
  problema_hardware: [
    "impresora no funciona",
    "impresora no imprime",
    "impresora atascada",
    "impresora no enciende",
    "impresora no conecta",
    "lector no funciona",
    "lector no lee",
    "lector no reconoce",
    "pantalla no funciona",
    "pantalla negra",
    "pantalla azul",
    "computadora no enciende",
    "pc no enciende",
    "teclado no funciona",
    "mouse no funciona",
    "cable no funciona",
    "hardware no funciona",
    "equipo no funciona",
    "equipo no enciende",
    "no funciona el equipo",
    "maquina no funciona",
    "dispositivo no funciona",
  ],
  problema_pv: [
    "punto de venta no funciona",
    "punto de venta no abre",
    "punto de venta no conecta",
    "pdv no funciona",
    "pdv no abre",
    "pdv no conecta",
    "caja no funciona",
    "caja no abre",
    "terminal no funciona",
    "terminal no conecta",
    "no puedo vender",
    "no puedo cobrar",
    "no puedo hacer venta",
    "problema con punto de venta",
    "problema con pdv",
    "problema con la caja",
    "problema con la terminal",
  ],
  problema_acceso: [
    "no puedo entrar",
    "no puedo iniciar sesion",
    "no puedo loguearme",
    "no puedo acceder",
    "olvide mi contrasena",
    "olvide mi password",
    "olvide mi usuario",
    "olvide mi documento",
    "contrasena incorrecta",
    "password incorrecta",
    "usuario incorrecto",
    "no me deja entrar",
    "no me deja iniciar sesion",
    "me bloquearon",
    "cuenta bloqueada",
    "usuario bloqueado",
    "no tengo acceso",
    "perdi mi acceso",
    "no puedo ingresar",
    "credenciales incorrectas",
  ],
  consultar_estado: [
    "estado de mi reporte",
    "estado de mi ticket",
    "estado de mi incidente",
    "como va mi reporte",
    "como va mi ticket",
    "como va mi incidente",
    "quiero ver mis reportes",
    "quiero ver mis tickets",
    "quiero ver mis incidentes",
    "mis reportes",
    "mis tickets",
    "mis incidentes",
    "historial de reportes",
    "historial de tickets",
    "historial de incidentes",
    "ver historial",
    "consultar reporte",
    "consultar ticket",
    "consultar incidente",
    "seguimiento de reporte",
    "seguimiento de ticket",
    "seguimiento de incidente",
  ],
  faq: [
    "preguntas frecuentes",
    "faq",
    "dudas frecuentes",
    "preguntas mas comunes",
    "ayuda rapida",
    "guia de uso",
    "como usar",
    "como funciona",
    "instrucciones",
    "manual",
    "tutorial",
  ],
  reportar: [
    "quiero reportar",
    "necesito reportar",
    "reportar problema",
    "reportar incidente",
    "reportar falla",
    "reportar error",
    "crear reporte",
    "crear ticket",
    "crear incidente",
    "nuevo reporte",
    "nuevo ticket",
    "nuevo incidente",
    "hacer reporte",
    "hacer ticket",
    "hacer incidente",
    "reportar otro",
    "otro reporte",
    "otro ticket",
    "otro incidente",
  ],
};

function detectIntent(text: string): ChatResponse | null {
  const lower = text.toLowerCase().trim();

  if (PROBLEM_RESPONSES[lower]) {
    return PROBLEM_RESPONSES[lower];
  }

  const labelMatch = PROBLEM_OPTIONS.find(
    (opt) => opt.label.toLowerCase().startsWith(lower) || lower.includes(opt.action)
  );
  if (labelMatch && PROBLEM_RESPONSES[labelMatch.action]) {
    return PROBLEM_RESPONSES[labelMatch.action];
  }

  for (const [intent, patterns] of Object.entries(INTENT_PATTERNS)) {
    for (const pattern of patterns) {
      if (lower.includes(pattern)) {
        return PROBLEM_RESPONSES[intent];
      }
    }
  }

  const REPORT_KEYWORDS = ["reportar", "reporte", "incidente", "quiero reportar"];
  if (REPORT_KEYWORDS.some((kw) => lower.includes(kw))) {
    return PROBLEM_RESPONSES.reportar;
  }

  const HISTORY_KEYWORDS = ["historial", "mis reportes", "mis tickets", "estado de"];
  if (HISTORY_KEYWORDS.some((kw) => lower.includes(kw))) {
    return PROBLEM_RESPONSES.consultar_estado;
  }

  const isHelpRequest = HELP_KEYWORDS.some((kw) => lower.includes(kw));
  if (isHelpRequest) {
    return {
      text: "Bienvenido al asistente de soporte. ¿En que puedo ayudarte?",
      actions: [...PROBLEM_OPTIONS],
    };
  }

  return null;
}

function getDefaultResponse(): ChatResponse {
  return {
    text: "No entendi tu mensaje. Un agente revisara tu consulta y te respondera pronto. Mientras tanto, puedes seleccionar una opcion:",
    actions: [
      { label: "Volver al menu principal", action: "menu_principal" },
      { label: "Reportar incidente", action: "reportar" },
    ],
  };
}

function matchTicketCode(text: string): string | null {
  const prefixed = text.match(/(?:#\s*TK[-:]?\s*|TK-)\s*([A-Fa-f0-9]{8})\b/);
  if (prefixed) return prefixed[1];

  const trimmed = text.trim();
  if (/^[A-Fa-f0-9]{8}$/.test(trimmed)) return trimmed;

  return null;
}

async function lookupTicket(
  userId: string,
  text: string
): Promise<ChatResponse | null> {
  const code = matchTicketCode(text);
  if (!code) return null;

  const shortId = code.toUpperCase();

  if (!/^[A-F0-9]{8}$/.test(shortId)) return null;

  const [incident] = await db
    .select({
      id: incidents.id,
      descripcion: incidents.descripcion,
      estado: incidents.estado,
      created_at: incidents.created_at,
    })
    .from(incidents)
    .where(
      and(
        eq(incidents.user_id, userId),
        isNull(incidents.deleted_at),
        sql`UPPER(RIGHT(REPLACE(${incidents.id}::text, '-', ''), 8)) = ${shortId}`
      )
    )
    .limit(1);

  if (!incident) return null;

  const estado = ESTADO_LABELS[incident.estado] || incident.estado;
  const fecha = new Date(incident.created_at).toLocaleDateString("es-CO", {
    day: "numeric",
    month: "long",
  });

  return {
    text:
      `Ticket #TK-${shortId}\n\n` +
      `${incident.descripcion.slice(0, 80)}${incident.descripcion.length > 80 ? "..." : ""}\n` +
      `Creado el ${fecha}\n` +
      `Estado: ${estado}`,
    actions: [
      { label: "Volver al menu principal", action: "menu_principal" },
    ],
    ticketId: incident.id,
  };
}

export async function sendMessage(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const { content } = req.body;

    if (typeof content !== "string" || content.trim().length === 0) {
      res.status(400).json({ error: "El mensaje no puede estar vacío" });
      return;
    }
    if (content.length > 10000) {
      res.status(400).json({ error: "El mensaje no puede superar los 10000 caracteres" });
      return;
    }

    const [userMsg] = await db
      .insert(messages)
      .values({
        user_id: req.user!.userId,
        content,
        is_bot: false,
      })
      .returning();

    const intentInfo = detectIntent(content);
    const ticketInfo = matchTicketCode(content)
      ? await lookupTicket(req.user!.userId, content)
      : null;
    const response = ticketInfo || intentInfo || getDefaultResponse();

    const [botMsg] = await db
      .insert(messages)
      .values({
        user_id: req.user!.userId,
        content: response.text,
        is_bot: true,
        metadata: response.ticketId ? { ticketId: response.ticketId } : null,
      })
      .returning();

    res.json({
      userMessage: userMsg,
      botMessage: botMsg,
      suggestedActions: response.actions,
      autoAction: response.autoAction,
      ticketId: response.ticketId ?? null,
    });
  } catch (error) {
    logger.error("Send message error", { error: (error as Error).message });
    res.status(500).json({ error: "Error al enviar mensaje" });
  }
}

export async function getHistory(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const rawLimit = (req.validatedQuery?.limit as number) || 50;
    const limit = Math.min(Math.max(1, rawLimit), 200);

    const rawPage = (req.validatedQuery?.page as number) || 1;
    const page = Math.max(1, rawPage);
    const offset = (page - 1) * limit;

    const history = await db
      .select()
      .from(messages)
      .where(eq(messages.user_id, req.user!.userId))
      .orderBy(desc(messages.created_at))
      .limit(limit)
      .offset(offset);

    const [countResult] = await db
      .select({ total: sql<number>`count(*)`.mapWith(Number) })
      .from(messages)
      .where(eq(messages.user_id, req.user!.userId));

    res.json({
      items: history.reverse(),
      total: countResult.total,
      page,
      limit,
      totalPages: Math.ceil(countResult.total / limit),
    });
  } catch (error) {
    logger.error("Get history error", { error: (error as Error).message });
    res.status(500).json({ error: "Error al obtener historial" });
  }
}
