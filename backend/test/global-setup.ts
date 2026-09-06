import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { generateTestFixtures } from "../scripts/generate-test-fixtures.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Generates the synthetic PDF test fixtures before the suite runs so the
 * tests work even from a fresh checkout where the binary fixtures have not
 * been committed yet. Idempotent: skips work when the fixtures already exist.
 */
export default function globalSetup(): void {
  const fixturesDir = path.join(__dirname, "fixtures");
  const marker = path.join(fixturesDir, "structure-exam.pdf");

  if (existsSync(marker)) {
    return;
  }

  console.log(
    "[global-setup] Synthetic PDF fixtures missing — generating them..."
  );
  generateTestFixtures();
}