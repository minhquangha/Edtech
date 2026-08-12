import { Router } from "express";
import AiController from "@/controllers/ai.js";
const router: Router = Router();
router.post("/create",AiController.create);
export default router;
