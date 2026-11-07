import { Request, Response, NextFunction } from "express";

export function isAdminRole(rol: string | undefined): boolean {
  return rol === "admin" || rol === "tecnico";
}

export function adminOnly(req: Request, res: Response, next: NextFunction): void {
  if (!req.user || !isAdminRole(req.user.rol)) {
    res.status(403).json({ error: "Acceso denegado. Se requiere rol admin o técnico." });
    return;
  }

  next();
}
