import { Router } from "express";
import userRouter from "@/routes/users.js";
import assignmentRouter from "@/routes/assignments.js";
import aiRouter from "@/routes/ai.js"
import authenticate from "@/middlewares/authenticator.js";
const router: Router = Router();
console.log(4);
router.use("/ai",aiRouter);
router.use("/users", userRouter);
router.use("/assignments",authenticate, assignmentRouter);
export default router;
