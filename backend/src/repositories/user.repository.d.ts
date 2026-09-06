import type { role_t } from "@prisma/client";
export declare const UserRepository: {
    findByUsername: (username: string) => Promise<{
        id: number;
        username: string;
        name: string | null;
        password: string;
        phone: string | null;
        dob: Date | null;
        role: import("@prisma/client").$Enums.role_t;
        created_at: Date;
        updated_at: Date;
    } | null>;
    findById: (id: number) => Promise<{
        id: number;
        username: string;
        name: string | null;
        password: string;
        phone: string | null;
        dob: Date | null;
        role: import("@prisma/client").$Enums.role_t;
        created_at: Date;
        updated_at: Date;
    } | null>;
    create: (data: {
        username: string;
        password: string;
        role?: role_t;
    }) => Promise<{
        id: number;
        username: string;
        role: import("@prisma/client").$Enums.role_t;
        created_at: Date;
        updated_at: Date;
    }>;
};
export default UserRepository;
//# sourceMappingURL=user.repository.d.ts.map