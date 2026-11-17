import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

const url = process.argv[2] || "http://127.0.0.1:4182/?quality=high&test=1";
const outputRoot = path.resolve(process.argv[3] || "output/control-review");
fs.mkdirSync(outputRoot, { recursive: true });
const browser = await chromium.launch({ headless: true, args: ["--use-gl=angle", "--use-angle=d3d11"] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
const checks = [];
page.on("console", (message) => {
  if (message.type() === "error") errors.push({ type: "console", text: message.text() });
});
page.on("pageerror", (error) => errors.push({ type: "pageerror", text: String(error) }));

function check(name, passed, evidence) {
  checks.push({ name, passed: Boolean(passed), evidence });
}

async function state() {
  return JSON.parse(await page.evaluate(() => window.render_game_to_text()));
}

await page.goto(url, { waitUntil: "networkidle" });
await page.keyboard.press("Space");
await page.evaluate(() => window.advanceTime(100));
check("start flow", (await state()).phase === "playing", await state());

check("first-person default", (await state()).cameraMode === "first", await state());
await page.screenshot({ path: path.join(outputRoot, "first-person.png"), fullPage: true });
await page.keyboard.press("KeyV");
check("third-person toggle", (await state()).cameraMode === "third", await state());

await page.keyboard.press("ShiftLeft");
await page.evaluate(() => window.advanceTime(80));
check("dash action and cooldown", (await state()).player.dashCooldown > 2, await state());

await page.keyboard.press("KeyE");
await page.evaluate(() => window.advanceTime(80));
check("SUI pulse action and cooldown", (await state()).player.pulseCooldown > 7, await state());

await page.keyboard.press("KeyP");
check("pause", (await state()).phase === "paused", await state());
const pausedAt = (await state()).time;
await page.evaluate(() => window.advanceTime(1000));
const pausedAfter = (await state()).time;
check("pause freezes mission clock", Math.abs(pausedAfter - pausedAt) < 0.01, { pausedAt, pausedAfter });
await page.keyboard.press("KeyP");
check("resume", (await state()).phase === "playing", await state());

await page.evaluate(() => window.__fudBreachTest.clearEnemies());
await page.evaluate(() => window.__fudBreachTest.teleport(0, -10, Math.PI));
const relayBefore = (await state()).relays.find((relay) => relay.id === "relay-2")?.health;
await page.keyboard.down("Space");
await page.evaluate(() => window.advanceTime(1400));
await page.keyboard.up("Space");
const relayAfter = (await state()).relays.find((relay) => relay.id === "relay-2")?.health;
check("normal gunfire damages relay", relayAfter < relayBefore, { relayBefore, relayAfter });

await page.evaluate(() => window.__fudBreachTest.destroyRelays());
await page.evaluate(() => window.__fudBreachTest.teleport(0, -14, Math.PI));
const bossBefore = (await state()).boss?.health;
await page.keyboard.down("Space");
await page.evaluate(() => window.advanceTime(1600));
await page.keyboard.up("Space");
const bossAfter = (await state()).boss?.health;
check("normal gunfire damages boss", bossAfter < bossBefore, { bossBefore, bossAfter });
await page.screenshot({ path: path.join(outputRoot, "boss-combat.png"), fullPage: true });

await page.keyboard.press("KeyF");
await page.waitForTimeout(100);
const fullscreenEntered = await page.evaluate(() => Boolean(document.fullscreenElement));
check("fullscreen enter", fullscreenEntered, { fullscreenEntered });
if (fullscreenEntered) await page.keyboard.press("Escape");

await page.keyboard.press("KeyR");
const restarted = await state();
check("restart resets mission", restarted.phase === "playing" && restarted.missionStage === "breach" && restarted.kills === 0, restarted);

fs.writeFileSync(path.join(outputRoot, "checks.json"), JSON.stringify(checks, null, 2));
fs.writeFileSync(path.join(outputRoot, "errors.json"), JSON.stringify(errors, null, 2));
await browser.close();

const failed = checks.filter((entry) => !entry.passed);
if (failed.length || errors.length) {
  console.error(JSON.stringify({ failed, errors }, null, 2));
  process.exitCode = 1;
}
