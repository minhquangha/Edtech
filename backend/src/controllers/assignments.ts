import { type Request, type Response } from "express";
import {
  type Assignment,
  type AssignmentRequest,
  type AssignmentUpdateRequest,
} from "@/types/assignments.js";
import AssignmentService from "@/services/assignments.js";
import {
  BadRequestError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
} from "@/utils/errors.js";

const AssignmentController = {
  create: async (req: Request, res: Response) => {
    const assignmentReq: AssignmentRequest = req.body;
    if (!req.user) {
      throw new UnauthorizedError("Authentication required");
    }
    const teacherId = req.user.id;
    const assignment: Assignment = await AssignmentService.create(
      assignmentReq,
      teacherId
    );

    return res.status(201).json({
      success: true,
      message: "Create assignment successfully",
      data: assignment,
    });
  },

  getById: async (req: Request, res: Response) => {
    const assignmentId = Number(req.params.id);

    if (Number.isNaN(assignmentId)) {
      throw new BadRequestError("Invalid assignment id");
    }

    const assignment = await AssignmentService.getById(assignmentId);

    if (!assignment) {
      throw new NotFoundError("Assignment not found");
    }

    // IDOR Protection: If requester is not the teacher who created it, only allow viewing if PUBLISHED
    if (
      req.user &&
      req.user.id !== assignment.teacher_id &&
      req.user.role !== "ADMIN" &&
      assignment.status === "DRAFT"
    ) {
      throw new ForbiddenError(
        "You do not have permission to view this draft assignment"
      );
    }

    return res.status(200).json({
      success: true,
      message: "Get assignment successfully",
      data: assignment,
    });
  },

  getByUserId: async (req: Request, res: Response) => {
    if (!req.user) {
      throw new UnauthorizedError("Authentication required");
    }
    const userId = req.user.id;
    const assignments = await AssignmentService.getByTeacherId(userId);
    return res.status(200).json({
      success: true,
      message: "Get assignments successfully",
      data: assignments,
    });
  },

  update: async (req: Request, res: Response) => {
    const assignmentId = Number(req.params.id);
    if (Number.isNaN(assignmentId)) {
      throw new BadRequestError("Invalid assignment ID");
    }
    if (!req.user) {
      throw new UnauthorizedError("Authentication required");
    }
    const teacherId = req.user.id;
    const assignment: AssignmentUpdateRequest = req.body;

    await AssignmentService.updateAssignment(
      assignmentId,
      teacherId,
      assignment
    );

    return res.status(200).json({
      success: true,
      message: "Assignment updated successfully",
    });
  },

  deleteById: async (req: Request, res: Response) => {
    const assignmentId = Number(req.params.id);
    if (!req.user) {
      throw new UnauthorizedError("Authentication required");
    }
    const teacherId = req.user.id;

    if (Number.isNaN(assignmentId)) {
      throw new BadRequestError("Invalid assignment id");
    }

    await AssignmentService.deleteById(assignmentId, teacherId);

    return res.status(200).json({
      success: true,
      message: "Assignment deleted successfully",
    });
  },

  getGrades: async (_req: Request, res: Response) => {
    const grades = await AssignmentService.getGrades();

    return res.status(200).json({
      success: true,
      message: "Get grades successfully",
      data: grades,
    });
  },

  getLessons: async (req: Request, res: Response) => {
    const gradeId = Number(req.query.gradeId);
    const subjectId = Number(req.query.subjectId);

    if (
      !gradeId ||
      Number.isNaN(gradeId) ||
      !subjectId ||
      Number.isNaN(subjectId)
    ) {
      throw new BadRequestError("gradeId and subjectId are required");
    }

    const lessons = await AssignmentService.getLessons(gradeId, subjectId);

    return res.status(200).json({
      success: true,
      message: "Get lessons successfully",
      data: lessons,
    });
  },

  getSubjects: async (req: Request, res: Response) => {
    const gradeId = Number(req.query.gradeId);

    if (!gradeId || Number.isNaN(gradeId)) {
      throw new BadRequestError("gradeId is required");
    }

    const subjects = await AssignmentService.getSubject(gradeId);

    return res.status(200).json({
      success: true,
      message: "Get subjects successfully",
      data: subjects,
    });
  },
};

export default AssignmentController;
