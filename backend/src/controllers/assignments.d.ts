import { type Request, type Response } from "express";
declare const AssignmentController: {
    create: (req: Request, res: Response) => Promise<Response<any, Record<string, any>>>;
    getById: (req: Request, res: Response) => Promise<Response<any, Record<string, any>>>;
    getByUserId: (req: Request, res: Response) => Promise<Response<any, Record<string, any>>>;
    update: (req: Request, res: Response) => Promise<Response<any, Record<string, any>>>;
    deleteById: (req: Request, res: Response) => Promise<Response<any, Record<string, any>>>;
    getGrades: (req: Request, res: Response) => Promise<Response<any, Record<string, any>>>;
    getLessons: (req: Request, res: Response) => Promise<Response<any, Record<string, any>>>;
    getSubjects: (req: Request, res: Response) => Promise<Response<any, Record<string, any>>>;
};
export default AssignmentController;
//# sourceMappingURL=assignments.d.ts.map