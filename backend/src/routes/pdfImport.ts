import { Router } from "express";
import multer from "multer";
import PdfImportController from "@/controllers/pdfImport.js";

const router: Router = Router();

const storage = multer.memoryStorage();//Dữ liệu upload sẽ lưu trữ vào RAM

import { validatePdfUpload } from "@/middlewares/validate.js";

const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024,
    files: 5,
  },
  fileFilter: (_req, file, cb) => {
    // Accept all files into memory buffer so validatePdfUpload can inspect MIME & Magic Bytes and return proper HTTP 400 Bad Request response
    cb(null, true);
  },
});

router.post(
  "/import",
  upload.array("pdfs", 5),
  validatePdfUpload,
  PdfImportController.import,
);

export default router;
