import prisma from "@/config/prisma.js";
export const UserRepository = {
    findByUsername: async (username) => {
        return await prisma.user.findUnique({
            where: { username },
        });
    },
    findById: async (id) => {
        return await prisma.user.findUnique({
            where: { id },
        });
    },
    create: async (data) => {
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
//# sourceMappingURL=user.repository.js.map