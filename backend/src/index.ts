import express, { type Express} from "express";
import router from "@/routes/index.js";
import testDB from "./utils/test-db.js";
const app: Express = express();

app.use(express.json());
app.get("/health",testDB);
app.use('/',router)
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
