import { Router } from "express";
import UserController from "@/controllers/users.js";
const router: Router = Router();

router.get("/me/login", UserController.login);
router.post("/me/register", UserController.register);
export default router;
