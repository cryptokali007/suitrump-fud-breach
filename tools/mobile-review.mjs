import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

const url = process.argv[2] || "http://127.0.0.1:4182/?quality=medium&test=1";
const outputRoot = path.resolve(process.argv[3] || "output/mobile-review");
fs.mkdirSync(outputRoot, { recursive: true });
const browser = await chromium.launch({ headless: true, args: ["--use-gl=angle", "--use-angle=d3d11"] });
const errors = [];

async function reviewViewport(name, viewport, portrait = false) {
  const context = await browser.newContext({ viewport, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  page.on("console", (message) => {
    if (message.type() === "error") errors.push({ viewport: name, type: "console", text: message.text() });
  });
  page.on("pageerror", (error) => errors.push({ viewport: name, type: "pageerror", text: String(error) }));
  await page.goto(url, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Deploy", exact: true }).waitFor();
  const visibility = await page.locator("#touch-controls").evaluate((element) => getComputedStyle(element).display);
  const rotatePrompt = await page.locator("#rotate-prompt").evaluate((element) => getComputedStyle(element).display);
  await page.screenshot({ path: path.join(outputRoot, `${name}-ready.png`), fullPage: true });
  if (!portrait) {
    await page.tap("#dash-button");
    await page.evaluate(() => window.advanceTime(500));
  }
  const state = JSON.parse(await page.evaluate(() => window.render_game_to_text()));
  if (!portrait) await page.screenshot({ path: path.join(outputRoot, `${name}-playing.png`), fullPage: true });
  await context.close();
  return { name, viewport, touchControls: visibility, rotatePrompt, state };
}

const results = [];
results.push(await reviewViewport("landscape", { width: 844, height: 390 }));
results.push(await reviewViewport("portrait", { width: 390, height: 844 }, true));
fs.writeFileSync(path.join(outputRoot, "results.json"), JSON.stringify(results, null, 2));
fs.writeFileSync(path.join(outputRoot, "errors.json"), JSON.stringify(errors, null, 2));
await browser.close();

const landscape = results.find((entry) => entry.name === "landscape");
const portrait = results.find((entry) => entry.name === "portrait");
const failed = [];
if (landscape.touchControls === "none" || landscape.state.phase !== "playing" || landscape.state.player.dashCooldown <= 0) failed.push(landscape);
if (portrait.rotatePrompt === "none" || portrait.touchControls !== "none" || portrait.state.phase !== "ready") failed.push(portrait);
if (failed.length || errors.length) {
  console.error(JSON.stringify({ failed, errors }, null, 2));
  process.exitCode = 1;
}
