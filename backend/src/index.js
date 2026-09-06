import express, {} from "express";
import router from "@/routes/index.js";
import testDB from "./utils/test-db.js";
import cors from "cors";
import dotenv from "dotenv";
dotenv.config();
const app = express();
app.use(express.json());
app.get("/health", testDB);
app.use(cors({
    origin: process.env.FRONTEND_URL,
    credentials: true
}));
app.use('/', router);
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
//# sourceMappingURL=index.js.map