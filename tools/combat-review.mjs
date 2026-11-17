import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";

const url = process.argv[2] || "http://127.0.0.1:4182/?test=1&quality=medium";
const output = process.argv[3] || "output/combat-review";
await mkdir(output, { recursive: true });
const browser = await chromium.launch({
  executablePath: process.env.SUITRUMP_BROWSER || undefined,
  headless: true,
  args: ["--use-gl=angle", "--use-angle=d3d11"],
});

try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  await page.addInitScript(() => { window.requestAnimationFrame = () => 0; });
  await page.goto(url);
  await page.waitForFunction(() => typeof window.render_game_to_text === "function", null, { polling: 100 });
  const state = () => page.evaluate(() => JSON.parse(window.render_game_to_text()));
  const advance = (ms) => page.evaluate((time) => window.advanceTime(time), ms);
  assert.equal((await state()).phase, "ready");
  await page.getByRole("button", { name: "Deploy", exact: true }).click({ timeout: 2500 });
  const deployed = await state();
  assert.equal(deployed.phase, "playing");
  assert.equal(deployed.cameraMode, "first");
  assert.deepEqual(deployed.pickups.find(({ kind }) => kind === "sui"), { kind: "sui", x: 0, z: 24 });
  await page.keyboard.press("KeyE");
  await page.keyboard.down("KeyW");
  await advance(500);
  await page.keyboard.up("KeyW");
  const firstCoin = await state();
  assert.equal(firstCoin.score, 260);
  assert.ok(firstCoin.player.pulseCooldown < 5.2);
  assert.ok(!firstCoin.pickups.some(({ kind }) => kind === "sui"));
  await page.evaluate(() => window.__fudBreachTest.clearEnemies());
  const chain = await state();
  assert.equal(chain.missionStage, "relays");
  assert.equal(chain.chain.count, 5);
  assert.equal(chain.chain.multiplier, 2);
  assert.ok(chain.score - firstCoin.score > 675, "A chain adds points above the sum of base enemy scores");
  assert.deepEqual(chain.pickups.find(({ kind }) => kind === "suitrump"), { kind: "suitrump", x: 0, z: -4 });
  await page.evaluate(() => window.__fudBreachTest.teleport(0, -1, Math.PI));
  await page.keyboard.press("ShiftLeft");
  await page.keyboard.down("KeyW");
  await advance(167);
  await page.keyboard.up("KeyW");
  const secondCoin = await state();
  assert.equal(secondCoin.score, chain.score + 600);
  assert.equal(secondCoin.player.dashCooldown, 0);
  assert.ok(!secondCoin.pickups.some(({ kind }) => kind === "suitrump"));
  await advance(4100);
  assert.equal((await state()).chain.count, 0);
  const scamBot = (await state()).enemies.find(({ kind }) => kind === "bot");
  await page.evaluate(({ x, z }) => window.__fudBreachTest.teleport(x, z + 3, Math.PI), scamBot);
  await page.keyboard.press("Digit3");
  await fireOnce();
  const roll = await state();
  assert.equal(roll.weapon, "rickroll");
  assert.equal(roll.rickrollActive, true);
  assert.ok(!roll.enemies.some(({ id }) => id === scamBot.id));
  assert.ok(roll.player.rickrollCooldown > 9);
  await page.screenshot({ path: path.join(output, "rickroll.png") });
  await advance(450);
  await page.keyboard.press("Digit1");
  await page.evaluate(() => window.__fudBreachTest.clearEnemies());
  await page.evaluate(() => window.__fudBreachTest.teleport(0, -10, Math.PI));
  const relayHealth = () => state().then(({ relays }) => relays.find(({ id }) => id === "relay-2").health);
  async function fireOnce() {
    await page.keyboard.down("Space");
    await advance(17);
    await page.keyboard.up("Space");
  }
  const originalRelayHealth = await relayHealth();
  await fireOnce();
  assert.equal(await relayHealth(), originalRelayHealth - 1);
  await advance(160);
  await page.keyboard.press("Digit2");
  assert.equal((await state()).weapon, "riptide");
  await fireOnce();
  assert.equal(await relayHealth(), originalRelayHealth - 4);
  await page.screenshot({ path: path.join(output, "riptide.png") });
  await advance(170);
  assert.ok((await state()).player.shotCooldown > 0, "Riptide is slower than the Repeater");

  async function enterBoss() {
    await page.evaluate(() => {
      window.__fudBreachTest.destroyRelays();
      window.__fudBreachTest.teleport(0, -14, Math.PI);
    });
    assert.equal((await state()).boss.phase, 1);
    await page.evaluate(() => window.__fudBreachTest.setBossHealth(25));
    await advance(2000);
    const active = await state();
    assert.equal(active.boss.phase, 2);
    assert.ok(active.enemyProjectiles > 0, "The boss still fires its normal phase-two volley");
  }

  await enterBoss();
  await page.screenshot({ path: path.join(output, "boss.png") });
  await page.keyboard.press("KeyP");
  const paused = await state();
  assert.equal(paused.phase, "paused");
  await advance(2000);
  assert.equal((await state()).time, paused.time);
  assert.equal((await state()).enemyProjectiles, paused.enemyProjectiles);
  await page.getByRole("button", { name: "Resume", exact: true }).click();
  assert.equal((await state()).phase, "playing");

  await page.evaluate(() => {
    window.__fudBreachTest.defeatBoss();
    window.__fudBreachTest.teleportToExtraction();
  });
  const victory = await state();
  assert.equal(victory.phase, "victory");
  assert.equal(victory.bestScore, victory.score);
  await page.screenshot({ path: path.join(output, "victory.png") });
  await page.getByRole("button", { name: "Play again", exact: true }).click();
  const replay = await state();
  assert.equal(replay.phase, "playing");
  assert.equal(replay.missionStage, "breach");
  assert.equal(replay.chain.count, 0);
  assert.equal(replay.weapon, "repeater");
  assert.equal(replay.bestScore, victory.score);
  assert.equal(await page.evaluate(() => localStorage.getItem("fud-breach-best-score")), null);

  await page.evaluate(() => window.__fudBreachTest.clearEnemies());
  await enterBoss();
  await page.keyboard.press("KeyR");
  const reset = await state();
  assert.equal(reset.missionStage, "breach");
  assert.equal(reset.boss, null);
  assert.equal(reset.player.health, 100);
  assert.deepEqual(errors, []);
  console.log("Combat review passed: deploy, score chain, Repeater, Riptide, Rickroll, both boss phases, pause/resume, extraction and replay.");
} finally {
  await browser.close();
}
