import { Router } from "express";
import AssignmentController from "@/controllers/assignments.js";
import {
  validateBody,
  validateQuery,
  validateParams,
} from "@/middlewares/validate.js";
import {
  createAssignmentSchema,
  updateAssignmentSchema,
  queryLessonsSchema,
  querySubjectsSchema,
  idParamSchema,
} from "@/schemas/index.js";

const router: Router = Router();

router.post(
  "/create",
  validateBody(createAssignmentSchema),
  AssignmentController.create
);
router.get("/grades", AssignmentController.getGrades);
router.get(
  "/subjects",
  validateQuery(querySubjectsSchema),
  AssignmentController.getSubjects
);
router.get(
  "/lessons",
  validateQuery(queryLessonsSchema),
  AssignmentController.getLessons
);
router.put(
  "/edit/:id",
  validateParams(idParamSchema),
  validateBody(updateAssignmentSchema),
  AssignmentController.update
);
router.delete(
  "/delete/:id",
  validateParams(idParamSchema),
  AssignmentController.deleteById
);
router.get(
  "/:id",
  validateParams(idParamSchema),
  AssignmentController.getById
);
router.get("/", AssignmentController.getByUserId);

export default router;
