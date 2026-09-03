export interface User {
    id: number,
    username: string,
    role: string
}
export type UserRole = "STUDENT" | "TEACHER"

export interface UserSaveDB {
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