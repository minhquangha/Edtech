declare const UserService: {
    register: (username: string, password: string) => Promise<{
        id: number;
        username: string;
        role: import("@prisma/client").$Enums.role_t;
        created_at: Date;
        updated_at: Date;
    }>;
    login: (username: string, password: string) => Promise<{
        accessToken: string;
        user: {
            id: number;
            username: string;
            role: import("@prisma/client").$Enums.role_t;
        };
    }>;
};
export default UserService;
//# sourceMappingURL=users.d.ts.map