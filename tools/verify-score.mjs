import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { checkRun, receiptHashInput } from "../src/scoring.js";

try {
  const path = process.argv[2];
  if (!path) throw new Error("Usage: npm run verify:score -- path/to/score.json");
  const receipt = JSON.parse(await readFile(path, "utf8"));
  const total = checkRun(receipt);
  const digest = createHash("sha256").update(receiptHashInput(receipt)).digest("hex");
  if (digest !== receipt.sha256) throw new Error("Receipt checksum differs from its contents.");
  console.log(`Verified score calculation: ${total.toLocaleString()} points · ${receipt.rank} · ${(receipt.durationMs / 1000).toFixed(2)}s`);
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
