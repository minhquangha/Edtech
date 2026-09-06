import prisma from "@/config/prisma.js";
import {} from "express";
export default async function testDB(req, res) {
    try {
        const result = await prisma.$queryRaw `SELECT NOW()`;
        res.json({
            message: "Database connected",
            time: result[0],
        });
    }
    catch (error) {
        console.error(error);
        res.status(500).json({
            message: "Database connection failed",
        });
    }
}
//# sourceMappingURL=test-db.js.map