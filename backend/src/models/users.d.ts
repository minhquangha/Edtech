export type UserRole = "STUDENT" | "TEACHER";
export interface User {
    id: string;
    name: string;
    username: string;
    password: string;
    phone: string;
    dob: Date;
    role: UserRole;
    created_at: Date;
    updated_at: Date;
}
//# sourceMappingURL=users.d.ts.map