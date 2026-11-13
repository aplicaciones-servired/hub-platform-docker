import { Router } from "express";
import rateLimit from "express-rate-limit";
import {
  createIncident,
  listIncidents,
  getIncident,
  updateIncident,
  addComment,
  updateComment,
  getStats,
  getAgentes,
  getTechnicians,
  deleteIncident,
  exportIncidents,
  unreadCount,
  markSeen,
} from "./incidents.controller";
import { validate } from "../../middlewares/validate";
import {
  createIncidentSchema,
  updateIncidentSchema,
  commentSchema,
  listIncidentsQuerySchema,
  statsQuerySchema,
  exportQuerySchema,
  uuidParamsSchema,
} from "./incidents.schema";
import { authMiddleware } from "../../middlewares/auth";
import { adminOnly } from "../../middlewares/admin";
import { z } from "zod";

const router = Router();

const incidentsLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  message: { error: "Demasiadas solicitudes. Intenta de nuevo en 1 minuto." },
  standardHeaders: true,
  legacyHeaders: false,
});

router.use(authMiddleware);
router.use(incidentsLimiter);

router.post("/", validate(createIncidentSchema), createIncident);
router.get("/technicians", adminOnly, getTechnicians);
router.get("/agentes", adminOnly, getAgentes);
router.get("/stats", adminOnly, validate(statsQuerySchema), getStats);
router.get("/export-data", adminOnly, validate(exportQuerySchema), exportIncidents);
router.get("/unread-count", adminOnly, unreadCount);
router.patch("/mark-seen", adminOnly, markSeen);
router.get("/", validate(listIncidentsQuerySchema), listIncidents);
router.get("/:id", validate({ params: uuidParamsSchema }), getIncident);
router.patch("/:id", adminOnly, validate({ body: updateIncidentSchema, params: uuidParamsSchema }), updateIncident);
router.delete("/:id", adminOnly, validate({ params: uuidParamsSchema }), deleteIncident);
router.post("/:id/comments", validate({ body: commentSchema, params: uuidParamsSchema }), addComment);
router.patch(
  "/:id/comments/:commentId",
  validate({ body: commentSchema, params: z.object({ id: z.string().uuid(), commentId: z.string().uuid() }) }),
  updateComment
);

export default router;