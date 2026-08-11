import express, { type Express, type Request, type Response } from "express";
import testDB from "@/utils/test-db.js";
import router from "@/routes/index.js";
const app: Express = express();

app.use(express.json());

app.use('/',router)
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
