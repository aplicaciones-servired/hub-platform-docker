import { Router } from "express";
import multer from "multer";
import { uploadFile, subirImagenIncidente, obtenerImagenIncidente } from "./upload.controller";
import { authMiddleware } from "../../middlewares/auth";
import { adminOnly } from "../../middlewares/admin";

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
});

router.post("/", authMiddleware, adminOnly, upload.single("file"), uploadFile);

// Fotos de incidentes: cualquier usuario con sesión iniciada puede subirlas (máx. 5 MB cada una)
router.post("/incidente", authMiddleware, upload.single("file"), subirImagenIncidente);
router.get("/incidente/:key(*)", authMiddleware, obtenerImagenIncidente);
export default router;
