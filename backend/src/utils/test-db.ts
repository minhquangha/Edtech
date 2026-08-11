import pool from "@/config/db.js";
import { type Request, type Response } from "express";
export default async function testDB(req:Request,res:Response){
    try {
        const result = await pool.query("SELECT NOW()");
    
        res.json({
          message: "Database connected",
          time: result.rows[0],
        });
      } catch (error) {
        console.error(error);
    
        res.status(500).json({
          message: "Database connection failed",
        });
      }
}