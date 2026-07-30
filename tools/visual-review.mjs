import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

const url = process.argv[2] || "http://127.0.0.1:4182/?quality=high";
const outputRoot = path.resolve(process.argv[3] || "output/visual-review");
fs.mkdirSync(outputRoot, { recursive: true });

const browser = await chromium.launch({
  headless: true,
  args: ["--use-gl=angle", "--use-angle=d3d11"],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
const errors = [];
page.on("console", (message) => {
  if (message.type() === "error") errors.push({ type: "console", text: message.text() });
});
page.on("pageerror", (error) => errors.push({ type: "pageerror", text: String(error) }));

await page.goto(url, { waitUntil: "networkidle" });
await page.waitForTimeout(700);
await page.screenshot({ path: path.join(outputRoot, "ready.png"), fullPage: true });

await page.keyboard.press("Space");
await page.evaluate(() => window.advanceTime?.(800));
await page.keyboard.down("Space");
await page.evaluate(() => window.advanceTime?.(2200));
await page.keyboard.up("Space");
await page.keyboard.down("ArrowUp");
await page.evaluate(() => window.advanceTime?.(1200));
await page.keyboard.up("ArrowUp");
await page.screenshot({ path: path.join(outputRoot, "combat.png"), fullPage: true });

const state = await page.evaluate(() => window.render_game_to_text?.());
if (state) fs.writeFileSync(path.join(outputRoot, "state.json"), state);
fs.writeFileSync(path.join(outputRoot, "errors.json"), JSON.stringify(errors, null, 2));
await browser.close();

if (errors.length) {
  console.error(JSON.stringify(errors, null, 2));
  process.exitCode = 1;
}
