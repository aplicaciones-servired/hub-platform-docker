import { Router } from "express";
import { createUser, listUsers, updateUser, toggleUserStatus, resetPassword, deleteUser } from "./users.controller";
import { authMiddleware } from "../../middlewares/auth";
import { adminOnly, superAdminOnly } from "../../middlewares/admin";
import { validate } from "../../middlewares/validate";
import { createUserSchema, updateUserSchema, uuidParamsSchema, listUsersQuerySchema, resetPasswordSchema } from "./users.schema";

const router = Router();

router.post("/", authMiddleware, superAdminOnly, validate(createUserSchema), createUser);
router.get("/", authMiddleware, adminOnly, validate(listUsersQuerySchema), listUsers);
router.patch("/:id", authMiddleware, adminOnly, validate({ body: updateUserSchema.body, params: uuidParamsSchema }), updateUser);
router.patch("/:id/toggle-status", authMiddleware, adminOnly, validate({ params: uuidParamsSchema }), toggleUserStatus);
router.patch("/:id/reset-password", authMiddleware, superAdminOnly, validate({ body: resetPasswordSchema, params: uuidParamsSchema }), resetPassword);
router.delete("/:id", authMiddleware, superAdminOnly, validate({ params: uuidParamsSchema }), deleteUser);

export default router;
