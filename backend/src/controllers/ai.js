import AiService from "@/services/ai.js";
const AiController = {
    create: async (req, res) => {
        try {
            const demand = req.body;
            const assignment = await AiService.create(demand);
            return res.status(200).json({
                message: "Assignment generated successfully",
                data: assignment,
            });
        }
        catch (error) {
            console.error("AI Controller Error:", error);
            return res.status(500).json({
                message: error instanceof Error ? error.message : "Failed to generate assignment",
            });
        }
    },
};
export default AiController;
//# sourceMappingURL=ai.js.map