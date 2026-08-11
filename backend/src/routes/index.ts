import { Router } from "express";
import userRouter from "@/routes/users.js";
import assignmentRouter from "@/routes/assignments.js"
const router: Router = Router();    

router.use("/users",userRouter);
router.use("/assignments",assignmentRouter)
export default router;