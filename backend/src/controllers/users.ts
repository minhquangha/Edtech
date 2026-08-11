import { type Request,type Response } from "express" 
import UserService from "@/services/users.js";
const UserController =  {
    login: async (req:Request,res:Response)=>{
        const {username, password } = req.body.data;

        const result = await UserService.login(username, password);

        return res.json(result);
    },
    register: async (req:Request,res:Response)=>{
        const {username, password} = req.body.data;

        const result = await UserService.register(username,password);
        return res.json(result);
    }
}
export default UserController;