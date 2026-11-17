import * as THREE from "three";
import sheet from "./assets/sui-coin-animation.json";
import atlasUrl from "./assets/sui-coin-motion-sheet.png";
import portraitUrl from "./assets/suitrump-coin-portrait.png";

// Face centers and horizontal radii in the original spinning atlas.
const facePositions = [
  [0.50, 0.35], [0.54, 0.14], [0.53, 0.30], [0.49, 0.35], [0.44, 0.12], [0.43, 0.13],
  [0.48, 0.35], [0.54, 0.12], [0.51, 0.34], [0.49, 0.35], [0.43, 0.13], [0.51, 0.34],
  [0.49, 0.35], [0.55, 0.12], [0.51, 0.34], [0.49, 0.35], [0.43, 0.13], [0.46, 0.05],
];
const textures = [];
const material = () => new THREE.SpriteMaterial({ transparent: true, depthWrite: false, toneMapped: false, visible: false });
const coinMaterials = { sui: material(), suitrump: material() };
let frame = 0;

const loader = new THREE.TextureLoader();
const atlas = loader.loadAsync(atlasUrl);
atlas.then((original) => {
  loadMaterialTexture(coinMaterials.sui, original);
}).catch((error) => console.error("SUI coin art failed to load:", error));

Promise.all([atlas, loader.loadAsync(portraitUrl)]).then(([original, portrait]) => {
  const decorated = paintCoinFaces(original.image, portrait.image);
  loadMaterialTexture(coinMaterials.suitrump, new THREE.CanvasTexture(decorated));
}).catch((error) => console.error("SuiTrump coin art failed to load:", error));

export function createCoinModel(kind) {
  const coin = new THREE.Sprite(coinMaterials[kind]);
  const height = 1.52;
  coin.scale.set(height * sheet.frameWidth / sheet.frameHeight, height, 1);
  coin.renderOrder = 4;
  return coin;
}

export function updateCoinFrames(seconds) {
  const spin = sheet.animations.spin;
  const next = spin[Math.floor(seconds * sheet.frameRate) % spin.length];
  if (next === frame) return;
  frame = next;
  textures.forEach(positionFrame);
}

function loadMaterialTexture(coinMaterial, texture) {
  texture.colorSpace = THREE.SRGBColorSpace;
  const columns = texture.image.width / sheet.frameWidth;
  const rows = texture.image.height / sheet.frameHeight;
  texture.repeat.set(1 / columns, 1 / rows);
  const entry = { texture, columns, rows };
  textures.push(entry);
  positionFrame(entry);
  coinMaterial.map = texture;
  coinMaterial.visible = true;
  coinMaterial.needsUpdate = true;
}

function positionFrame({ texture, columns, rows }) {
  texture.offset.set((frame % columns) / columns, 1 - (Math.floor(frame / columns) + 1) / rows);
}

function paintCoinFaces(original, portrait) {
  const canvas = document.createElement("canvas");
  canvas.width = original.width;
  canvas.height = original.height;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(original, 0, 0);
  const columns = canvas.width / sheet.frameWidth;
  const faceY = 0.50 * sheet.frameHeight;
  const faceHeight = 0.325 * sheet.frameHeight;
  facePositions.forEach(([center, radius], index) => {
    const x = ((index % columns) + center) * sheet.frameWidth;
    const y = Math.floor(index / columns) * sheet.frameHeight + faceY;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(radius * sheet.frameWidth, faceHeight);
    ctx.beginPath();
    ctx.ellipse(0, 0, 1, 1, 0, 0, Math.PI * 2);
    ctx.clip();
    const finish = ctx.createLinearGradient(0, -1, 0, 1);
    finish.addColorStop(0, "#247bae");
    finish.addColorStop(0.34, "#174677");
    finish.addColorStop(1, "#071b45");
    ctx.fillStyle = finish;
    ctx.fillRect(-1, -1, 2, 2);
    ctx.drawImage(portrait, -1.06, -1.03, 2.12, 2.06);
    ctx.restore();
  });
  return canvas;
}
