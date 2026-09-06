import type { AiRequest } from "@/types/ai-service.js";
import type { AssignmentRequest } from "@/types/assignments.js";
declare const AiService: {
    create: (demand: AiRequest) => Promise<AssignmentRequest>;
};
export default AiService;
//# sourceMappingURL=ai.d.ts.map