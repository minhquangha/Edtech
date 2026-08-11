import { type Request,type Response } from "express" 
import { type Assignment, type AssignmentRequest } from "@/types/assignment.js";
import AssignmentService from "@/services/assignments.js";

const AssignmentController = {
  create: async (req: Request, res: Response) => {
    try {
      // Dữ liệu frontend gửi lên
      const assignmentReq: AssignmentRequest = req.body;

      // Lấy teacher_id từ user đăng nhập
      const teacherId = req.user.id;

      // Gửi dữ liệu xuống service để tạo Assignment
      const assignment: Assignment =
        await AssignmentService.create(
          assignmentReq,
          teacherId
        );

      return res.status(201).json({
        message: "Create assignment successfully",
        data: assignment,
      });

    } catch (error) {
      console.error(error);

      return res.status(500).json({
        message: "Internal server error",
      });
    }
  },
};

export default AssignmentController;