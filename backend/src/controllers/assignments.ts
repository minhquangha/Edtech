import { type Request, type Response } from "express";
import {
  type Assignment,
  type AssignmentRequest,
} from "@/types/assignments.js";
import AssignmentService from "@/services/assignments.js";

const AssignmentController = {
  create: async (req: Request, res: Response) => {
    console.log(3);
    try {
      // Dữ liệu frontend gửi lên
      const assignmentReq: AssignmentRequest = req.body;
      console.log(5);
      // // Lấy teacher_id từ user đăng nhập
      // if (req.user === undefined) {
      //   console.log("❌ req.user is undefined");

      //   return res.status(404).json({
      //     message: "User not authenticated",
      //   });
      // }
      const teacherId = 3;
      console.log(6);
      // Gửi dữ liệu xuống service để tạo Assignment
      const assignment: Assignment = await AssignmentService.create(
        assignmentReq,
        teacherId,
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
  getById: async (req: Request, res: Response) => {
  try {
    const assignmentId = Number(req.params.id);

    if (Number.isNaN(assignmentId)) {
      return res.status(400).json({
        message: "Invalid assignment id",
      });
    }

    const assignment = await AssignmentService.getById(assignmentId);

    if (!assignment) {
      return res.status(404).json({
        message: "Assignment not found",
      });
    }

    return res.status(200).json({
      message: "Get assignment successfully",
      data: assignment,
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      message: "Internal server error",
    });
  }
},
  getByUserId: async(req:Request,res:Response)=>{
    // const userId  =  req.user?.id;
    try {
      const userId =  3;
      const assignment =  await AssignmentService.getByTeacherId(userId);
      return res.status(200).json({
        message: "Get assignments successfully",
        data: assignment,
      });
    } catch (error) {
      console.error(error);

      return res.status(500).json({
        message: "Internal server error",
      });
      
    }
  }
};

export default AssignmentController;
