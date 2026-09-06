import type { Request, Response, NextFunction } from "express";
declare const authenticate: (req: Request, res: Response, next: NextFunction) => Response<any, Record<string, any>> | undefined;
export default authenticate;
//# sourceMappingURL=authenticator.d.ts.map