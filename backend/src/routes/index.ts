import { Router } from "express";
import userRouter from "@/routes/users.js";
const router: Router = Router();    

router.use("/users",userRouter);

export default router;