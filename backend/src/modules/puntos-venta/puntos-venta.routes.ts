import { Router } from "express";
import { listPuntosVenta, seedPuntosVenta } from "./puntos-venta.controller";
import { authMiddleware } from "../../middlewares/auth";
import { adminOnly } from "../../middlewares/admin";

const router = Router();

router.use(authMiddleware);
router.get("/", listPuntosVenta);
router.post("/seed", adminOnly, seedPuntosVenta);

export default router;
