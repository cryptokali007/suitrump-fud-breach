import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

const url = process.argv[2] || "http://127.0.0.1:4182/?quality=high&test=1";
const outputRoot = path.resolve(
  process.argv[3] || process.env.SUITRUMP_SHOWCASE_OUTPUT || "output/showcase",
);
const webmPath = path.join(outputRoot, "SuiTrump-FUD-Breach-Showcase-with-audio.webm");
const reportPath = path.join(outputRoot, "SuiTrump-FUD-Breach-Showcase-report.json");
fs.mkdirSync(outputRoot, { recursive: true });

const browser = await chromium.launch({
  headless: true,
  args: [
    "--use-gl=angle",
    "--use-angle=d3d11",
    "--autoplay-policy=no-user-gesture-required",
  ],
});
const page = await browser.newPage({
  viewport: { width: 1280, height: 720 },
  deviceScaleFactor: 1,
  acceptDownloads: true,
});
const errors = [];
page.on("console", (message) => {
  if (message.type() === "error") errors.push({ type: "console", text: message.text() });
});
page.on("pageerror", (error) => errors.push({ type: "pageerror", text: String(error) }));

const wait = (milliseconds) => page.waitForTimeout(milliseconds);
const readState = async () => JSON.parse(await page.evaluate(() => window.render_game_to_text()));

async function hold(key, milliseconds) {
  await page.keyboard.down(key);
  await wait(milliseconds);
  await page.keyboard.up(key);
}

async function fireFor(milliseconds) {
  await hold("Space", milliseconds);
}

await page.goto(url, { waitUntil: "networkidle" });
await page.waitForFunction(() => Boolean(window.render_game_to_text && window.__fudBreachTest));

const captureInfo = await page.evaluate(() => {
  const gameCanvas = document.getElementById("game-canvas");
  const hudCanvas = document.getElementById("hud-canvas");
  const composite = document.createElement("canvas");
  composite.width = 1280;
  composite.height = 720;
  const context = composite.getContext("2d", { alpha: false });
  const audioStream = window.__fudBreachTest.captureAudioStream();
  const videoStream = composite.captureStream(60);
  const stream = new MediaStream([
    ...videoStream.getVideoTracks(),
    ...audioStream.getAudioTracks(),
  ]);
  const mimeTypes = [
    "video/webm;codecs=vp8,opus",
    "video/webm;codecs=vp9,opus",
    "video/webm",
  ];
  const mimeType = mimeTypes.find((candidate) => MediaRecorder.isTypeSupported(candidate)) || "video/webm";
  const recorder = new MediaRecorder(stream, {
    mimeType,
    videoBitsPerSecond: 10_000_000,
    audioBitsPerSecond: 160_000,
  });
  const chunks = [];
  let animationFrame = 0;

  const compositeFrame = () => {
    context.fillStyle = "#03050c";
    context.fillRect(0, 0, composite.width, composite.height);
    context.drawImage(gameCanvas, 0, 0, composite.width, composite.height);
    context.drawImage(hudCanvas, 0, 0, composite.width, composite.height);
    animationFrame = requestAnimationFrame(compositeFrame);
  };

  recorder.addEventListener("dataavailable", (event) => {
    if (event.data.size > 0) chunks.push(event.data);
  });
  compositeFrame();
  recorder.start(250);

  window.__showcaseCapture = {
    stop(filename) {
      return new Promise((resolve) => {
        recorder.addEventListener(
          "stop",
          () => {
            cancelAnimationFrame(animationFrame);
            const blob = new Blob(chunks, { type: mimeType });
            const anchor = document.createElement("a");
            anchor.href = URL.createObjectURL(blob);
            anchor.download = filename;
            document.body.appendChild(anchor);
            anchor.click();
            anchor.remove();
            resolve({ bytes: blob.size, mimeType });
          },
          { once: true },
        );
        recorder.stop();
      });
    },
  };

  return {
    mimeType,
    audioTracks: audioStream.getAudioTracks().length,
    videoTracks: videoStream.getVideoTracks().length,
  };
});

// Title card and mission deployment.
await wait(1400);
await page.keyboard.press("Space");
await wait(900);

// Breach: movement, aim sweep, sustained fire, dash, and third-person combat.
await page.keyboard.down("KeyW");
await page.keyboard.down("Space");
await wait(900);
await page.keyboard.press("ShiftLeft");
await wait(950);
await page.keyboard.down("ArrowLeft");
await wait(520);
await page.keyboard.up("ArrowLeft");
await wait(750);
await page.keyboard.up("Space");
await page.keyboard.up("KeyW");
await wait(650);

// First-person combat beat.
await page.keyboard.press("KeyV");
await wait(650);
await fireFor(1800);
await page.keyboard.press("KeyV");
await wait(600);

// Advance cleanly to the relay objective, then damage a relay with real gunfire.
await page.evaluate(() => {
  window.__fudBreachTest.clearEnemies();
  window.__fudBreachTest.teleport(0, -10, Math.PI);
});
await wait(2200);
await page.keyboard.press("KeyE");
await fireFor(1900);
await wait(500);

// Bring up the boss, show both camera modes, and finish it with live combat.
await page.evaluate(() => {
  window.__fudBreachTest.destroyRelays();
  window.__fudBreachTest.teleport(0, -14, Math.PI);
});
await wait(2600);
await page.evaluate(() => window.__fudBreachTest.setBossHealth(23));
await page.keyboard.press("KeyV");
await page.keyboard.press("ShiftLeft");
await fireFor(2800);

let finalState = await readState();
if (finalState.missionStage === "boss") {
  await page.evaluate(() => window.__fudBreachTest.setBossHealth(3));
  await fireFor(1000);
  finalState = await readState();
}
if (finalState.missionStage === "boss") {
  await page.evaluate(() => window.__fudBreachTest.defeatBoss());
}

// Return to third person, reveal extraction, and hold the victory/rank screen.
await page.keyboard.press("KeyV");
await wait(2200);
await page.evaluate(() => {
  window.__fudBreachTest.preparePerfectVictory();
  window.__fudBreachTest.teleportToExtraction();
});
await wait(4200);
finalState = await readState();

const downloadPromise = page.waitForEvent("download", { timeout: 30_000 });
const stopResult = await page.evaluate(
  (filename) => window.__showcaseCapture.stop(filename),
  path.basename(webmPath),
);
const download = await downloadPromise;
await download.saveAs(webmPath);

const report = {
  url,
  output: webmPath,
  captureInfo,
  stopResult,
  finalState,
  errors,
};
fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
await browser.close();

console.log(JSON.stringify(report, null, 2));
if (errors.length || finalState.phase !== "victory") process.exitCode = 1;
