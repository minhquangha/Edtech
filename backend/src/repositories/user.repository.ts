import prisma from "@/config/prisma.js";
import type { role_t } from "@prisma/client";

export const UserRepository = {
  findByUsername: async (username: string) => {
    return await prisma.user.findUnique({
      where: { username },
    });
  },

  findById: async (id: number) => {
    return await prisma.user.findUnique({
      where: { id },
    });
  },

  create: async (data: { username: string; password: string; role?: role_t }) => {
    return await prisma.user.create({
      data,
      select: {
        id: true,
        username: true,
        role: true,
        created_at: true,
        updated_at: true,
      },
    });
  },
};

export default UserRepository;
