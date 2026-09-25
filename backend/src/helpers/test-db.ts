import prisma from "@/config/prisma.js";
import { type Request, type Response } from "express";

export default async function testDB(req: Request, res: Response) {
  try {
    const result = await prisma.$queryRaw<Array<{ now: Date }>>`SELECT NOW()`;

    res.json({
      message: "Database connected",
      time: result[0],
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      message: "Database connection failed",
    });
  }
}