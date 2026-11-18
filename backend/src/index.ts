import dotenv from "dotenv";
dotenv.config();

import cors from "cors";
import express, { type Request } from "express";
import helmet from "helmet";
import morgan from "morgan";
import cookieParser from "cookie-parser";
import rateLimit from "express-rate-limit";
import { ZodError } from "zod";
import { csrfProtection } from "./middlewares/csrf";
import { requestId } from "./middlewares/requestId";
import { metricsMiddleware, getMetrics, getMetricsContentType } from "./middlewares/metrics";
import { authMiddleware } from "./middlewares/auth";
import { adminOnly } from "./middlewares/admin";
import { logger } from "./lib/logger";
import { env } from "./config/env";

import authRoutes from "./modules/auth/auth.routes";
import incidentsRoutes from "./modules/incidents/incidents.routes";
import chatRoutes from "./modules/chat/chat.routes";
import dashboardRoutes from "./modules/dashboard/dashboard.routes";
import usersRoutes from "./modules/users/users.routes";
import uploadRoutes from "./modules/upload/upload.routes";
import pushRoutes from "./modules/push/push.routes";
import puntosVentaRoutes from "./modules/puntos-venta/puntos-venta.routes";
import settingsRoutes from "./modules/settings/settings.routes";
import externalSystemsRoutes from "./modules/external-systems/external-systems.routes";

const app = express();

app.set("trust proxy", 1);

app.use((req, res, next) => {
  if (env.NODE_ENV === "production" && req.headers["x-forwarded-proto"] !== "https") {
    const host = (req.headers.host || "").toLowerCase();
    const hostname = host.replace(/:\d+$/, "").replace(/^\[|\]$/g, "");
    if (env.ALLOWED_HOSTS.length > 0 && !env.ALLOWED_HOSTS.includes(hostname)) {
      logger.warn("Host no permitido en redirect HTTPS", { host });
      return res.status(400).json({ error: "Host header no permitido" });
    }
    if (hostname) return res.redirect(301, `https://${host}${req.originalUrl}`);
  }
  next();
});

app.use(requestId);
app.use(metricsMiddleware);

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'"],
        imgSrc: ["'self'", "data:"],
        fontSrc: ["'self'"],
        connectSrc: env.NODE_ENV === "development" ? ["'self'", "ws:", "http://localhost:*"] : ["'self'"],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
        frameAncestors: ["'none'"],
        upgradeInsecureRequests: env.NODE_ENV === "production" ? [] : null,
      },
    },
    hsts: { maxAge: 31536000, includeSubDomains: true },
  })
);
app.use(
  cors({
    origin:
      env.NODE_ENV === "development"
        ? [
            "http://localhost:3000",
            "http://localhost:8081",
            "http://localhost:19006",
            /^https?:\/\/localhost(:\d+)?$/,
            /^https?:\/\/192\.168\.\d+\.\d+(:\d+)?$/,
            /^https?:\/\/172\.(1[6-9]|2\d|3[01])\.\d+\.\d+(:\d+)?$/,
            /^https?:\/\/10\.\d+\.\d+\.\d+(:\d+)?$/,
          ]
        : env.CORS_ORIGIN?.split(",") ??
          (() => {
            throw new Error("CORS_ORIGIN es requerida en producción. Define la variable de entorno.");
          })(),
    credentials: true,
  })
);
morgan.token("request-id", (req) => (req as Request).requestId);
morgan.token("pathonly", (req) => (req as Request).path);
app.use(
  morgan(
    env.NODE_ENV === "production"
      ? ":remote-addr :method :pathonly :status :response-time ms [:request-id]"
      : ":method :pathonly :status :response-time ms [:request-id]"
  )
);
app.use(express.json({ limit: "1mb" }));
app.use(cookieParser());
app.use(csrfProtection);

// Límite de llamadas por IP. En una oficina varias personas comparten la misma IP
// y el panel hace muchas llamadas (Analítica, notificaciones cada 30 s), así que
// 100 por minuto se llenaba rápido. El inicio de sesión tiene su propia protección
// (bloqueo de la cuenta tras varios intentos fallidos).
const globalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 1000,
  standardHeaders: true,
  legacyHeaders: false,
  // La revisión de conexión de la app y de Docker no cuenta para el límite
  skip: (req) => req.path === "/api/health",
  message: { error: "Demasiadas solicitudes. Intenta de nuevo en 1 minuto." },
});

app.use(globalLimiter);

// Health check simple (sin DB)
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Health check completo (con DB)
app.get("/api/health/db", authMiddleware, adminOnly, async (_req, res) => {
  try {
    const { db } = await import("./db");
    await db.execute("SELECT 1");
    res.json({ status: "ok", db: "connected", timestamp: new Date().toISOString() });
  } catch {
    res.status(503).json({ status: "error", db: "disconnected" });
  }
});

// Metrics (Prometheus format)
app.get("/api/metrics", authMiddleware, adminOnly, async (_req, res) => {
  try {
    res.set("Content-Type", getMetricsContentType());
    res.end(await getMetrics());
  } catch (error) {
    logger.error("Metrics error", { error: (error as Error).message });
    res.status(500).json({ error: "Error al obtener métricas" });
  }
});

// Serve uploads (protected)
app.use("/uploads", authMiddleware, express.static("uploads"));

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/incidents", incidentsRoutes);
app.use("/api/chat", chatRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/users", usersRoutes);
app.use("/api/upload", uploadRoutes);
app.use("/api/push", pushRoutes);
app.use("/api/puntos-venta", puntosVentaRoutes);
app.use("/api/settings", settingsRoutes);
app.use("/api/external-systems", externalSystemsRoutes);

// 404
app.use((_req, res) => {
  res.status(404).json({ error: "Ruta no encontrada" });
});

app.use(
  (
    err: Error,
    req: express.Request,
    res: express.Response,
    _next: express.NextFunction
  ) => {
    // Zod validation errors
    if (err instanceof ZodError || err.name === "ZodError") {
      logger.warn(`Validation error: ${err.message}`, { requestId: req.requestId });
      res.status(400).json({ error: "Datos inválidos", requestId: req.requestId });
      return;
    }

    // Auth errors
    if (err.message.includes("Unauthorized") || err.message.includes("invalid token")) {
      logger.warn(`Auth error: ${err.message}`, { requestId: req.requestId });
      res.status(401).json({ error: "No autorizado", requestId: req.requestId });
      return;
    }

    // JWT errors específicos
    if (err.name === "JsonWebTokenError" || err.name === "TokenExpiredError") {
      logger.warn(`JWT error: ${err.message}`, { requestId: req.requestId });
      res.status(401).json({ error: "Token inválido o expirado", requestId: req.requestId });
      return;
    }

    // Multer file upload errors
    if (err.name === "MulterError") {
      logger.warn(`Upload error: ${err.message}`, { requestId: req.requestId });
      res.status(400).json({ error: "Error al subir el archivo (tipo o tamaño no permitido)", requestId: req.requestId });
      return;
    }

    // Database errors
    const pgCode = (err as Error & { code?: string }).code;
    if (pgCode === "23505" || err.message.includes("unique constraint") || err.message.includes("duplicate key")) {
      logger.warn(`Database constraint error: ${err.message}`, { requestId: req.requestId });
      res.status(409).json({ error: "El registro ya existe", requestId: req.requestId });
      return;
    }

    logger.error(`Unhandled error: ${err.message}`, {
      requestId: req.requestId,
      stack: err.stack,
    });
    res.status(500).json({ error: "Error interno del servidor", requestId: req.requestId });
  }
);

app.listen(env.PORT, () => {
  if (process.env.NODE_ENV === undefined) {
    logger.warn("NODE_ENV no está definida: se asume 'development' (CORS amplio, sin redirect HTTPS ni CSP estricta). Defínela en producción.");
  }
  logger.info(`API running on port ${env.PORT}`, { environment: env.NODE_ENV });
});

export default app;
