import { Router } from "express";
import UserController from "@/controllers/users.js";
import { validateBody } from "@/middlewares/validate.js";
import { authSchema } from "@/schemas/index.js";

const router: Router = Router();

router.post("/me/login", validateBody(authSchema), UserController.login);
router.post("/me/register", validateBody(authSchema), UserController.register);

export default router;
