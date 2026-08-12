import { Router } from "express";
import AssignmentController from "@/controllers/assignments.js";
const router: Router = Router();    
router.post('/create',AssignmentController.create)
console.log(2)
export default router