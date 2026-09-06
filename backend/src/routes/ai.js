import { Router } from "express";
import AiController from "@/controllers/ai.js";
const router = Router();
router.post("/create", AiController.create);
export default router;
//# sourceMappingURL=ai.js.map