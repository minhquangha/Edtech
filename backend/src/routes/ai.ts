import { Router } from "express";
import AiController from "@/controllers/ai.js";
import { validateBody } from "@/middlewares/validate.js";
import { aiCreateSchema } from "@/schemas/index.js";

const router: Router = Router();
router.post("/create", validateBody(aiCreateSchema), AiController.create);
export default router;
