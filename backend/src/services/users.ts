import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import pool from "@/config/db.js";

const UserService = {
  register: async (username: string, password: string) => {
    // 1. Kiểm tra username đã tồn tại chưa (Bọc "User" trong dấu "")
    const existingUser = await pool.query(
      `SELECT id FROM "User" WHERE username = $1`,
      [username],
    );

    if (existingUser.rows.length > 0) {
      throw new Error("Username already exists");
    }

    // 2. Hash mật khẩu
    const passwordHash = await bcrypt.hash(password, 10);

    // 3. Tạo user mới (Sửa password_hash -> password)
    const result = await pool.query(
      `
      INSERT INTO "User" (username, password)
      VALUES ($1, $2)
      RETURNING id, username, role, created_at, updated_at
      `,
      [username, passwordHash],
    );

    return result.rows[0];
  },

  login: async (username: string, password: string) => {
    // 1. Tìm user theo username
    const result = await pool.query(
      `
      SELECT *
      FROM "User"
      WHERE username = $1
      `,
      [username],
    );

    if (result.rows.length === 0) {
      throw new Error("Invalid username or password");
    }

    const user = result.rows[0];

    // 2. Kiểm tra password 
    const isPasswordCorrect = await bcrypt.compare(
      password,
      user.password,
    );

    if (!isPasswordCorrect) {
      throw new Error("Invalid username or password");
    }

    // 3. Tạo JWT
    const token = jwt.sign(
      {
        id: user.id,
        username: user.username,
        role: user.role,
      },
      process.env.JWT_SECRET as string,
      {
        expiresIn: "1d",
      },
    );

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