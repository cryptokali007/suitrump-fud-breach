import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

const url = process.argv[2] || "http://127.0.0.1:4182/?quality=high&test=1";
const outputRoot = path.resolve(process.argv[3] || "output/mission-review");
fs.mkdirSync(outputRoot, { recursive: true });

const browser = await chromium.launch({ headless: true, args: ["--use-gl=angle", "--use-angle=d3d11"] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
const errors = [];
page.on("console", (message) => {
  if (message.type() === "error") errors.push({ type: "console", text: message.text() });
});
page.on("pageerror", (error) => errors.push({ type: "pageerror", text: String(error) }));

async function capture(name) {
  await page.waitForTimeout(120);
  await page.screenshot({ path: path.join(outputRoot, `${name}.png`), fullPage: true });
  const state = await page.evaluate(() => window.render_game_to_text?.());
  if (state) fs.writeFileSync(path.join(outputRoot, `${name}.json`), state);
}

await page.goto(url, { waitUntil: "networkidle" });
await page.keyboard.press("Space");
await page.evaluate(() => window.advanceTime?.(600));
await capture("01-breach");

await page.evaluate(() => window.__fudBreachTest.clearEnemies());
await page.evaluate(() => window.__fudBreachTest.teleport(0, -10, Math.PI));
await page.evaluate(() => window.advanceTime?.(3200));
await capture("02-relays");

await page.evaluate(() => window.__fudBreachTest.destroyRelays());
await page.evaluate(() => window.__fudBreachTest.teleport(0, -14, Math.PI));
await page.evaluate(() => window.advanceTime?.(3200));
await page.evaluate(() => window.__fudBreachTest.setBossHealth(23));
await capture("03-boss");

await page.evaluate(() => window.__fudBreachTest.defeatBoss());
await page.evaluate(() => window.__fudBreachTest.teleport(0, -25, Math.PI));
await page.evaluate(() => window.advanceTime?.(1200));
await capture("04-extract");

await page.evaluate(() => window.__fudBreachTest.teleportToExtraction());
await capture("05-victory");

await page.keyboard.press("KeyR");
await page.evaluate(() => window.__fudBreachTest.defeatPlayer());
await capture("06-gameover");

fs.writeFileSync(path.join(outputRoot, "errors.json"), JSON.stringify(errors, null, 2));
await browser.close();
if (errors.length) {
  console.error(JSON.stringify(errors, null, 2));
  process.exitCode = 1;
}
