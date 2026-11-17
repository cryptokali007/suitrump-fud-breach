import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { AudioDirector } from "./audio.js";
import { addBackdrop, createArenaFloor, createCover, createNightSky } from "./arena-art.js";
import { updateCoinFrames } from "./coin-models.js";
import { bindScorePanel } from "./score-panel.js";
import { COINS, ENCOUNTERS, RunScore, SCORE_GAME, SCORE_VERSION, runRank, scoreTime } from "./scoring.js";
import {
  CHAIN_WINDOW,
  ENEMY_TYPES,
  INNER_SPAWNS,
  OUTER_SPAWNS,
  RICKROLL_COOLDOWN,
  STAGE_COPY,
  STEP,
  TAU,
  WEAPONS,
  WEAPON_SLOTS,
  WORLD_HALF_X,
  WORLD_HALF_Z,
  chainMultiplier,
  clamp,
  distance2,
  forwardOf,
  random,
  rightOf,
  round,
  wrapAngle,
  palette,
} from "./config.js";
import {
  createAquaticMascot,
  createBossModel,
  createEnemyModel,
  createFirstPersonWeapon,
  createPickupModel,
  createPlayerModel,
  createRelayModel,
  createWaterDrop,
  material,
  setShadowRecursive,
} from "./models.js";

const shell = document.getElementById("game-shell");
const canvas = document.getElementById("game-canvas");
const hud = document.getElementById("hud-canvas");
const missionAction = document.getElementById("mission-action");
const scoreAction = document.getElementById("score-action");
const scoreDialog = document.getElementById("score-dialog");
const weaponButton = document.getElementById("weapon-button");
const ui = hud.getContext("2d");
const audio = new AudioDirector();
const query = new URLSearchParams(window.location.search);
const QA_MODE = query.get("qa") === "1";
const TEST_MODE = QA_MODE || query.get("test") === "1";
const QUALITY_KEY = "fud-breach-quality";
const QUALITY_LEVELS = ["high", "medium", "low"];
let runScore = new RunScore();

const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  alpha: false,
  preserveDrawingBuffer: true,
  powerPreference: "high-performance",
});
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.26;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
scene.background = createNightSky();
scene.fog = new THREE.FogExp2(0x283950, 0.0105);

const camera = new THREE.PerspectiveCamera(62, 16 / 9, 0.08, 160);
const composer = new EffectComposer(renderer);
const renderPass = new RenderPass(scene, camera);
const bloomPass = new UnrealBloomPass(new THREE.Vector2(1280, 720), 0.46, 0.42, 0.86);
composer.addPass(renderPass);
composer.addPass(bloomPass);
composer.addPass(new OutputPass());

const tmpA = new THREE.Vector3();
const tmpB = new THREE.Vector3();
const tmpC = new THREE.Vector3();
const worldRoot = new THREE.Group();
const dynamicRoot = new THREE.Group();
scene.add(worldRoot, dynamicRoot);

const obstacles = [];
const staticLabels = [];
const relays = [];
const cancelTouchPads = [];
const friendlyCreatures = [];
let gate = null;
let extraction = null;
let boss = null;
let lastFrame = performance.now();
let qaRenderCounter = 0;
let renderedWidth = 0;
let renderedHeight = 0;

const state = {
  phase: "ready",
  stage: "breach",
  time: 0,
  visualTime: 0,
  stageTime: 0,
  stageBanner: 0,
  score: 0,
  bestScore: 0,
  newBest: false,
  chain: 0,
  chainUntil: 0,
  peakChain: 0,
  coinFlash: 0,
  kills: 0,
  shots: 0,
  hits: 0,
  cameraMode: "first",
  weapon: "repeater",
  rickrollTimer: 0,
  objective: "Click or press Space to begin the breach.",
  message: "",
  messageTimer: 0,
  hitFlash: 0,
  hitMarker: 0,
  cameraShake: 0,
  triggerHeld: false,
  mouseLocked: false,
  quality: QA_MODE ? "low" : readQuality(),
  keys: new Set(),
  touch: { moveX: 0, moveY: 0, aimX: 0, aimY: 0, aiming: false },
  player: {
    x: 0,
    z: 29,
    yaw: Math.PI,
    radius: 0.68,
    health: 100,
    maxHealth: 100,
    armor: 50,
    maxArmor: 50,
    speed: 8.1,
    shotCooldown: 0,
    rickrollCooldown: 0,
    pulseCooldown: 0,
    dashCooldown: 0,
    dashTime: 0,
    invulnerable: 0,
    recoil: 0,
    moveAmount: 0,
  },
  camera: {
    eye: new THREE.Vector3(0, 5.1, 38),
    target: new THREE.Vector3(0, 1.45, 20),
  },
  enemies: [],
  enemyShots: [],
  tracers: [],
  particles: [],
  pickups: [],
  shockwaves: [],
  labels: [],
};

const playerModel = createPlayerModel();
dynamicRoot.add(playerModel);
const firstPersonWeapon = createFirstPersonWeapon();
camera.add(firstPersonWeapon);
scene.add(camera);
const waterDrop = createWaterDrop();

buildLighting();
buildWorld();
setupInput();
applyQuality(state.quality);
resetGame(false);
requestAnimationFrame(frame);

function buildLighting() {
  const hemi = new THREE.HemisphereLight(0xc9e8ff, 0x435272, 2.1);
  scene.add(hemi);

  const moon = new THREE.DirectionalLight(0xbcd9ff, 2.25);
  moon.position.set(-18, 28, 16);
  moon.castShadow = true;
  moon.shadow.mapSize.set(2048, 2048);
  moon.shadow.camera.left = -42;
  moon.shadow.camera.right = 42;
  moon.shadow.camera.top = 48;
  moon.shadow.camera.bottom = -48;
  moon.shadow.camera.near = 1;
  moon.shadow.camera.far = 100;
  moon.shadow.normalBias = 0.04;
  scene.add(moon);

  const blueRim = new THREE.PointLight(palette.sui, 135, 48, 1.7);
  blueRim.position.set(-20, 8, 8);
  scene.add(blueRim);

  const redRim = new THREE.PointLight(0xff7a53, 100, 42, 1.7);
  redRim.position.set(20, 7, -20);
  scene.add(redRim);
}

function buildWorld() {
  worldRoot.add(createArenaFloor(renderer.capabilities.getMaxAnisotropy()));

  addLaneGlow(-11);
  addLaneGlow(0);
  addLaneGlow(11);
  addBoundaryWalls();
  addArchitecture();
  addFriendlyCreatures();
  addBackdrop(worldRoot);
  addAtmosphere();
  addRelays();
  addGate();
  addExtractionPad();
}

function addFriendlyCreatures() {
  for (const [kind, x, angle] of [["walrus", -10, 0.4], ["seal", 10, -0.4]]) {
    const creature = createAquaticMascot(kind);
    creature.position.set(x, 3.96, 9.5);
    creature.rotation.y = angle;
    creature.scale.setScalar(1.26);
    friendlyCreatures.push(creature);
    worldRoot.add(creature);
  }
}

function addLaneGlow(x) {
  const glowMat = new THREE.MeshBasicMaterial({
    color: palette.sui,
    transparent: true,
    opacity: x === 0 ? 0.24 : 0.11,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const lane = new THREE.Mesh(new THREE.PlaneGeometry(x === 0 ? 0.16 : 0.08, WORLD_HALF_Z * 2 - 2), glowMat);
  lane.rotation.x = -Math.PI / 2;
  lane.position.set(x, 0.04, 0);
  worldRoot.add(lane);
}

function addBoundaryWalls() {
  const barrier = material(0x35445a, { roughness: 0.7, metalness: 0.3, flatShading: false });
  const strips = new THREE.InstancedMesh(
    new THREE.BoxGeometry(1, 1, 1),
    new THREE.MeshBasicMaterial({ color: 0x479fc7 }),
    4,
  );
  const marker = new THREE.Object3D();
  const longSide = WORLD_HALF_X * 2 + 1.2;
  const shortSide = WORLD_HALF_Z * 2 + 1.2;
  const sides = [
    [0, -WORLD_HALF_Z - 0.55, longSide, 1.1],
    [0, WORLD_HALF_Z + 0.55, longSide, 1.1],
    [-WORLD_HALF_X - 0.55, 0, 1.1, shortSide],
    [WORLD_HALF_X + 0.55, 0, 1.1, shortSide],
  ];
  sides.forEach(([x, z, width, depth], index) => {
    addBlock(x, z, width, 2.15, depth, barrier, null, false);
    marker.position.set(x, 2.17, z);
    marker.scale.set(width - 0.12, 0.05, depth - 0.15);
    marker.updateMatrix();
    strips.setMatrixAt(index, marker.matrix);
  });
  worldRoot.add(strips);
}

function addArchitecture() {
  const dark = material(0x35465b, { roughness: 0.76, metalness: 0.25, flatShading: false });
  const darkAlt = material(0x40394a, { roughness: 0.7, metalness: 0.26, flatShading: false });
  const blue = material(0x26547a, { roughness: 0.58, metalness: 0.34, flatShading: false });

  addBlock(-18, 21, 6.2, 2.7, 5.5, dark, "INTERCEPT");
  addBlock(18, 21, 6.2, 2.7, 5.5, dark, "POWER STACK");
  addBlock(-10, 9, 5.8, 3.9, 7.6, darkAlt, "SCREEN BAY");
  addBlock(10, 9, 5.8, 3.9, 7.6, darkAlt, "BOT FACTORY");
  addBlock(-20, -3, 5.2, 2.3, 7.4, blue, "UPLINK");
  addBlock(20, -3, 5.2, 2.3, 7.4, blue, "MONITOR ROW");
  addBlock(-8.5, -16.5, 5.6, 3.3, 5.6, dark, "SIGNAL A");
  addBlock(8.5, -16.5, 5.6, 3.3, 5.6, dark, "SIGNAL B");
  addBlock(-18, -30, 5.4, 2.5, 4.4, darkAlt, null);
  addBlock(18, -30, 5.4, 2.5, 4.4, darkAlt, null);

  const bridgeMat = material(0x44586f, { roughness: 0.67, metalness: 0.28, flatShading: false });
  addBlock(-18, -7.5, 23, 3.1, 1.1, bridgeMat, null, true);
  addBlock(18, -7.5, 23, 3.1, 1.1, bridgeMat, null, true);
}

function addAtmosphere() {
  const positions = [];
  const colors = [];
  const colorA = new THREE.Color(palette.sui);
  const colorB = new THREE.Color(palette.gold);
  for (let index = 0; index < 420; index += 1) {
    positions.push(random(-46, 46), random(0.25, 18), random(-56, 52));
    const color = Math.random() > 0.82 ? colorB : colorA;
    colors.push(color.r, color.g, color.b);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  const points = new THREE.Points(
    geometry,
    new THREE.PointsMaterial({ size: 0.09, vertexColors: true, transparent: true, opacity: 0.48, depthWrite: false })
  );
  points.name = "atmosphere";
  worldRoot.add(points);
}

function addRelays() {
  const positions = [[-18, -22], [0, -26], [18, -22]];
  positions.forEach(([x, z], index) => {
    const group = createRelayModel(index);
    group.position.set(x, 0, z);
    group.visible = false;
    dynamicRoot.add(group);
    relays.push({ id: `relay-${index + 1}`, group, x, z, health: 10, maxHealth: 10, radius: 1.25, active: false, pain: 0 });
  });
}

function addGate() {
  const group = new THREE.Group();
  const frameMat = material(0x15253b, { roughness: 0.5, metalness: 0.82 });
  const glowMat = new THREE.MeshBasicMaterial({
    color: palette.sui,
    transparent: true,
    opacity: 0.34,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const left = new THREE.Mesh(new THREE.BoxGeometry(0.7, 6, 1.2), frameMat);
  const right = left.clone();
  left.position.set(-5.4, 3, -7.5);
  right.position.set(5.4, 3, -7.5);
  const top = new THREE.Mesh(new THREE.BoxGeometry(11.5, 0.7, 1.2), frameMat);
  top.position.set(0, 5.65, -7.5);
  const field = new THREE.Mesh(new THREE.PlaneGeometry(10.2, 5.2, 12, 6), glowMat);
  field.position.set(0, 2.7, -7.45);
  group.add(left, right, top, field);
  worldRoot.add(group);
  const obstacle = { x: 0, z: -7.5, sx: 10.4, sz: 0.72, label: "SIGNAL GATE", dynamic: true };
  obstacles.push(obstacle);
  gate = { group, field, obstacle, open: false };
  staticLabels.push({ text: "SIGNAL GATE", x: 0, y: 6.35, z: -7.5, color: "#78deff", size: 12, alpha: 0.88 });
}

function addExtractionPad() {
  const group = new THREE.Group();
  const base = new THREE.Mesh(
    new THREE.CylinderGeometry(3.2, 3.45, 0.35, 10),
    material(0x12253c, { roughness: 0.54, metalness: 0.8 })
  );
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(2.6, 0.12, 8, 36),
    material(palette.sui, { emissive: true, emissiveIntensity: 2.6 })
  );
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.3;
  const beam = new THREE.Mesh(
    new THREE.CylinderGeometry(2.6, 2.6, 12, 20, 1, true),
    new THREE.MeshBasicMaterial({ color: palette.sui, transparent: true, opacity: 0.08, side: THREE.DoubleSide, depthWrite: false })
  );
  beam.position.y = 6;
  group.add(base, ring, beam);
  group.position.set(0, 0.18, -34);
  group.visible = false;
  dynamicRoot.add(group);
  extraction = { group, ring, beam, x: 0, z: -34, active: false };
}

function addBlock(x, z, sx, sy, sz, mat, label, collide = true) {
  worldRoot.add(createCover(x, z, sx, sy, sz, mat, label));
  if (collide) obstacles.push({ x, z, sx, sz, label });
}

function resetGame(startPlaying = false) {
  clearDynamicEntities();
  if (scoreDialog.open) scoreDialog.close();
  runScore = new RunScore();
  setPhase(startPlaying ? "playing" : "ready");
  state.stage = "breach";
  state.time = 0;
  state.visualTime = 0;
  state.stageTime = 0;
  state.stageBanner = startPlaying ? 2.6 : 0;
  state.score = 0;
  state.newBest = false;
  state.chain = 0;
  state.chainUntil = 0;
  state.peakChain = 0;
  state.coinFlash = 0;
  state.rickrollTimer = 0;
  selectWeapon("repeater");
  state.kills = 0;
  state.shots = 0;
  state.hits = 0;
  state.hitFlash = 0;
  state.hitMarker = 0;
  state.cameraShake = 0;
  clearInput();
  state.player.x = 0;
  state.player.z = 29;
  state.player.yaw = Math.PI;
  state.player.health = state.player.maxHealth;
  state.player.armor = state.player.maxArmor;
  state.player.shotCooldown = 0;
  state.player.rickrollCooldown = 0;
  state.player.pulseCooldown = 0;
  state.player.dashCooldown = 0;
  state.player.dashTime = 0;
  state.player.invulnerable = 0;
  state.player.recoil = 0;
  state.objective = startPlaying ? STAGE_COPY.breach.objective : "Click or press Space to begin the breach.";
  state.message = "";
  state.messageTimer = 0;
  closeGate();
  extraction.active = false;
  extraction.group.visible = false;
  relays.forEach((relay) => {
    relay.health = relay.maxHealth;
    relay.active = false;
    relay.pain = 0;
    relay.group.visible = false;
    relay.group.scale.setScalar(1);
  });
  if (boss?.group) dynamicRoot.remove(boss.group);
  boss = null;
  spawnBreachEncounter();
  updateCoinFrames(0);
  if (startPlaying) createPickup("sui", 0, 24, "opening");
  updatePlayerModel(1);
  updateCamera(1);
  render();
}

function clearDynamicEntities() {
  const collections = [state.enemies, state.enemyShots, state.tracers, state.particles, state.pickups, state.shockwaves];
  for (const collection of collections) {
    for (const item of collection) {
      if (item.group) dynamicRoot.remove(item.group);
      if (item.mesh) dynamicRoot.remove(item.mesh);
      if (item.line) disposeTracer(item);
    }
    collection.length = 0;
  }
}

function beginGame() {
  if (state.phase === "playing") return;
  audio.unlock();
  resetGame(true);
  canvas.focus();
  requestMouseLook();
}

function setPhase(phase) {
  state.phase = phase;
  shell.dataset.phase = phase;
  missionAction.hidden = phase === "playing";
  scoreAction.hidden = phase !== "victory" || TEST_MODE;
  shell.classList.toggle("can-share-score", !scoreAction.hidden);
  if (phase === "ready") missionAction.textContent = "Deploy";
  if (phase === "paused") missionAction.textContent = "Resume";
  if (phase === "gameover" || phase === "victory") missionAction.textContent = "Play again";
}

function clearInput() {
  state.keys.clear();
  state.triggerHeld = false;
  cancelTouchPads.forEach((cancel) => cancel());
}

function pauseGame() {
  if (state.phase !== "playing") return;
  clearInput();
  setPhase("paused");
  releaseMouseLook();
}

function resumeGame() {
  if (state.phase !== "paused") return;
  clearInput();
  setPhase("playing");
  canvas.focus();
  requestMouseLook();
}

function activateMissionAction() {
  if (state.phase === "paused") resumeGame();
  else beginGame();
}

function spawnBreachEncounter() {
  ENCOUNTERS.breach.forEach((kind, index) => spawnEnemy(ENEMY_TYPES[kind], OUTER_SPAWNS[index], `breach-${index}`));
}

function spawnRelayEncounter() {
  ENCOUNTERS.relay.forEach((kind, index) => spawnEnemy(ENEMY_TYPES[kind], INNER_SPAWNS[index], `relay-${index}`));
}

function spawnEnemy(kind, point, id = `${kind.id}-${Math.random().toString(36).slice(2)}`, reinforcement = false) {
  const group = createEnemyModel(kind);
  const enemy = {
    id,
    reinforcement,
    kind,
    group,
    x: point[0] + random(-0.6, 0.6),
    z: point[1] + random(-0.6, 0.6),
    y: kind.ai === "drone" ? 1.25 : 0,
    yaw: 0,
    radius: kind.ai === "drone" ? 0.58 : 0.7,
    health: kind.health,
    maxHealth: kind.health,
    cooldown: 0.8 + Math.random() * kind.fireRate,
    telegraph: 0,
    pain: 0,
    strafe: Math.random() < 0.5 ? -1 : 1,
    strafeTimer: random(0.7, 1.8),
    contactCooldown: 0,
    phase: random(0, TAU),
  };
  resolveWorldCollision(enemy, enemy.radius);
  updateEnemyModel(enemy, 0);
  dynamicRoot.add(group);
  state.enemies.push(enemy);
  return enemy;
}

function openGate() {
  if (!gate || gate.open) return;
  gate.open = true;
  gate.field.visible = false;
  const index = obstacles.indexOf(gate.obstacle);
  if (index !== -1) obstacles.splice(index, 1);
}

function closeGate() {
  if (!gate) return;
  gate.open = false;
  gate.field.visible = true;
  if (!obstacles.includes(gate.obstacle)) obstacles.push(gate.obstacle);
}

function advanceMission(nextStage) {
  awardScore("stage", nextStage);
  state.stage = nextStage;
  state.stageTime = 0;
  state.stageBanner = 2.8;
  state.objective = STAGE_COPY[nextStage]?.objective || state.objective;
  audio.stage();
  addShockwave(state.player.x, state.player.z, palette.sui, 10);
  if (nextStage === "relays") {
    openGate();
    createPickup("suitrump", 0, -4, "gate");
    relays.forEach((relay) => {
      relay.active = true;
      relay.group.visible = true;
    });
    spawnRelayEncounter();
    setMessage("SIGNAL GATE DISABLED", 2.4);
  } else if (nextStage === "boss") {
    clearStageEnemies();
    spawnBoss();
    setMessage("THE MAINSTREAM MEDIA MACHINE IS ONLINE", 3.2);
    audio.boss();
  } else if (nextStage === "extract") {
    extraction.active = true;
    extraction.group.visible = true;
    setMessage("PATH TO EXTRACTION OPEN", 2.8);
  }
}

function spawnBoss() {
  const group = createBossModel();
  group.position.set(0, 0, -29);
  dynamicRoot.add(group);
  boss = {
    id: "mainstream-media-machine",
    label: "MAINSTREAM MEDIA MACHINE",
    group,
    x: 0,
    z: -29,
    radius: 2.2,
    health: 64,
    maxHealth: 64,
    pain: 0,
    attackCooldown: 1.8,
    summonCooldown: 7.5,
    angle: 0,
    phase: 1,
  };
}

function clearStageEnemies() {
  for (const enemy of state.enemies) {
    burstParticles(enemy.x, enemy.kind.ai === "drone" ? 1.6 : 1.1, enemy.z, palette.sui, 10, 0.35, 3.5);
    dynamicRoot.remove(enemy.group);
  }
  state.enemies.length = 0;
  for (const shot of state.enemyShots) dynamicRoot.remove(shot.mesh);
  state.enemyShots.length = 0;
}

function updateMission(dt) {
  if (state.phase !== "playing") return;
  state.stageTime += dt;
  if (state.stage === "breach" && state.enemies.length === 0) {
    advanceMission("relays");
    return;
  }
  if (state.stage === "relays" && relays.every((relay) => !relay.active)) {
    advanceMission("boss");
    return;
  }
  if (state.stage === "boss" && !boss) {
    advanceMission("extract");
    return;
  }
  if (state.stage === "extract" && distance2(state.player.x, state.player.z, extraction.x, extraction.z) < 8.2) {
    completeMission();
  }
}

function completeMission() {
  if (state.phase !== "playing") return;
  awardScore("extract");
  state.newBest = state.score > state.bestScore;
  if (state.newBest) state.bestScore = state.score;
  setPhase("victory");
  state.objective = "Breach complete.";
  clearInput();
  releaseMouseLook();
  audio.victory();
  addShockwave(extraction.x, extraction.z, palette.gold, 22);
  burstParticles(extraction.x, 1.2, extraction.z, palette.sui, 90, 1.5, 9);
}

function awardScore(type, id, kind) {
  const points = runScore.record({ type, at: scoreTime(state.time), id, kind });
  state.score = runScore.score;
  return points;
}

function scoreStats() {
  return { health: Math.ceil(state.player.health), shots: state.shots, hits: state.hits, takedowns: state.kills, peakChain: state.peakChain };
}

function scoreReceipt() {
  const durationMs = scoreTime(state.time);
  const stats = scoreStats();
  return {
    game: SCORE_GAME, version: SCORE_VERSION, score: state.score, durationMs, stats,
    rank: runRank(state.score, durationMs, stats), events: runScore.events,
  };
}

function setupInput() {
  missionAction.addEventListener("click", activateMissionAction);
  bindScorePanel(scoreAction, scoreDialog, scoreReceipt);
  document.getElementById("pause-button").addEventListener("click", pauseGame);
  weaponButton.addEventListener("click", () => {
    selectWeapon(WEAPON_SLOTS[(WEAPON_SLOTS.indexOf(state.weapon) + 1) % WEAPON_SLOTS.length]);
  });
  window.addEventListener("keydown", (event) => {
    if (scoreDialog.open) return;
    const key = normalizeKey(event);
    if ((key === "space" || key === "enter") && event.target instanceof HTMLButtonElement) return;
    if (shouldBlockKey(key)) event.preventDefault();
    const wasHeld = state.keys.has(key);
    state.keys.add(key);

    if (key === "escape" && document.fullscreenElement) {
      document.exitFullscreen?.();
      pauseGame();
      return;
    }
    if (key === "escape" && !event.repeat) pauseGame();
    if (event.repeat && ["f", "v", "u", "p", "r", "enter"].includes(key)) return;
    if (key === "f") toggleFullscreen();
    if (key === "v") toggleCameraMode();
    const slot = WEAPON_SLOTS[Number(key) - 1];
    if (slot && !wasHeld) selectWeapon(slot);
    if (key === "u") setMessage(audio.toggle() ? "AUDIO ONLINE" : "AUDIO MUTED", 1.4);
    if (key === "g" && !wasHeld) cycleQuality();
    if ((key === "shift" || key === "q") && !wasHeld) dash();
    if (key === "e" && !wasHeld) pulse();

    if (key === "p" && state.phase === "playing") {
      pauseGame();
    } else if (key === "p" && state.phase === "paused") {
      resumeGame();
    }

    if (key === "r") {
      resetGame(state.phase !== "ready");
      return;
    }
    if ((key === "space" || key === "enter") && state.phase !== "playing") {
      if (!event.repeat) activateMissionAction();
      return;
    }
    if (key === "space") state.triggerHeld = true;
  });

  window.addEventListener("keyup", (event) => {
    const key = normalizeKey(event);
    state.keys.delete(key);
    if (key === "space") state.triggerHeld = false;
  });

  canvas.addEventListener("mousedown", (event) => {
    if (event.button === 2) {
      event.preventDefault();
      pulse();
      return;
    }
    if (event.button !== 0) return;
    canvas.focus();
    if (state.phase !== "playing") {
      activateMissionAction();
      return;
    }
    audio.unlock();
    requestMouseLook();
    state.triggerHeld = true;
    shoot();
  });
  window.addEventListener("mouseup", (event) => {
    if (event.button === 0) state.triggerHeld = false;
  });
  canvas.addEventListener("contextmenu", (event) => event.preventDefault());
  window.addEventListener("mousemove", (event) => {
    if (!isMouseLookLocked() || state.phase !== "playing") return;
    state.player.yaw = wrapAngle(state.player.yaw - event.movementX * 0.00215);
  });
  document.addEventListener("pointerlockchange", () => {
    const wasLocked = state.mouseLocked;
    state.mouseLocked = isMouseLookLocked();
    if (wasLocked && !state.mouseLocked) pauseGame();
  });
  document.addEventListener("pointerlockerror", () => {
    state.mouseLocked = false;
  });
  window.addEventListener("blur", pauseGame);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") pauseGame();
  });
  window.addEventListener("pagehide", pauseGame);
  window.addEventListener("resize", render);
  setupTouchControls();
}

function setupTouchControls() {
  setupTouchPad(document.getElementById("move-pad"), (x, y, active) => {
    state.touch.moveX = active ? x : 0;
    state.touch.moveY = active ? y : 0;
  });
  setupTouchPad(document.getElementById("aim-pad"), (x, y, active, deltaX = 0) => {
    state.touch.aimX = active ? x : 0;
    state.touch.aimY = active ? y : 0;
    state.touch.aiming = active;
    state.triggerHeld = active;
    if (active) state.player.yaw = wrapAngle(state.player.yaw - deltaX * 0.014);
  });
  const dashButton = document.getElementById("dash-button");
  const pulseButton = document.getElementById("pulse-button");
  dashButton.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    if (state.phase === "paused") return;
    audio.unlock();
    if (state.phase !== "playing") beginGame();
    dash();
  });
  pulseButton.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    if (state.phase === "paused") return;
    audio.unlock();
    if (state.phase !== "playing") beginGame();
    pulse();
  });
}

function setupTouchPad(element, onChange) {
  let pointerId = null;
  let lastX = 0;
  function cancel() {
    const capturedPointer = pointerId;
    pointerId = null;
    if (capturedPointer !== null && element.hasPointerCapture(capturedPointer)) element.releasePointerCapture(capturedPointer);
    element.style.setProperty("--stick-x", "0px");
    element.style.setProperty("--stick-y", "0px");
    onChange(0, 0, false, 0);
  }
  cancelTouchPads.push(cancel);
  element.addEventListener("pointerdown", (event) => {
    if (pointerId !== null || state.phase === "paused") return;
    event.preventDefault();
    audio.unlock();
    if (state.phase !== "playing") beginGame();
    pointerId = event.pointerId;
    lastX = event.clientX;
    element.setPointerCapture(pointerId);
    updateTouchPad(element, event, onChange, true, 0);
  });
  element.addEventListener("pointermove", (event) => {
    if (event.pointerId !== pointerId || state.phase !== "playing") return;
    event.preventDefault();
    const deltaX = event.clientX - lastX;
    lastX = event.clientX;
    updateTouchPad(element, event, onChange, true, deltaX);
  });
  const end = (event) => {
    if (event.pointerId === pointerId) cancel();
  };
  element.addEventListener("pointerup", end);
  element.addEventListener("pointercancel", end);
  element.addEventListener("lostpointercapture", end);
}

function updateTouchPad(element, event, onChange, active, deltaX) {
  const rect = element.getBoundingClientRect();
  const radius = rect.width * 0.36;
  let x = (event.clientX - (rect.left + rect.width / 2)) / radius;
  let y = (event.clientY - (rect.top + rect.height / 2)) / radius;
  const length = Math.hypot(x, y);
  if (length > 1) {
    x /= length;
    y /= length;
  }
  element.style.setProperty("--stick-x", `${x * radius}px`);
  element.style.setProperty("--stick-y", `${y * radius}px`);
  onChange(x, y, active, deltaX);
}

function normalizeKey(event) {
  if (event.code === "Space") return "space";
  if (event.code === "ArrowLeft") return "arrowleft";
  if (event.code === "ArrowRight") return "arrowright";
  if (event.code === "ArrowUp") return "arrowup";
  if (event.code === "ArrowDown") return "arrowdown";
  if (event.code === "ShiftLeft" || event.code === "ShiftRight") return "shift";
  return event.key.toLowerCase();
}

function shouldBlockKey(key) {
  return ["space", "w", "a", "s", "d", "arrowleft", "arrowright", "arrowup", "arrowdown", "shift", "q", "e", "f", "p", "r", "v", "g", "u", "enter", "1", "2", "3"].includes(key);
}

function isMouseLookLocked() {
  return document.pointerLockElement === canvas;
}

function requestMouseLook() {
  if (state.phase !== "playing" || isMouseLookLocked() || !canvas.requestPointerLock || matchMedia("(pointer: coarse)").matches) return;
  try {
    const promise = canvas.requestPointerLock();
    promise?.catch?.(() => { state.mouseLocked = false; });
  } catch {
    state.mouseLocked = false;
  }
}

function releaseMouseLook() {
  state.mouseLocked = false;
  if (isMouseLookLocked()) document.exitPointerLock?.();
}

function toggleFullscreen() {
  if (document.fullscreenElement) document.exitFullscreen?.();
  else shell.requestFullscreen?.({ navigationUI: "hide" }).catch?.(() => shell.requestFullscreen?.());
}

function toggleCameraMode() {
  state.cameraMode = state.cameraMode === "third" ? "first" : "third";
  setMessage(state.cameraMode === "third" ? "CHASE CAMERA" : "FIRST-PERSON AIM", 1.4);
}

function selectWeapon(id) {
  state.weapon = id;
  const weapon = WEAPONS[id];
  weaponButton.textContent = weapon.label;
  const parts = firstPersonWeapon.userData.parts;
  parts.barrel.material.color.setHex(weapon.color);
  parts.barrel.material.emissive.setHex(weapon.color);
  parts.barrel.scale.y = id === "riptide" ? 1.28 : id === "rickroll" ? 0.7 : 1;
}

function cycleQuality() {
  const next = QUALITY_LEVELS[(QUALITY_LEVELS.indexOf(state.quality) + 1) % QUALITY_LEVELS.length];
  applyQuality(next);
  if (!TEST_MODE) writeSetting(QUALITY_KEY, next);
  setMessage(`GRAPHICS: ${next.toUpperCase()}`, 1.4);
}

function readSetting(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeSetting(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // The current run still works when browser storage is disabled.
  }
}

function readQuality() {
  const requested = query.get("quality");
  if (QUALITY_LEVELS.includes(requested)) return requested;
  const saved = readSetting(QUALITY_KEY);
  return QUALITY_LEVELS.includes(saved) ? saved : "medium";
}

function applyQuality(level) {
  state.quality = level;
  renderer.shadowMap.enabled = level !== "low";
  bloomPass.strength = level === "high" ? 0.46 : level === "medium" ? 0.34 : 0.18;
  renderedWidth = 0;
  resize();
}

function dash() {
  if (state.phase !== "playing" || state.player.dashCooldown > 0) return;
  state.player.dashTime = 0.22;
  state.player.dashCooldown = 2.6;
  state.player.invulnerable = Math.max(state.player.invulnerable, 0.3);
  audio.dash();
  addShockwave(state.player.x, state.player.z, palette.sui, 4.6);
  burstParticles(state.player.x, 0.5, state.player.z, palette.sui, 22, 0.42, 5);
}

function pulse() {
  if (state.phase !== "playing" || state.player.pulseCooldown > 0) return;
  state.player.pulseCooldown = 8;
  state.cameraShake = Math.max(state.cameraShake, 0.36);
  audio.pulse();
  addShockwave(state.player.x, state.player.z, palette.sui, 13);
  burstParticles(state.player.x, 1.2, state.player.z, palette.sui, 58, 0.8, 8);
  for (const enemy of [...state.enemies]) {
    const distance = Math.sqrt(distance2(state.player.x, state.player.z, enemy.x, enemy.z));
    if (distance <= 10.5) damageTarget(enemy, distance < 5 ? 4 : 2, "enemy");
  }
  if (boss && Math.sqrt(distance2(state.player.x, state.player.z, boss.x, boss.z)) <= 12) damageTarget(boss, 3, "boss");
  for (const relay of relays) {
    if (relay.active && Math.sqrt(distance2(state.player.x, state.player.z, relay.x, relay.z)) <= 12) damageTarget(relay, 3, "relay");
  }
  for (const shot of state.enemyShots) dynamicRoot.remove(shot.mesh);
  state.enemyShots.length = 0;
  setMessage("PULSE", 1.1);
}

function shoot() {
  if (state.phase !== "playing" || state.player.shotCooldown > 0) return;
  const weapon = WEAPONS[state.weapon];
  const water = state.weapon === "riptide";
  const broadcast = state.weapon === "rickroll";
  if (broadcast && state.player.rickrollCooldown > 0) return;
  const forward = forwardOf(state.player.yaw);
  const right = rightOf(state.player.yaw);
  const sideOffset = state.cameraMode === "first" ? 0 : 0.42;
  const origin = new THREE.Vector3(
    state.player.x + forward.x * 0.9 + right.x * sideOffset,
    state.cameraMode === "first" ? 1.7 : 1.48,
    state.player.z + forward.z * 0.9 + right.z * sideOffset
  );
  const direction = new THREE.Vector3(forward.x, 0, forward.z).normalize();
  applyAimAssist(origin, direction);
  state.player.shotCooldown = weapon.interval;
  state.player.recoil = weapon.recoil;
  if (broadcast) state.player.rickrollCooldown = RICKROLL_COOLDOWN;
  state.shots += 1;
  if (water) audio.riptide();
  else audio.shoot();

  let maxDistance = 42;
  for (const box of obstacles) {
    const hit = rayRectDistance(origin.x, origin.z, direction.x, direction.z, box, maxDistance);
    if (hit !== null) maxDistance = Math.min(maxDistance, Math.max(0.5, hit - 0.08));
  }

  let target = null;
  let targetType = null;
  let targetDistance = maxDistance;
  const candidates = [
    ...state.enemies.map((entry) => ({ entry, type: "enemy" })),
    ...relays.filter((entry) => entry.active).map((entry) => ({ entry, type: "relay" })),
    ...(boss ? [{ entry: boss, type: "boss" }] : []),
  ];
  for (const candidate of candidates) {
    const entry = candidate.entry;
    const dx = entry.x - origin.x;
    const dz = entry.z - origin.z;
    const along = dx * direction.x + dz * direction.z;
    if (along < 0.4 || along > targetDistance) continue;
    const px = origin.x + direction.x * along;
    const pz = origin.z + direction.z * along;
    const miss = Math.hypot(entry.x - px, entry.z - pz);
    if (miss <= entry.radius + 0.3 && hasLineOfSight(origin.x, origin.z, entry.x, entry.z)) {
      target = entry;
      targetType = candidate.type;
      targetDistance = along;
    }
  }

  const end = tmpA.copy(origin).addScaledVector(direction, targetDistance);
  addTracer(origin, end, weapon.color, water);
  muzzleBurst(origin, direction, weapon.color);
  if (broadcast) {
    if (targetType === "enemy" && (target.kind.id === "bot" || target.kind.id === "farmer")) {
      state.hits += 1;
      state.rickrollTimer = 1.25;
      killEnemy(target);
      addShockwave(target.x, target.z, weapon.color, 4.8);
      audio.rickroll();
    } else {
      setMessage("RICKROLL  /  SCAM BOTS & RUG RUNNERS", 1.3);
    }
    return;
  }
  if (target) {
    state.hits += 1;
    state.hitMarker = 0.14;
    damageTarget(target, weapon.damage, targetType);
  }
  if (water) {
    for (const enemy of [...state.enemies]) {
      if (enemy === target || distance2(end.x, end.z, enemy.x, enemy.z) > 2.25 ** 2) continue;
      if (hasLineOfSight(end.x, end.z, enemy.x, enemy.z)) damageTarget(enemy, 1, "enemy");
    }
  }
}

function applyAimAssist(origin, direction) {
  let best = null;
  let bestScore = state.cameraMode === "first" && state.mouseLocked ? 0.994 : 0.94;
  const candidates = [...state.enemies, ...relays.filter((relay) => relay.active), ...(boss ? [boss] : [])];
  for (const target of candidates) {
    const toTarget = tmpB.set(target.x - origin.x, 0, target.z - origin.z);
    const distance = toTarget.length();
    if (distance > 32 || distance < 0.5 || !hasLineOfSight(origin.x, origin.z, target.x, target.z)) continue;
    toTarget.normalize();
    const alignment = direction.dot(toTarget);
    if (alignment > bestScore) {
      best = toTarget.clone();
      bestScore = alignment;
    }
  }
  if (best) direction.lerp(best, 0.34).normalize();
}

function damageTarget(target, amount, type) {
  target.health -= amount;
  target.pain = 0.18;
  state.hitMarker = 0.16;
  audio.hit();
  const hitY = type === "boss" ? 3.3 : type === "relay" ? 3.4 : target.kind?.ai === "drone" ? 1.8 : 1.45;
  burstParticles(target.x, hitY, target.z, type === "relay" ? palette.sui : type === "boss" ? palette.danger : target.kind.color, type === "boss" ? 18 : 10, 0.34, 3.5);
  if (target.health > 0) return;
  if (type === "enemy") killEnemy(target);
  else if (type === "relay") destroyRelay(target);
  else if (type === "boss") destroyBoss();
}

function killEnemy(enemy) {
  const index = state.enemies.indexOf(enemy);
  if (index === -1) return;
  state.enemies.splice(index, 1);
  dynamicRoot.remove(enemy.group);
  awardScore("enemy", enemy.id, enemy.kind.id);
  if (!enemy.reinforcement) {
    state.chain = runScore.chain;
    state.chainUntil = runScore.lastTakedownAt / 1000 + CHAIN_WINDOW;
    state.peakChain = runScore.peakChain;
  }
  state.kills += 1;
  audio.kill();
  burstParticles(enemy.x, enemy.kind.ai === "drone" ? 1.6 : 1.15, enemy.z, enemy.kind.color, 28, 0.62, 6);
  addShockwave(enemy.x, enemy.z, enemy.kind.color, 3.2);
  const dropRoll = Math.random();
  if (state.player.health < 55 && dropRoll < 0.45) createPickup("health", enemy.x, enemy.z);
  else if (state.player.armor < 25 && dropRoll < 0.6) createPickup("armor", enemy.x, enemy.z);
  else if (!enemy.reinforcement && dropRoll < 0.72) createPickup("sui", enemy.x, enemy.z, enemy.id);
}

function destroyRelay(relay) {
  relay.active = false;
  relay.group.visible = false;
  awardScore("relay", relay.id);
  state.cameraShake = Math.max(state.cameraShake, 0.5);
  burstParticles(relay.x, 2.6, relay.z, palette.sui, 54, 1.0, 8);
  addShockwave(relay.x, relay.z, palette.sui, 9);
  setMessage(`RELAY DESTROYED — ${relays.filter((entry) => entry.active).length} REMAIN`, 1.8);
}

function destroyBoss() {
  if (!boss) return;
  const { x, z, group } = boss;
  dynamicRoot.remove(group);
  boss = null;
  awardScore("boss");
  state.cameraShake = 0.9;
  burstParticles(x, 3.2, z, palette.danger, 110, 1.6, 11);
  burstParticles(x, 3.2, z, palette.gold, 80, 1.4, 9);
  addShockwave(x, z, palette.gold, 20);
  audio.kill();
}

function createPickup(kind, x, z, source) {
  const group = createPickupModel(kind);
  group.position.set(x, 1.05, z);
  dynamicRoot.add(group);
  const life = source === "opening" || source === "gate" ? Infinity : 18;
  state.pickups.push({ kind, group, x, z, source, radius: 0.8, life, phase: random(0, TAU) });
}

function fireEnemyShot(enemy, options = {}) {
  const dx = state.player.x - enemy.x;
  const dz = state.player.z - enemy.z;
  const length = Math.max(0.001, Math.hypot(dx, dz));
  const speed = options.speed || (enemy.kind.ai === "sniper" ? 18.5 : 13.5);
  const color = enemy.kind.color;
  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(enemy.kind.ai === "sniper" ? 0.16 : 0.2, 8, 6),
    material(color, { emissive: true, emissiveIntensity: 2.8 })
  );
  const shot = {
    mesh,
    x: enemy.x,
    y: enemy.kind.ai === "drone" ? 1.8 : 1.35,
    z: enemy.z,
    vx: (dx / length) * speed,
    vz: (dz / length) * speed,
    radius: 0.26,
    life: 3,
    damage: enemy.kind.damage,
    color,
  };
  mesh.position.set(shot.x, shot.y, shot.z);
  dynamicRoot.add(mesh);
  state.enemyShots.push(shot);
}

function fireBossVolley() {
  if (!boss) return;
  const count = boss.phase === 2 ? 14 : 10;
  const offset = boss.angle;
  for (let index = 0; index < count; index += 1) {
    const angle = offset + (index / count) * TAU;
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.25, 8, 6), material(palette.danger, { emissive: true, emissiveIntensity: 3 }));
    const shot = {
      mesh,
      x: boss.x + Math.sin(angle) * 2.1,
      y: 1.2,
      z: boss.z + Math.cos(angle) * 2.1,
      vx: Math.sin(angle) * (boss.phase === 2 ? 12.8 : 10.8),
      vz: Math.cos(angle) * (boss.phase === 2 ? 12.8 : 10.8),
      radius: 0.3,
      life: 3.4,
      damage: boss.phase === 2 ? 11 : 9,
      color: palette.danger,
    };
    mesh.position.set(shot.x, shot.y, shot.z);
    dynamicRoot.add(mesh);
    state.enemyShots.push(shot);
  }
  state.cameraShake = Math.max(state.cameraShake, 0.18);
  addShockwave(boss.x, boss.z, palette.danger, 6);
}

function update(dt) {
  state.visualTime += dt;
  state.hitFlash = Math.max(0, state.hitFlash - dt);
  state.hitMarker = Math.max(0, state.hitMarker - dt);
  state.cameraShake = Math.max(0, state.cameraShake - dt * 1.8);
  state.messageTimer = Math.max(0, state.messageTimer - dt);
  state.coinFlash = Math.max(0, state.coinFlash - dt);
  state.player.recoil = Math.max(0, state.player.recoil - dt * 1.8);

  animateWorld(dt);
  updateParticles(dt);
  updateTracers(dt);
  updateShockwaves(dt);
  if (state.phase !== "playing") {
    updatePlayerModel(dt);
    updateCamera(dt);
    return;
  }

  state.time += dt;
  state.stageBanner = Math.max(0, state.stageBanner - dt);
  state.player.shotCooldown = Math.max(0, state.player.shotCooldown - dt);
  state.player.rickrollCooldown = Math.max(0, state.player.rickrollCooldown - dt);
  state.rickrollTimer = Math.max(0, state.rickrollTimer - dt);
  state.player.pulseCooldown = Math.max(0, state.player.pulseCooldown - dt);
  state.player.dashCooldown = Math.max(0, state.player.dashCooldown - dt);
  state.player.dashTime = Math.max(0, state.player.dashTime - dt);
  state.player.invulnerable = Math.max(0, state.player.invulnerable - dt);

  updatePlayer(dt);
  if (state.triggerHeld) shoot();
  updateEnemies(dt);
  updateBoss(dt);
  updateEnemyShots(dt);
  updatePickups(dt);
  separateEnemies();
  updateMission(dt);
  updatePlayerModel(dt);
  updateCamera(dt);
}

function updatePlayer(dt) {
  const forward = forwardOf(state.player.yaw);
  const right = rightOf(state.player.yaw);
  const turn = (state.keys.has("arrowleft") ? 1 : 0) - (state.keys.has("arrowright") ? 1 : 0);
  state.player.yaw = wrapAngle(state.player.yaw + turn * dt * 2.15);
  let forwardInput = (state.keys.has("w") || state.keys.has("arrowup") ? 1 : 0) - (state.keys.has("s") || state.keys.has("arrowdown") ? 1 : 0);
  let strafeInput = (state.keys.has("d") ? 1 : 0) - (state.keys.has("a") ? 1 : 0);
  forwardInput += -state.touch.moveY;
  strafeInput += state.touch.moveX;
  const inputLength = Math.hypot(forwardInput, strafeInput);
  if (inputLength > 1) {
    forwardInput /= inputLength;
    strafeInput /= inputLength;
  }
  const dashMultiplier = state.player.dashTime > 0 ? 3.15 : 1;
  const speed = state.player.speed * dashMultiplier;
  state.player.x += (forward.x * forwardInput + right.x * strafeInput) * speed * dt;
  state.player.z += (forward.z * forwardInput + right.z * strafeInput) * speed * dt;
  state.player.moveAmount += (clamp(inputLength, 0, 1) - state.player.moveAmount) * (1 - Math.pow(0.0001, dt));
  resolveWorldCollision(state.player, state.player.radius);
}

function updateEnemies(dt) {
  for (const enemy of state.enemies) {
    enemy.cooldown -= dt;
    enemy.pain = Math.max(0, enemy.pain - dt);
    enemy.contactCooldown = Math.max(0, enemy.contactCooldown - dt);
    enemy.phase += dt;
    const dx = state.player.x - enemy.x;
    const dz = state.player.z - enemy.z;
    const distance = Math.max(0.001, Math.hypot(dx, dz));
    const nx = dx / distance;
    const nz = dz / distance;
    enemy.yaw = Math.atan2(nx, nz);

    if (enemy.kind.ai === "rusher") {
      if (distance > 1.7) {
        enemy.x += nx * enemy.kind.speed * dt;
        enemy.z += nz * enemy.kind.speed * dt;
      } else if (enemy.contactCooldown <= 0) {
        damagePlayer(enemy.kind.damage);
        enemy.contactCooldown = 1.05;
        enemy.x -= nx * 1.4;
        enemy.z -= nz * 1.4;
      }
    } else {
      enemy.strafeTimer -= dt;
      if (enemy.strafeTimer <= 0) {
        enemy.strafe *= -1;
        enemy.strafeTimer = random(0.8, 1.9);
      }
      const desired = enemy.kind.range;
      const approach = distance > desired + 2 ? 1 : distance < desired - 2 ? -0.75 : 0;
      const strafeAmount = hasLineOfSight(enemy.x, enemy.z, state.player.x, state.player.z) ? 0.42 : 0.12;
      enemy.x += (nx * approach + -nz * enemy.strafe * strafeAmount) * enemy.kind.speed * dt;
      enemy.z += (nz * approach + nx * enemy.strafe * strafeAmount) * enemy.kind.speed * dt;
      if (enemy.cooldown <= 0 && distance < enemy.kind.range + 7 && hasLineOfSight(enemy.x, enemy.z, state.player.x, state.player.z)) {
        fireEnemyShot(enemy);
        enemy.cooldown = enemy.kind.fireRate * random(0.85, 1.2);
      }
    }
    resolveWorldCollision(enemy, enemy.radius);
    updateEnemyModel(enemy, dt);
  }
}

function updateBoss(dt) {
  if (!boss) return;
  boss.pain = Math.max(0, boss.pain - dt);
  boss.attackCooldown -= dt;
  boss.summonCooldown -= dt;
  boss.angle += dt * (boss.phase === 2 ? 1.25 : 0.8);
  boss.phase = boss.health <= boss.maxHealth * 0.5 ? 2 : 1;
  const dx = state.player.x - boss.x;
  const dz = state.player.z - boss.z;
  const distance = Math.max(0.001, Math.hypot(dx, dz));
  if (distance > 13) {
    boss.x += (dx / distance) * dt * (boss.phase === 2 ? 1.8 : 1.25);
    boss.z += (dz / distance) * dt * (boss.phase === 2 ? 1.8 : 1.25);
  }
  if (boss.attackCooldown <= 0) {
    fireBossVolley();
    boss.attackCooldown = boss.phase === 2 ? 1.75 : 2.5;
  }
  if (boss.summonCooldown <= 0 && state.enemies.length < 7) {
    spawnEnemy(ENEMY_TYPES.bot, [boss.x + random(-6, 6), boss.z + random(4, 8)], undefined, true);
    if (boss.phase === 2 && state.enemies.length < 7) {
      spawnEnemy(ENEMY_TYPES.farmer, [boss.x + random(-7, 7), boss.z + random(3, 8)], undefined, true);
    }
    boss.summonCooldown = boss.phase === 2 ? 7.2 : 9.5;
  }
  boss.group.position.set(boss.x, Math.sin(state.visualTime * 1.6) * 0.3, boss.z);
  boss.group.rotation.y = boss.angle;
  const parts = boss.group.userData.parts;
  parts.ringA.rotation.z += dt * 1.8;
  parts.ringB.rotation.x += dt * 1.2;
  parts.eye.scale.setScalar(boss.pain > 0 ? 1.32 : 1 + Math.sin(state.visualTime * 5) * 0.08);
  boss.group.scale.setScalar(boss.pain > 0 ? 1.04 : 1);
}

function updateEnemyShots(dt) {
  for (let index = state.enemyShots.length - 1; index >= 0; index -= 1) {
    const shot = state.enemyShots[index];
    shot.x += shot.vx * dt;
    shot.z += shot.vz * dt;
    shot.life -= dt;
    shot.mesh.position.set(shot.x, shot.y, shot.z);
    shot.mesh.scale.setScalar(1 + Math.sin(state.visualTime * 18) * 0.12);
    if (distance2(shot.x, shot.z, state.player.x, state.player.z) <= (shot.radius + state.player.radius) ** 2) {
      damagePlayer(shot.damage);
      burstParticles(shot.x, shot.y, shot.z, shot.color, 12, 0.28, 3.2);
      removeShot(index);
      continue;
    }
    if (shot.life <= 0 || hitObstacle(shot.x, shot.z, shot.radius) || Math.abs(shot.x) > WORLD_HALF_X + 2 || Math.abs(shot.z) > WORLD_HALF_Z + 2) {
      removeShot(index);
    }
  }
}

function removeShot(index) {
  dynamicRoot.remove(state.enemyShots[index].mesh);
  state.enemyShots.splice(index, 1);
}

function updatePickups(dt) {
  updateCoinFrames(state.time);
  for (let index = state.pickups.length - 1; index >= 0; index -= 1) {
    const pickup = state.pickups[index];
    pickup.life -= dt;
    pickup.phase += dt * 2.8;
    pickup.group.rotation.y += dt * 2.5;
    pickup.group.position.y = 1.05 + Math.sin(pickup.phase) * 0.18;
    if (distance2(pickup.x, pickup.z, state.player.x, state.player.z) <= (pickup.radius + state.player.radius) ** 2) {
      collectPickup(pickup);
      dynamicRoot.remove(pickup.group);
      state.pickups.splice(index, 1);
      continue;
    }
    if (pickup.life <= 0) {
      dynamicRoot.remove(pickup.group);
      state.pickups.splice(index, 1);
    }
  }
}

function collectPickup(pickup) {
  const coin = COINS[pickup.kind];
  if (coin) {
    const points = awardScore("coin", pickup.source, pickup.kind);
    const prefix = points > 0 ? `+${points}  ·  ` : "";
    if (pickup.kind === "sui") {
      state.player.pulseCooldown = Math.max(0, state.player.pulseCooldown - 2.4);
      setMessage(`${prefix}PULSE CHARGED`, 1.6);
    } else {
      state.player.dashCooldown = 0;
      setMessage(`${prefix}DASH RECHARGED`, 1.6);
    }
    state.coinFlash = 0.75;
    audio.coinPickup(pickup.kind);
    burstParticles(pickup.x, 1, pickup.z, coin.color, 27, 0.5, 5.4);
    return;
  }
  if (pickup.kind === "health") {
    state.player.health = Math.min(state.player.maxHealth, state.player.health + 28);
    setMessage("HEALTH RESTORED", 1.2);
  } else if (pickup.kind === "armor") {
    state.player.armor = Math.min(state.player.maxArmor, state.player.armor + 24);
    setMessage("ARMOR BUFFER", 1.2);
  }
  audio.pickup();
  burstParticles(pickup.x, 1, pickup.z, pickup.kind === "health" ? palette.green : palette.sui, 20, 0.45, 4.5);
}

function damagePlayer(amount) {
  if (state.phase !== "playing" || state.player.invulnerable > 0) return;
  const absorbed = Math.min(state.player.armor, amount * 0.62);
  state.player.armor -= absorbed;
  state.player.health = Math.max(0, state.player.health - (amount - absorbed));
  state.player.invulnerable = 0.2;
  state.hitFlash = 0.22;
  state.cameraShake = Math.max(state.cameraShake, 0.3);
  audio.hurt();
  if (state.player.health <= 0) {
    setPhase("gameover");
    state.objective = "The FUD machine held the line.";
    clearInput();
    releaseMouseLook();
    burstParticles(state.player.x, 1.2, state.player.z, palette.danger, 55, 0.9, 7);
  }
}

function updatePlayerModel(dt) {
  playerModel.position.set(state.player.x, 0, state.player.z);
  playerModel.rotation.y = state.player.yaw;
  playerModel.visible = state.cameraMode !== "first" || state.phase === "ready";
  firstPersonWeapon.visible = state.cameraMode === "first" && ["playing", "paused"].includes(state.phase);
  firstPersonWeapon.position.set(0.44, -0.54 - state.player.recoil * 0.06, -0.84 + state.player.recoil * 0.32);
  firstPersonWeapon.rotation.x = state.player.recoil * 0.26;
  firstPersonWeapon.rotation.z = Math.sin(state.visualTime * 8) * state.player.moveAmount * 0.012;
  const weaponParts = firstPersonWeapon.userData.parts;
  weaponParts.barrel.material.emissiveIntensity = 1.35 + state.player.recoil * 4.8;
  weaponParts.sight.material.emissiveIntensity = 1.05 + Math.sin(state.visualTime * 5) * 0.2;
  const parts = playerModel.userData.parts;
  const stride = Math.sin(state.visualTime * 12) * state.player.moveAmount;
  parts.leftLeg.rotation.x = stride * 0.65;
  parts.rightLeg.rotation.x = -stride * 0.65;
  parts.leftArm.rotation.x = -stride * 0.42;
  parts.rightArm.rotation.x = stride * 0.28 - state.player.recoil * 1.5;
  parts.gunRoot.rotation.x = -state.player.recoil * 0.7;
  parts.halo.rotation.z += dt * 0.65;
  parts.halo.material.emissiveIntensity = 1.4 + Math.sin(state.visualTime * 4) * 0.7;
  parts.torso.position.y = 1.32 + Math.abs(stride) * 0.04 + (state.player.dashTime > 0 ? -0.1 : 0);
  const painScale = state.player.invulnerable > 0 && Math.floor(state.visualTime * 30) % 2 === 0 ? 0.93 : 1;
  playerModel.scale.setScalar(painScale);
}

function updateEnemyModel(enemy, dt) {
  enemy.group.position.set(enemy.x, enemy.y + (enemy.kind.ai === "drone" ? Math.sin(enemy.phase * 2.2) * 0.25 : 0), enemy.z);
  enemy.group.rotation.y = enemy.yaw;
  const parts = enemy.group.userData.parts;
  if (enemy.kind.ai === "drone") {
    parts.ring.rotation.z += dt * 2.6;
    parts.body.rotation.y += dt * 1.8;
  } else {
    const stride = Math.sin(enemy.phase * 8) * 0.55;
    parts.leftLeg.rotation.x = stride;
    parts.rightLeg.rotation.x = -stride;
    parts.leftArm.rotation.x = -stride * 0.42;
    parts.rightArm.rotation.x = stride * 0.28;
  }
  enemy.group.scale.setScalar(enemy.pain > 0 ? 1.08 : 1);
}

function updateCamera(dt) {
  const forward = forwardOf(state.player.yaw);
  const right = rightOf(state.player.yaw);
  const shake = state.cameraShake > 0 ? state.cameraShake * 0.22 : 0;
  let desiredEye;
  let desiredTarget;
  if (state.cameraMode === "first" && state.phase !== "ready") {
    desiredEye = tmpA.set(state.player.x - forward.x * state.player.recoil, 1.76 + state.player.recoil * 0.4, state.player.z - forward.z * state.player.recoil);
    desiredTarget = tmpB.set(state.player.x + forward.x * 12, 1.62, state.player.z + forward.z * 12);
  } else {
    desiredEye = tmpA.set(state.player.x - forward.x * 8.6 + right.x * 1.45, 5.15 + state.player.recoil * 1.2, state.player.z - forward.z * 8.6 + right.z * 1.45);
    clampCameraAgainstWorld(desiredEye);
    desiredTarget = tmpB.set(state.player.x + forward.x * 5.4, 1.55, state.player.z + forward.z * 5.4);
  }
  desiredEye.x += random(-shake, shake);
  desiredEye.y += random(-shake, shake);
  desiredEye.z += random(-shake, shake);
  const follow = state.phase === "playing" ? 1 - Math.pow(0.00003, dt) : 1;
  state.camera.eye.lerp(desiredEye, follow);
  state.camera.target.lerp(desiredTarget, follow);
  camera.position.copy(state.camera.eye);
  camera.lookAt(state.camera.target);
}

function clampCameraAgainstWorld(desired) {
  const dx = desired.x - state.player.x;
  const dz = desired.z - state.player.z;
  const length = Math.max(0.001, Math.hypot(dx, dz));
  const nx = dx / length;
  const nz = dz / length;
  let allowed = length;
  for (const box of obstacles) {
    const hit = rayRectDistance(state.player.x, state.player.z, nx, nz, box, length);
    if (hit !== null && hit > 0.3) allowed = Math.min(allowed, Math.max(1.6, hit - 0.45));
  }
  if (allowed < length) {
    desired.x = state.player.x + nx * allowed;
    desired.z = state.player.z + nz * allowed;
    desired.y = Math.max(2.5, desired.y * (allowed / length));
  }
}

function separateEnemies() {
  for (let i = 0; i < state.enemies.length; i += 1) {
    for (let j = i + 1; j < state.enemies.length; j += 1) {
      const a = state.enemies[i];
      const b = state.enemies[j];
      const dx = b.x - a.x;
      const dz = b.z - a.z;
      const distance = Math.max(0.001, Math.hypot(dx, dz));
      const minimum = a.radius + b.radius + 0.28;
      if (distance >= minimum) continue;
      const push = (minimum - distance) * 0.5;
      const nx = dx / distance;
      const nz = dz / distance;
      a.x -= nx * push;
      a.z -= nz * push;
      b.x += nx * push;
      b.z += nz * push;
      resolveWorldCollision(a, a.radius);
      resolveWorldCollision(b, b.radius);
    }
  }
}

function animateWorld(dt) {
  const atmosphere = worldRoot.getObjectByName("atmosphere");
  if (atmosphere) atmosphere.rotation.y += dt * 0.008;
  friendlyCreatures.forEach((creature, index) => {
    creature.scale.y = 1.26 + Math.sin(state.visualTime * 1.5 + index) * 0.018;
  });
  if (gate && !gate.open) gate.field.material.opacity = 0.25 + Math.sin(state.visualTime * 5) * 0.11;
  for (const relay of relays) {
    if (!relay.group.visible) continue;
    relay.pain = Math.max(0, relay.pain - dt);
    const parts = relay.group.userData.parts;
    parts.ringA.rotation.z += dt * 1.8;
    parts.ringB.rotation.x += dt * 1.3;
    parts.core.rotation.y += dt * 1.5;
    relay.group.scale.setScalar(relay.pain > 0 ? 1.06 : 1);
  }
  if (extraction?.active) {
    extraction.ring.rotation.z += dt * 1.4;
    extraction.beam.material.opacity = 0.07 + Math.sin(state.visualTime * 4) * 0.025;
  }
}

function muzzleBurst(origin, direction, color) {
  burstParticles(origin.x + direction.x, origin.y, origin.z + direction.z, color, 7, 0.18, 2.7);
}

function addTracer(start, end, color, water) {
  const geometry = new THREE.BufferGeometry().setFromPoints([start.clone(), end.clone()]);
  const line = new THREE.Line(
    geometry,
    new THREE.LineBasicMaterial({ color, transparent: true, opacity: 1, blending: THREE.AdditiveBlending })
  );
  dynamicRoot.add(line);
  const life = water ? 0.16 : 0.09;
  const tracer = { line, life, maxLife: life };
  if (water) {
    tracer.start = start.clone();
    tracer.end = end.clone();
    tracer.mesh = waterDrop.clone();
    tracer.mesh.position.copy(start);
    dynamicRoot.add(tracer.mesh);
  }
  state.tracers.push(tracer);
}

function disposeTracer(tracer) {
  tracer.line.geometry.dispose();
  tracer.line.material.dispose();
  dynamicRoot.remove(tracer.line);
}

function updateTracers(dt) {
  for (let index = state.tracers.length - 1; index >= 0; index -= 1) {
    const tracer = state.tracers[index];
    tracer.life -= dt;
    tracer.line.material.opacity = clamp(tracer.life / tracer.maxLife, 0, 1);
    if (tracer.mesh) tracer.mesh.position.lerpVectors(tracer.start, tracer.end, clamp(1 - tracer.life / tracer.maxLife, 0, 1));
    if (tracer.life <= 0) {
      if (tracer.mesh) {
        const { x, y, z } = tracer.end;
        burstParticles(x, y, z, WEAPONS.riptide.color, 24, 0.52, 5.4);
        addShockwave(x, z, WEAPONS.riptide.color, 4.1);
        dynamicRoot.remove(tracer.mesh);
      }
      disposeTracer(tracer);
      state.tracers.splice(index, 1);
    }
  }
}

function burstParticles(x, y, z, color, count, life, speed = 5) {
  const sharedMaterial = material(color, { emissive: true, emissiveIntensity: 1.8, transparent: true, opacity: 1 });
  for (let index = 0; index < count; index += 1) {
    const size = random(0.05, 0.18);
    const mesh = new THREE.Mesh(new THREE.TetrahedronGeometry(size, 0), sharedMaterial.clone());
    const angle = random(0, TAU);
    const horizontal = random(speed * 0.25, speed);
    const particle = {
      mesh,
      x: x + random(-0.2, 0.2),
      y: y + random(-0.2, 0.2),
      z: z + random(-0.2, 0.2),
      vx: Math.sin(angle) * horizontal,
      vy: random(1.2, speed),
      vz: Math.cos(angle) * horizontal,
      life: random(life * 0.55, life),
      maxLife: life,
    };
    mesh.position.set(particle.x, particle.y, particle.z);
    dynamicRoot.add(mesh);
    state.particles.push(particle);
  }
}

function updateParticles(dt) {
  for (let index = state.particles.length - 1; index >= 0; index -= 1) {
    const particle = state.particles[index];
    particle.x += particle.vx * dt;
    particle.y += particle.vy * dt;
    particle.z += particle.vz * dt;
    particle.vy -= 8.5 * dt;
    particle.life -= dt;
    particle.mesh.position.set(particle.x, particle.y, particle.z);
    particle.mesh.rotation.x += dt * 7;
    particle.mesh.rotation.y += dt * 6;
    const distance = particle.mesh.position.distanceToSquared(camera.position);
    const nearFade = clamp((distance - 0.36) / 2.2, 0, 1);
    particle.mesh.material.opacity = clamp(particle.life / particle.maxLife, 0, 1) * nearFade;
    if (particle.life <= 0 || particle.y < -0.2) {
      particle.mesh.geometry.dispose();
      particle.mesh.material.dispose();
      dynamicRoot.remove(particle.mesh);
      state.particles.splice(index, 1);
    }
  }
}

function addShockwave(x, z, color, maxScale) {
  const mesh = new THREE.Mesh(
    new THREE.RingGeometry(0.82, 1.02, 36),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.72, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false })
  );
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.set(x, 0.08, z);
  dynamicRoot.add(mesh);
  state.shockwaves.push({ mesh, life: 0.62, maxLife: 0.62, maxScale });
}

function updateShockwaves(dt) {
  for (let index = state.shockwaves.length - 1; index >= 0; index -= 1) {
    const wave = state.shockwaves[index];
    wave.life -= dt;
    const progress = 1 - clamp(wave.life / wave.maxLife, 0, 1);
    const scale = 1 + progress * wave.maxScale;
    wave.mesh.scale.setScalar(scale);
    wave.mesh.material.opacity = (1 - progress) * 0.72;
    if (wave.life <= 0) {
      wave.mesh.geometry.dispose();
      wave.mesh.material.dispose();
      dynamicRoot.remove(wave.mesh);
      state.shockwaves.splice(index, 1);
    }
  }
}

function setMessage(message, duration = 1.5) {
  state.message = message;
  state.messageTimer = duration;
}

function render() {
  resize();
  collectLabels();
  if (state.quality === "low") renderer.render(scene, camera);
  else composer.render();
  drawHud();
}

function resize() {
  const rect = shell.getBoundingClientRect();
  const width = Math.max(320, Math.round(rect.width));
  const height = Math.max(180, Math.round(rect.height));
  if (width === renderedWidth && height === renderedHeight) return;
  renderedWidth = width;
  renderedHeight = height;
  const maxDpr = state.quality === "high" ? 1.75 : state.quality === "medium" ? 1.35 : 1;
  const dpr = Math.min(window.devicePixelRatio || 1, maxDpr);
  renderer.setPixelRatio(dpr);
  renderer.setSize(width, height, false);
  composer.setPixelRatio(dpr);
  composer.setSize(width, height);
  hud.width = Math.round(width * dpr);
  hud.height = Math.round(height * dpr);
  camera.aspect = width / Math.max(1, height);
  camera.updateProjectionMatrix();
}

function collectLabels() {
  state.labels.length = 0;
  if (state.phase === "ready") return;
  const rect = shell.getBoundingClientRect();
  const compact = rect.width < 700 || rect.height < 390;
  if (!compact) {
    staticLabels
      .filter((label) => distance2(state.player.x, state.player.z, label.x, label.z) <= 19 * 19 || label.text === "SIGNAL GATE")
      .forEach(queueLabel);
  }
  state.enemies.forEach((enemy) => {
    const distance = Math.sqrt(distance2(state.player.x, state.player.z, enemy.x, enemy.z));
    if (distance > 19) return;
    queueLabel({ text: enemy.kind.label, x: enemy.x, y: enemy.kind.ai === "drone" ? 3.25 : 2.85, z: enemy.z, color: "#f4fbff", size: enemy.kind.label.length > 13 ? 10 : 12, alpha: 0.95 });
    if (distance <= 15) {
      queueLabel({ text: `${enemy.health}/${enemy.maxHealth}`, x: enemy.x, y: enemy.kind.ai === "drone" ? 2.85 : 2.48, z: enemy.z, color: enemy.kind.color === palette.danger ? "#ff6680" : "#71dcff", size: 9, alpha: 0.92 });
    }
  });
  relays.filter((relay) => relay.active).forEach((relay) => {
    queueLabel({ text: `RELAY ${relay.health}/${relay.maxHealth}`, x: relay.x, y: 4.85, z: relay.z, color: "#73ddff", size: 12, alpha: 1 });
  });
  state.pickups.forEach((pickup) => {
    const coin = COINS[pickup.kind];
    const label = coin?.name ?? pickup.kind;
    queueLabel({ text: label.toUpperCase(), x: pickup.x, y: coin ? 1.96 : 1.85, z: pickup.z, color: pickup.kind === "health" ? "#54efac" : pickup.kind === "sui" ? "#65d7ff" : "#ffd45f", size: 10, alpha: 0.92 });
  });
  if (extraction?.active) queueLabel({ text: "EXTRACT", x: extraction.x, y: 3.1, z: extraction.z, color: "#65d7ff", size: 15, alpha: 1 });
}

function queueLabel(label) {
  state.labels.push(label);
}

function drawHud() {
  const dpr = Math.min(window.devicePixelRatio || 1, state.quality === "high" ? 1.75 : state.quality === "medium" ? 1.35 : 1);
  const width = hud.width / dpr;
  const height = hud.height / dpr;
  ui.clearRect(0, 0, hud.width, hud.height);
  ui.save();
  ui.scale(dpr, dpr);

  if (["playing", "paused"].includes(state.phase)) {
    const compact = width < 700 || height < 390;
    drawStatusHud(width, height);
    if (!compact || state.stageBanner <= 0) drawObjective(width, height);
    drawCrosshair(width, height);
    if (state.stageBanner <= 0) drawLabels(width, height);
    drawRadar(width, height);
    if (boss) drawBossBar(width);
    if (state.stageBanner > 0) drawStageBanner(width, height);
    if (state.messageTimer > 0) drawMessage(width, height);
    if (state.phase === "playing" && state.rickrollTimer > 0) drawRickroll(width, height);
  }
  if (state.phase !== "ready" && state.hitFlash > 0) {
    const strength = clamp(state.hitFlash / 0.22, 0, 1);
    const gradient = ui.createRadialGradient(width / 2, height / 2, height * 0.1, width / 2, height / 2, height * 0.75);
    gradient.addColorStop(0, "rgba(255,40,80,0)");
    gradient.addColorStop(1, `rgba(255,40,80,${strength * 0.38})`);
    ui.fillStyle = gradient;
    ui.fillRect(0, 0, width, height);
  }
  if (state.phase === "ready") drawStartScreen(width, height);
  if (state.phase === "paused") drawCenterPanel(width, height, "PAUSED", "P resumes  /  R restarts");
  if (state.phase === "gameover") drawEndScreen(width, height, false);
  if (state.phase === "victory") drawEndScreen(width, height, true);
  ui.restore();
}

function drawStatusHud(width, height) {
  const compact = width < 700 || height < 390;
  const x = compact ? 10 : 18;
  const y = compact ? 9 : 16;
  const panelWidth = compact ? Math.min(245, width - 120) : Math.min(304, width * 0.28);
  const panelHeight = compact ? 62 : 92;
  drawPanel(x, y, panelWidth, panelHeight, 0.72, "#65d7ff");
  ui.fillStyle = "#f4fbff";
  ui.font = compact ? "900 12px system-ui" : "900 16px system-ui";
  const chainActive = state.chain > 1 && state.time < state.chainUntil;
  if (chainActive) ui.fillStyle = "#ffd45f";
  ui.fillText(chainActive ? `${state.chain} TAKEDOWNS  ×${chainMultiplier(state.chain)}` : "FUD BREACH", x + 14, y + (compact ? 20 : 25));
  ui.fillStyle = "#8fa9c3";
  ui.font = compact ? "700 9px system-ui" : "700 11px system-ui";
  const weaponLabel = WEAPONS[state.weapon].label;
  const recharge = state.weapon === "rickroll" && state.player.rickrollCooldown > 0 ? ` (${Math.ceil(state.player.rickrollCooldown)}s)` : "";
  if (state.coinFlash > 0) {
    ui.fillStyle = "#ffdc78";
    ui.font = compact ? "900 10px system-ui" : "900 13px system-ui";
  }
  ui.fillText(`${state.score.toLocaleString()} PTS  ·  ${weaponLabel}${recharge}`, x + 14, y + (compact ? 36 : 44), panelWidth - 28);

  const barWidth = panelWidth - (compact ? 28 : 86);
  const healthY = y + (compact ? 44 : 57);
  drawBar(x + 14, healthY, barWidth, compact ? 6 : 8, state.player.health / state.player.maxHealth, state.player.health > 35 ? "#65d7ff" : "#ff4268");
  if (chainActive) {
    drawBar(x + 14, y + panelHeight - 4, panelWidth - 28, 2, (state.chainUntil - state.time) / CHAIN_WINDOW, "#ffd45f");
  }
  if (!compact) {
    drawBar(x + 14, y + 72, barWidth, 6, state.player.armor / state.player.maxArmor, "#ffd45f");
    ui.fillStyle = "#9db4ca";
    ui.font = "800 9px system-ui";
    ui.fillText(`HP ${Math.ceil(state.player.health)}`, x + panelWidth - 61, y + 65);
    ui.fillText(`ARMOR ${Math.ceil(state.player.armor)}`, x + panelWidth - 61, y + 80);
  }

  const abilityWidth = compact ? 92 : 172;
  const abilityX = width - abilityWidth - (compact ? 10 : 18);
  drawPanel(abilityX, y, abilityWidth, panelHeight, 0.68, "#ffd45f");
  ui.fillStyle = "#ffd45f";
  ui.font = compact ? "900 9px system-ui" : "900 11px system-ui";
  ui.fillText(compact ? "DASH" : "DASH · SHIFT/Q", abilityX + 12, y + 21);
  drawBar(abilityX + 12, y + 29, abilityWidth - 24, 6, 1 - state.player.dashCooldown / 2.6, "#ffd45f");
  ui.fillStyle = "#65d7ff";
  ui.fillText(compact ? "PULSE" : "PULSE · E/RMB", abilityX + 12, y + (compact ? 47 : 55));
  drawBar(abilityX + 12, y + (compact ? 52 : 64), abilityWidth - 24, 6, 1 - state.player.pulseCooldown / 8, "#65d7ff");
  if (!compact) {
    ui.fillStyle = "#7f96ad";
    ui.font = "700 9px system-ui";
    ui.fillText(`G ${state.quality.toUpperCase()} · U AUDIO`, abilityX + 12, y + 85);
  }
}

function drawObjective(width, height) {
  if (state.phase === "ready") return;
  const compact = width < 700 || height < 390;
  const panelWidth = compact ? Math.min(width - 150, 385) : Math.min(510, width * 0.4);
  const x = (width - panelWidth) / 2;
  const y = compact ? height - 39 : 18;
  drawPanel(x, y, panelWidth, compact ? 30 : 44, 0.58, "#65d7ff");
  ui.textAlign = "center";
  ui.fillStyle = "#dcecff";
  ui.font = compact ? "800 10px system-ui" : "800 12px system-ui";
  const remaining = state.stage === "breach" ? state.enemies.length : relays.filter((relay) => relay.active).length;
  const objective = state.stage === "breach" ? `CLEAR THE PERIMETER   /   ${remaining} LEFT`
    : state.stage === "relays" ? `CUT THE SIGNAL   /   ${remaining} RELAYS LEFT`
    : state.stage === "boss" ? "TAKE OUT THE MACHINE"
    : "REACH EXTRACTION";
  ui.fillText(objective, width / 2, y + (compact ? 19 : 27), panelWidth - 16);
  ui.textAlign = "left";
}

function drawCrosshair(width, height) {
  if (state.phase !== "playing" || matchMedia("(pointer: coarse)").matches) return;
  const x = width / 2;
  const y = height / 2;
  const hit = state.hitMarker > 0;
  ui.strokeStyle = hit ? "#ffd45f" : "rgba(235,248,255,0.88)";
  ui.lineWidth = hit ? 2.6 : 1.5;
  ui.beginPath();
  ui.moveTo(x - 17, y); ui.lineTo(x - 6, y);
  ui.moveTo(x + 6, y); ui.lineTo(x + 17, y);
  ui.moveTo(x, y - 17); ui.lineTo(x, y - 6);
  ui.moveTo(x, y + 6); ui.lineTo(x, y + 17);
  ui.stroke();
  ui.strokeStyle = "rgba(101,215,255,0.72)";
  ui.beginPath();
  ui.arc(x, y, 23 + state.player.recoil * 46, 0, TAU);
  ui.stroke();
}

function drawLabels(width, height) {
  const labels = state.labels
    .map((label) => ({ ...label, screen: project(label.x, label.y, label.z, width, height) }))
    .filter((label) => label.screen?.visible)
    .sort((a, b) => b.screen.depth - a.screen.depth);
  ui.textAlign = "center";
  ui.textBaseline = "middle";
  for (const label of labels) {
    ui.globalAlpha = label.alpha;
    ui.font = `900 ${label.size}px system-ui`;
    ui.lineWidth = 4;
    ui.strokeStyle = "rgba(2,5,12,0.82)";
    ui.strokeText(label.text, label.screen.x, label.screen.y);
    ui.fillStyle = label.color;
    ui.fillText(label.text, label.screen.x, label.screen.y);
  }
  ui.globalAlpha = 1;
  ui.textAlign = "left";
  ui.textBaseline = "alphabetic";
}

function drawRadar(width, height) {
  if (matchMedia("(pointer: coarse)").matches) return;
  const compact = width < 700 || height < 390;
  const size = compact ? 84 : 128;
  const x = width - size - (compact ? 12 : 20);
  const y = height - size - (compact ? 12 : 20);
  drawPanel(x, y, size, size, 0.58, "#65d7ff");
  const scaleX = size / (WORLD_HALF_X * 2);
  const scaleZ = size / (WORLD_HALF_Z * 2);
  const mapX = (worldX) => x + size / 2 + worldX * scaleX;
  const mapY = (worldZ) => y + size / 2 + worldZ * scaleZ;
  ui.fillStyle = "rgba(101,215,255,0.12)";
  obstacles.forEach((box) => ui.fillRect(mapX(box.x - box.sx / 2), mapY(box.z - box.sz / 2), box.sx * scaleX, box.sz * scaleZ));
  state.enemies.forEach((enemy) => dot(mapX(enemy.x), mapY(enemy.z), compact ? 2.5 : 3.2, "#ff4268"));
  relays.filter((relay) => relay.active).forEach((relay) => dot(mapX(relay.x), mapY(relay.z), compact ? 3 : 4, "#a76bff"));
  if (boss) dot(mapX(boss.x), mapY(boss.z), compact ? 5 : 7, "#ff4268");
  if (extraction?.active) dot(mapX(extraction.x), mapY(extraction.z), compact ? 4 : 5, "#65d7ff");
  dot(mapX(state.player.x), mapY(state.player.z), compact ? 3.8 : 4.8, "#ffd45f");
  const forward = forwardOf(state.player.yaw);
  ui.strokeStyle = "#ffd45f";
  ui.lineWidth = 2;
  ui.beginPath();
  ui.moveTo(mapX(state.player.x), mapY(state.player.z));
  ui.lineTo(mapX(state.player.x) + forward.x * 11, mapY(state.player.z) + forward.z * 11);
  ui.stroke();
}

function drawBossBar(width) {
  if (!boss) return;
  const barWidth = Math.min(456, width * 0.54);
  const x = (width - barWidth) / 2;
  const y = 76;
  drawPanel(x, y, barWidth, 40, 0.7, "#ff4268");
  ui.textAlign = "center";
  ui.fillStyle = "#fff4f7";
  ui.font = "900 11px system-ui";
  ui.fillText(`MAINSTREAM MEDIA MACHINE  /  PHASE ${boss.phase}`, width / 2, y + 16, barWidth - 16);
  drawBar(x + 18, y + 24, barWidth - 36, 8, boss.health / boss.maxHealth, "#ff4268");
  ui.textAlign = "left";
}

function drawStageBanner(width, height) {
  if (state.phase !== "playing") return;
  const copy = STAGE_COPY[state.stage];
  if (!copy) return;
  const alpha = clamp(state.stageBanner / 0.6, 0, 1) * clamp((2.8 - state.stageBanner) / 0.35, 0, 1);
  ui.globalAlpha = alpha;
  const y = height * 0.29;
  ui.textAlign = "center";
  ui.fillStyle = "#ffd45f";
  ui.font = width < 700 ? "900 23px system-ui" : "900 38px system-ui";
  ui.fillText(copy.title, width / 2, y);
  ui.fillStyle = "#d6eaff";
  ui.font = width < 700 ? "800 11px system-ui" : "800 14px system-ui";
  ui.fillText(copy.objective, width / 2, y + 30);
  ui.globalAlpha = 1;
  ui.textAlign = "left";
}

function drawMessage(width, height) {
  const alpha = clamp(state.messageTimer / 0.3, 0, 1);
  ui.globalAlpha = alpha;
  ui.textAlign = "center";
  ui.fillStyle = "#65d7ff";
  ui.font = width < 700 ? "900 11px system-ui" : "900 14px system-ui";
  ui.fillText(state.message, width / 2, height * 0.73);
  ui.globalAlpha = 1;
  ui.textAlign = "left";
}

function drawStartScreen(width, height) {
  const compact = width < 700 || height < 390;
  const panelWidth = Math.min(compact ? width - 34 : 720, width - 34);
  const panelHeight = compact ? 188 : 350;
  const x = (width - panelWidth) / 2;
  const y = (height - panelHeight) / 2;
  drawPanel(x, y, panelWidth, panelHeight, 0.84, "#65d7ff");
  ui.textAlign = "center";
  ui.fillStyle = "#65d7ff";
  ui.font = compact ? "900 12px system-ui" : "900 16px system-ui";
  ui.fillText("SUITRUMP", width / 2, y + (compact ? 24 : 38));
  ui.fillStyle = "#ffd45f";
  ui.font = compact ? "900 28px system-ui" : "900 54px system-ui";
  ui.fillText("FUD BREACH", width / 2, y + (compact ? 59 : 102));
  ui.fillStyle = "#e8f4ff";
  ui.font = compact ? "800 11px system-ui" : "800 18px system-ui";
  ui.fillText("Cut the relays. Break the machine. Get out.", width / 2, y + (compact ? 83 : 142));
  ui.fillStyle = "#9eb5ca";
  ui.font = compact ? "700 9px system-ui" : "700 13px system-ui";
  if (!matchMedia("(pointer: coarse)").matches) {
    ui.fillText("WASD move · Mouse turns · Click/Space fires · Shift dash · E pulse", width / 2, y + (compact ? 110 : 196), panelWidth - 26);
    ui.fillText("1–3 weapons · V camera · P pause · G graphics", width / 2, y + (compact ? 128 : 222));
  } else {
    ui.fillText("Left stick moves · Right stick aims and fires", width / 2, y + (compact ? 110 : 196));
    ui.fillText("Dash · Pulse · Tap weapon name to switch", width / 2, y + (compact ? 128 : 222));
  }
  if (state.bestScore > 0 && !compact) {
    ui.fillStyle = "#ffd45f";
    ui.fillText(`SESSION BEST  ${state.bestScore.toLocaleString()}`, width / 2, y + 260);
  }
  ui.textAlign = "left";
}

function drawRickroll(width, height) {
  const panelWidth = Math.min(340, width - 50);
  const x = (width - panelWidth) / 2;
  const y = height * 0.66;
  ui.save();
  ui.globalAlpha = clamp(state.rickrollTimer * 3.5, 0, 1);
  drawPanel(x, y, panelWidth, 58, 0.92, "#ea97ff");
  const bars = ["#65d7ff", "#cb7bff", "#ff738f", "#ffdc78"];
  bars.forEach((color, index) => {
    ui.fillStyle = color;
    ui.fillRect(x + 16 + index * 6, y + 16, 4, 25);
  });
  ui.fillStyle = "#f4dcff";
  ui.font = "900 22px system-ui";
  ui.textAlign = "center";
  ui.fillText("RICKROLLED", width / 2 + 10, y + 37);
  ui.restore();
}

function drawEndScreen(width, height, won) {
  const panelWidth = Math.min(620, width - 42);
  const compact = width < 700 || height < 390;
  const panelHeight = Math.min(compact ? 245 : 330, height - 10);
  const x = (width - panelWidth) / 2;
  const y = (height - panelHeight) / 2;
  drawPanel(x, y, panelWidth, panelHeight, 0.86, won ? "#ffd45f" : "#ff4268");
  const accuracy = state.shots > 0 ? Math.round((state.hits / state.shots) * 100) : 0;
  const rank = calculateRank();
  ui.textAlign = "center";
  ui.fillStyle = won ? "#ffd45f" : "#ff6680";
  ui.font = compact ? "900 21px system-ui" : "900 37px system-ui";
  ui.fillText(won ? "BREACH COMPLETE" : "FUD HELD THE LINE", width / 2, y + panelHeight * 0.18);
  ui.fillStyle = "#65d7ff";
  ui.font = compact ? "900 27px system-ui" : "900 54px system-ui";
  ui.fillText(won ? rank : "SIGNAL LOST", width / 2, y + panelHeight * 0.38);
  ui.fillStyle = "#dbeaff";
  ui.font = compact ? "800 10px system-ui" : "800 15px system-ui";
  ui.fillText(`${state.score.toLocaleString()} PTS  ·  ${formatTime(state.time)}  ·  ${state.kills} KOs  ·  ${accuracy}% ACC`, width / 2, y + panelHeight * 0.54);
  ui.fillStyle = state.newBest ? "#ffd45f" : "#9fb6cb";
  const best = state.newBest ? "NEW SESSION BEST" : state.bestScore ? `SESSION BEST ${state.bestScore.toLocaleString()}` : "NO CLEARS YET";
  ui.fillText(`${best}  ·  LONGEST CHAIN ${state.peakChain}`, width / 2, y + panelHeight * 0.66);
  ui.textAlign = "left";
}

function drawCenterPanel(width, height, title, subtitle) {
  const panelWidth = Math.min(480, width - 42);
  const x = (width - panelWidth) / 2;
  const y = height / 2 - 78;
  drawPanel(x, y, panelWidth, 156, 0.84, "#65d7ff");
  ui.textAlign = "center";
  ui.fillStyle = "#ffd45f";
  ui.font = "900 30px system-ui";
  ui.fillText(title, width / 2, y + 62);
  ui.fillStyle = "#dbeaff";
  ui.font = "800 12px system-ui";
  ui.fillText(subtitle, width / 2, y + 98);
  ui.textAlign = "left";
}

function drawPanel(x, y, width, height, alpha, accent) {
  const cut = Math.min(10, height * 0.23);
  ui.save();
  ui.beginPath();
  ui.moveTo(x + cut, y);
  ui.lineTo(x + width, y);
  ui.lineTo(x + width, y + height - cut);
  ui.lineTo(x + width - cut, y + height);
  ui.lineTo(x, y + height);
  ui.lineTo(x, y + cut);
  ui.closePath();
  const gradient = ui.createLinearGradient(x, y, x + width, y + height);
  gradient.addColorStop(0, `rgba(8,14,26,${alpha})`);
  gradient.addColorStop(1, `rgba(14,27,46,${alpha * 0.9})`);
  ui.fillStyle = gradient;
  ui.fill();
  ui.strokeStyle = accent;
  ui.globalAlpha *= 0.4;
  ui.lineWidth = 1;
  ui.stroke();
  ui.fillStyle = accent;
  ui.fillRect(x + cut, y, Math.min(34, width - cut), 2);
  ui.restore();
}

function drawBar(x, y, width, height, amount, color) {
  ui.fillStyle = "rgba(255,255,255,0.1)";
  ui.fillRect(x, y, width, height);
  ui.fillStyle = color;
  ui.fillRect(x, y, width * clamp(amount, 0, 1), height);
}

function dot(x, y, radius, color) {
  ui.fillStyle = color;
  ui.beginPath();
  ui.arc(x, y, radius, 0, TAU);
  ui.fill();
}

function project(x, y, z, width, height) {
  tmpC.set(x, y, z).project(camera);
  if (tmpC.z < -1 || tmpC.z > 1) return null;
  return {
    x: (tmpC.x * 0.5 + 0.5) * width,
    y: (-tmpC.y * 0.5 + 0.5) * height,
    depth: tmpC.z,
    visible: tmpC.x > -1.15 && tmpC.x < 1.15 && tmpC.y > -1.15 && tmpC.y < 1.15,
  };
}

function calculateRank() {
  return runRank(state.score, scoreTime(state.time), scoreStats());
}

function formatTime(seconds) {
  const minutes = Math.floor(seconds / 60);
  const remainder = Math.floor(seconds % 60).toString().padStart(2, "0");
  return `${minutes}:${remainder}`;
}

function resolveWorldCollision(entity, radius) {
  entity.x = clamp(entity.x, -WORLD_HALF_X + radius, WORLD_HALF_X - radius);
  entity.z = clamp(entity.z, -WORLD_HALF_Z + radius, WORLD_HALF_Z - radius);
  for (const box of obstacles) resolveCircleBox(entity, radius, box);
}

function resolveCircleBox(entity, radius, box) {
  const minX = box.x - box.sx / 2 - radius;
  const maxX = box.x + box.sx / 2 + radius;
  const minZ = box.z - box.sz / 2 - radius;
  const maxZ = box.z + box.sz / 2 + radius;
  if (entity.x < minX || entity.x > maxX || entity.z < minZ || entity.z > maxZ) return;
  const distances = [
    { value: Math.abs(entity.x - minX), axis: "x", result: minX },
    { value: Math.abs(maxX - entity.x), axis: "x", result: maxX },
    { value: Math.abs(entity.z - minZ), axis: "z", result: minZ },
    { value: Math.abs(maxZ - entity.z), axis: "z", result: maxZ },
  ].sort((a, b) => a.value - b.value);
  entity[distances[0].axis] = distances[0].result;
}

function hitObstacle(x, z, radius) {
  return obstacles.some((box) => {
    const closestX = clamp(x, box.x - box.sx / 2, box.x + box.sx / 2);
    const closestZ = clamp(z, box.z - box.sz / 2, box.z + box.sz / 2);
    return distance2(x, z, closestX, closestZ) <= radius * radius;
  });
}

function hasLineOfSight(ax, az, bx, bz) {
  const dx = bx - ax;
  const dz = bz - az;
  const length = Math.hypot(dx, dz);
  if (length < 0.001) return true;
  const nx = dx / length;
  const nz = dz / length;
  return !obstacles.some((box) => {
    const hit = rayRectDistance(ax, az, nx, nz, box, length);
    return hit !== null && hit > 0.25 && hit < length - 0.25;
  });
}

function rayRectDistance(ox, oz, dx, dz, box, maxDistance) {
  const minX = box.x - box.sx / 2;
  const maxX = box.x + box.sx / 2;
  const minZ = box.z - box.sz / 2;
  const maxZ = box.z + box.sz / 2;
  let minimum = 0;
  let maximum = maxDistance;
  if (Math.abs(dx) < 0.0001) {
    if (ox < minX || ox > maxX) return null;
  } else {
    const first = (minX - ox) / dx;
    const second = (maxX - ox) / dx;
    minimum = Math.max(minimum, Math.min(first, second));
    maximum = Math.min(maximum, Math.max(first, second));
  }
  if (Math.abs(dz) < 0.0001) {
    if (oz < minZ || oz > maxZ) return null;
  } else {
    const first = (minZ - oz) / dz;
    const second = (maxZ - oz) / dz;
    minimum = Math.max(minimum, Math.min(first, second));
    maximum = Math.min(maximum, Math.max(first, second));
  }
  if (maximum >= Math.max(0, minimum)) return minimum >= 0 ? minimum : maximum;
  return null;
}

function frame(now) {
  const dt = clamp((now - lastFrame) / 1000, 0, 0.05);
  lastFrame = now;
  update(dt);
  render();
  requestAnimationFrame(frame);
}

window.advanceTime = (milliseconds) => {
  const steps = Math.max(1, Math.round(milliseconds / (STEP * 1000)));
  for (let index = 0; index < steps; index += 1) update(STEP);
  qaRenderCounter += 1;
  if (!QA_MODE || qaRenderCounter % 6 === 0) render();
};

window.render_game_to_text = () => {
  const forward = forwardOf(state.player.yaw);
  return JSON.stringify({
    coordinateSystem: "3D arena: x east/west, y up, z north/south; player starts south at positive z and advances north toward negative z",
    phase: state.phase,
    missionStage: state.stage,
    objective: state.objective,
    time: round(state.time),
    score: state.score,
    bestScore: state.bestScore,
    chain: {
      count: state.time < state.chainUntil ? state.chain : 0,
      multiplier: chainMultiplier(state.time < state.chainUntil ? state.chain : 0),
      peak: state.peakChain,
    },
    kills: state.kills,
    cameraMode: state.cameraMode,
    weapon: state.weapon,
    rickrollActive: state.rickrollTimer > 0,
    quality: state.quality,
    player: {
      x: round(state.player.x),
      z: round(state.player.z),
      yaw: round(state.player.yaw),
      forward: { x: round(forward.x), z: round(forward.z) },
      health: Math.ceil(state.player.health),
      armor: Math.ceil(state.player.armor),
      shotCooldown: round(state.player.shotCooldown),
      rickrollCooldown: round(state.player.rickrollCooldown),
      dashCooldown: round(state.player.dashCooldown),
      pulseCooldown: round(state.player.pulseCooldown),
    },
    enemies: state.enemies.slice(0, 12).map((enemy) => ({ id: enemy.id, kind: enemy.kind.id, x: round(enemy.x), z: round(enemy.z), health: enemy.health })),
    relays: relays.filter((relay) => relay.active).map((relay) => ({ id: relay.id, x: relay.x, z: relay.z, health: relay.health })),
    boss: boss ? {
      health: boss.health,
      maxHealth: boss.maxHealth,
      x: round(boss.x),
      z: round(boss.z),
      phase: boss.phase,
    } : null,
    extraction: extraction?.active ? { x: extraction.x, z: extraction.z } : null,
    enemyProjectiles: state.enemyShots.length,
    pickups: state.pickups.map((pickup) => ({ kind: pickup.kind, x: round(pickup.x), z: round(pickup.z) })),
  });
};

if (TEST_MODE) {
  window.__fudBreachTest = {
    clearEnemies() {
      for (const enemy of [...state.enemies]) {
        enemy.health = 1;
        damageTarget(enemy, 1, "enemy");
      }
      updateMission(STEP);
      render();
    },
    destroyRelays() {
      for (const relay of relays.filter((entry) => entry.active)) {
        relay.health = 1;
        damageTarget(relay, 1, "relay");
      }
      updateMission(STEP);
      render();
    },
    setBossHealth(health) {
      if (boss) boss.health = clamp(health, 1, boss.maxHealth);
      render();
    },
    defeatBoss() {
      if (boss) {
        boss.health = 1;
        damageTarget(boss, 1, "boss");
      }
      updateMission(STEP);
      render();
    },
    teleportToExtraction() {
      if (!extraction?.active) return;
      state.player.x = extraction.x;
      state.player.z = extraction.z;
      updateMission(STEP);
      updatePlayerModel(STEP);
      updateCamera(1);
      render();
    },
    teleport(x, z, yaw = state.player.yaw) {
      state.player.x = clamp(x, -WORLD_HALF_X + 1, WORLD_HALF_X - 1);
      state.player.z = clamp(z, -WORLD_HALF_Z + 1, WORLD_HALF_Z - 1);
      state.player.yaw = wrapAngle(yaw);
      resolveWorldCollision(state.player, state.player.radius);
      updatePlayerModel(STEP);
      updateCamera(1);
      render();
    },
    defeatPlayer() {
      state.player.invulnerable = 0;
      state.player.health = 1;
      damagePlayer(500);
      render();
    },
    pulse,
    dash,
    captureAudioStream() {
      return audio.captureStream();
    },
    preparePerfectVictory() {
      state.player.health = state.player.maxHealth;
      state.player.armor = state.player.maxArmor;
      state.hits = Math.max(1, state.shots);
      state.shots = state.hits;
      render();
    },
  };
}
