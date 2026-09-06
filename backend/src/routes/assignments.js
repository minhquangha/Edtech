import { Router } from "express";
import AssignmentController from "@/controllers/assignments.js";
const router = Router();
router.post("/create", AssignmentController.create);
router.get("/grades", AssignmentController.getGrades);
router.get("/subjects", AssignmentController.getSubjects);
router.get("/lessons", AssignmentController.getLessons);
router.put("/edit/:id", AssignmentController.update);
router.delete("/delete/:id", AssignmentController.deleteById);
router.get("/:id", AssignmentController.getById);
router.get("/", AssignmentController.getByUserId);
export default router;
//# sourceMappingURL=assignments.js.map