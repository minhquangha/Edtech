import {} from "express";
import UserService from "@/services/users.js";
const UserController = {
    login: async (req, res) => {
        const { username, password } = req.body.data;
        const result = await UserService.login(username, password);
        return res.json(result);
    },
    register: async (req, res) => {
        const { username, password } = req.body.data;
        const result = await UserService.register(username, password);
        return res.json(result);
    }
};
export default UserController;
//# sourceMappingURL=users.js.map