import { Router } from "express";
import AiController from "@/controllers/ai.js";
import authenticate from "@/middlewares/authenticator.js";
import { requireTeacher } from "@/middlewares/authorize.js";
import { validateBody } from "@/middlewares/validate.js";
import { aiCreateSchema } from "@/schemas/index.js";

const router: Router = Router();

router.post(
  "/create",
  authenticate,
  requireTeacher,
  validateBody(aiCreateSchema),
  AiController.create
);

export default router;
