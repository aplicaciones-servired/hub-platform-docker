import { Router } from "express";
import rateLimit from "express-rate-limit";
import { register, login, me, refresh, logout, buscarSucursales } from "./auth.controller"; // <-- Aquí
import { validate } from "../../middlewares/validate";
import { loginSchema, registerSchema } from "./auth.schema";
import { authMiddleware } from "../../middlewares/auth";

const router = Router();

const authLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: { error: "Demasiados intentos. Intenta de nuevo en 1 minuto." },
  standardHeaders: true,
  legacyHeaders: false,
});

const refreshLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  message: { error: "Demasiadas solicitudes. Intenta de nuevo en 1 minuto." },
  standardHeaders: true,
  legacyHeaders: false,
});

router.post("/register", authLimiter, validate(registerSchema), register);
router.post("/login", authLimiter, validate(loginSchema), login);
router.get("/me", authMiddleware, me);
router.post("/refresh", refreshLimiter, refresh);
router.post("/logout", refreshLimiter, logout);

// Ruta para el autocompletado del login (pública)
router.get("/sucursales", buscarSucursales); 

export default router;