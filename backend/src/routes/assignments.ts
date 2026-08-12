import { Router } from "express";
import AssignmentController from "@/controllers/assignments.js";
const router: Router = Router();
router.post("/create", AssignmentController.create);
router.get("/:id", AssignmentController.getById);
router.get("/", AssignmentController.getByUserId);
console.log(2);
export default router;
