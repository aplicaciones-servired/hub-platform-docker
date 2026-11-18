import { Router } from "express";
import { listPuntosVenta, seedPuntosVenta, listPuntosReales } from "./puntos-venta.controller";
import { authMiddleware } from "../../middlewares/auth";
import { adminOnly } from "../../middlewares/admin";

const router = Router();

router.use(authMiddleware);
router.get("/", listPuntosVenta);
router.get("/reales", adminOnly, listPuntosReales);
router.post("/seed", adminOnly, seedPuntosVenta);

export default router;
