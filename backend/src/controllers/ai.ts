import type { Request, Response } from "express";

import type { AiRequest } from "@/types/ai-service.js";
import type { AssignmentRequest } from "@/types/assignments.js";

import AiService from "@/services/ai.js";

const AiController = {
  create: async (req: Request, res: Response) => {
    try {
      const demand: AiRequest = req.body;
      const assignment: AssignmentRequest = await AiService.create(demand);

      return res.status(200).json({
        message: "Assignment generated successfully",
        data: assignment,
      });
    } catch (error) {
      console.error("AI Controller Error:", error);

      return res.status(500).json({
        message: error instanceof Error ? error.message : "Failed to generate assignment",
      });
    }
  },
};

export default AiController;
