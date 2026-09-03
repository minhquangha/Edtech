import express, { type Express } from "express";
import router from "@/routes/index.js";
import testDB from "@/helper/test-db.js";
import cors from "cors";
import dotenv from "dotenv";
dotenv.config();
const app: Express = express();

app.use(express.json());
app.get("/health", testDB);
app.use(cors({
  origin: process.env.FRONTEND_URL,
  credentials: true
}));
app.use('/', router)
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
