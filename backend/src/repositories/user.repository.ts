import prisma from "@/config/prisma.js";

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

  create: async (data: { username: string; password: string; role?: string }) => {
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
