import { defineConfig } from "vitest/config";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["test/**/*.test.ts"],
    // The suite intentionally runs real Tesseract OCR against scanned-PDF
    // fixtures. OCR is slow and CPU-contended when test files run in
    // parallel, so the default 5s timeout is too tight. 60s still catches
    // genuine hangs while leaving headroom for OCR.
    testTimeout: 60_000,
    hookTimeout: 60_000,
    globalSetup: ["./test/global-setup.ts"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
