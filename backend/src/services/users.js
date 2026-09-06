import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { UserRepository } from "@/repositories/user.repository.js";
const UserService = {
    register: async (username, password) => {
        // 1. Kiểm tra username đã tồn tại chưa
        const existingUser = await UserRepository.findByUsername(username);
        if (existingUser) {
            throw new Error("Username already exists");
        }
        // 2. Hash mật khẩu
        const passwordHash = await bcrypt.hash(password, 10);
        // 3. Tạo user mới
        const newUser = await UserRepository.create({
            username,
            password: passwordHash,
        });
        return newUser;
    },
    login: async (username, password) => {
        // 1. Tìm user theo username
        const user = await UserRepository.findByUsername(username);
        if (!user) {
            throw new Error("Invalid username or password");
        }
        // 2. Kiểm tra password 
        const isPasswordCorrect = await bcrypt.compare(password, user.password);
        if (!isPasswordCorrect) {
            throw new Error("Invalid username or password");
        }
        // 3. Tạo JWT
        const token = jwt.sign({
            id: user.id,
            username: user.username,
            role: user.role,
        }, process.env.JWT_SECRET, {
            expiresIn: "1d",
        });
        return {
            accessToken: token,
            user: {
                id: user.id,
                username: user.username,
                role: user.role,
            },
        };
    },
};
export default UserService;
//# sourceMappingURL=users.js.map