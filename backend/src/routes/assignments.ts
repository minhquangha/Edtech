import { Router } from "express";
import AssignmentController from "@/controllers/assignments.js";
import {
  validateBody,
  validateQuery,
  validateParams,
} from "@/middlewares/validate.js";
import { requireTeacher } from "@/middlewares/authorize.js";
import {
  createAssignmentSchema,
  updateAssignmentSchema,
  queryLessonsSchema,
  querySubjectsSchema,
  idParamSchema,
} from "@/schemas/index.js";

const router: Router = Router();

// Metadata & Curriculum catalogs
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

// Create Assignment (Requires Teacher role)
router.post(
  "/create",
  requireTeacher,
  validateBody(createAssignmentSchema),
  AssignmentController.create
);
router.post(
  "/",
  requireTeacher,
  validateBody(createAssignmentSchema),
  AssignmentController.create
);

// Update Assignment (Requires Teacher role)
router.put(
  "/edit/:id",
  requireTeacher,
  validateParams(idParamSchema),
  validateBody(updateAssignmentSchema),
  AssignmentController.update
);
router.put(
  "/:id",
  requireTeacher,
  validateParams(idParamSchema),
  validateBody(updateAssignmentSchema),
  AssignmentController.update
);

// Delete Assignment (Requires Teacher role)
router.delete(
  "/delete/:id",
  requireTeacher,
  validateParams(idParamSchema),
  AssignmentController.deleteById
);
router.delete(
  "/:id",
  requireTeacher,
  validateParams(idParamSchema),
  AssignmentController.deleteById
);

// Read Assignments
router.get(
  "/:id",
  validateParams(idParamSchema),
  AssignmentController.getById
);
router.get("/", AssignmentController.getByUserId);

export default router;
