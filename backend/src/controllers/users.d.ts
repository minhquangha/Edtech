import { type Request, type Response } from "express";
declare const UserController: {
    login: (req: Request, res: Response) => Promise<Response<any, Record<string, any>>>;
    register: (req: Request, res: Response) => Promise<Response<any, Record<string, any>>>;
};
export default UserController;
//# sourceMappingURL=users.d.ts.map