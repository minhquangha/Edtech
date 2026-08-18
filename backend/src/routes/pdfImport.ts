import { Router } from "express";
import multer from "multer";
import PdfImportController from "@/controllers/pdfImport.js";

const router: Router = Router();

const storage = multer.memoryStorage();

const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024,
    files: 5,
  },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype !== "application/pdf") {
      cb(new Error("Only PDF files are allowed"));
      return;
    }
    cb(null, true);
  },
});

router.post(
  "/import",
  upload.array("pdfs", 5),
  PdfImportController.import,
);

export default router;
