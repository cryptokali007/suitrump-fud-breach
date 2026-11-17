import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { WORLD_HALF_X, WORLD_HALF_Z } from "./config.js";

function paintTexture(width, height, paint) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  paint(canvas.getContext("2d"), width, height);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function seededRandom(seed) {
  let value = seed;
  return () => {
    value = (Math.imul(value, 1664525) + 1013904223) >>> 0;
    return value / 4294967296;
  };
}

export function createNightSky() {
  const noise = seededRandom(93);
  const texture = paintTexture(1024, 512, (ctx, w, h) => {
    const gradient = ctx.createLinearGradient(0, 0, 0, h);
    gradient.addColorStop(0, "#030717");
    gradient.addColorStop(0.28, "#0b1833");
    gradient.addColorStop(0.47, "#263d5d");
    gradient.addColorStop(0.52, "#35445e");
    gradient.addColorStop(0.65, "#142539");
    gradient.addColorStop(1, "#07111e");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 280; i += 1) {
      ctx.fillStyle = `rgba(182,222,255,${0.15 + noise() * 0.5})`;
      const size = noise() < 0.96 ? 1 : 2;
      ctx.fillRect(noise() * w, noise() * h * 0.48, size, size);
    }
  });
  texture.mapping = THREE.EquirectangularReflectionMapping;
  return texture;
}

export function createArenaFloor(maxAnisotropy) {
  const noise = seededRandom(24);
  const map = paintTexture(256, 256, (ctx, w, h) => {
    const steel = ctx.createLinearGradient(0, 0, w, h);
    steel.addColorStop(0, "#3a4b61");
    steel.addColorStop(1, "#27374b");
    ctx.fillStyle = "#172431";
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = steel;
    ctx.fillRect(3, 3, w - 6, h - 6);
    ctx.strokeStyle = "#51647a";
    ctx.strokeRect(4.5, 4.5, w - 9, h - 9);
    for (let i = 0; i < 960; i += 1) {
      ctx.fillStyle = i % 2 === 0 ? "rgba(175,206,230,0.055)" : "rgba(4,10,20,0.075)";
      ctx.fillRect(7 + noise() * 232, 7 + noise() * 242, 4 + noise() * 12, 1);
    }
    for (const x of [15, w - 15]) {
      for (const y of [15, h - 15]) {
        ctx.fillStyle = "#182332";
        ctx.beginPath();
        ctx.arc(x, y, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#69849b";
        ctx.fillRect(x - 2, y, 4, 1);
      }
    }
  });
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  map.repeat.set(20, 26);
  map.anisotropy = Math.min(4, maxAnisotropy);
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(WORLD_HALF_X * 2, WORLD_HALF_Z * 2),
    new THREE.MeshStandardMaterial({ map, roughness: 0.66, metalness: 0.25 }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  return floor;
}

export function createCover(x, z, width, height, depth, facade, label) {
  const group = new THREE.Group();
  group.position.set(x, 0, z);
  const block = new THREE.Mesh(new RoundedBoxGeometry(width, height, depth, 2, 0.15), facade);
  block.position.y = height / 2;
  block.castShadow = true;
  block.receiveShadow = true;
  group.add(block);

  if (!label) return group;
  const trim = new THREE.MeshStandardMaterial({
    color: 0x536b83, roughness: 0.49, metalness: 0.36, emissive: 0x1b344b, emissiveIntensity: 0.38,
  });
  const frame = new THREE.Mesh(new RoundedBoxGeometry(width + 0.04, 0.2, depth + 0.04, 2, 0.08), trim);
  frame.position.y = height - 0.21;
  group.add(frame);

  const signMap = paintTexture(512, 192, (ctx, w, h) => {
    ctx.fillStyle = "#101c2c";
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = "#98d9f4";
    ctx.fillRect(18, 30, 4, 132);
    ctx.font = "900 47px system-ui";
    ctx.textBaseline = "middle";
    ctx.fillText(label, 45, 90, w - 62);
    ctx.fillStyle = "#537590";
    ctx.fillRect(45, 135, w - 75, 2);
    ctx.fillStyle = "#ffb361";
    for (let i = 0; i < 4; i += 1) ctx.fillRect(w - 103 + i * 19, 151, 11, 5);
  });
  const sign = new THREE.Mesh(
    new THREE.PlaneGeometry(width * 0.68, Math.min(1.2, height * 0.45)),
    new THREE.MeshBasicMaterial({ map: signMap }),
  );
  sign.position.set(0, height * 0.58, depth / 2 + 0.018);
  const reverse = sign.clone();
  reverse.rotation.y = Math.PI;
  reverse.position.z *= -1;
  group.add(sign, reverse);
  return group;
}

export function addBackdrop(root) {
  const noise = seededRandom(308);
  const city = [];
  const windows = [];
  const colors = [0x22334a, 0x283046, 0x19263b, 0x192a42];
  const lightColors = [0x8fcfff, 0x547da8, 0xb38cff, 0xf8a66f];
  for (let row = 0; row < 2; row += 1) {
    for (let i = -8; i <= 8; i += 1) {
      const x = i * (row === 0 ? 7.6 : 10) + 4 * noise();
      const z = -49 - row * 16 - 8 * noise();
      const width = 3.8 + 4 * noise();
      const height = 7 + noise() * (row === 0 ? 18 : 26);
      const depth = 4 + 5 * noise();
      city.push([x, height / 2 - 1, z, width, height, depth, colors[(i + 8 + row) % colors.length]]);
      if (row === 1) continue;
      for (let y = 3.8; y < height - 2; y += 2.3) {
        for (let dx = -width / 2 + 0.6; dx < width / 2 - 0.45; dx += 1.12) {
          if (noise() > 0.69) continue;
          windows.push([x + dx, y, z + depth / 2 + 0.02, 0.55, 0.2, 0.04, lightColors[Math.floor(noise() * lightColors.length)]]);
        }
      }
    }
  }
  const transform = new THREE.Object3D();
  const tint = new THREE.Color();
  const geometry = new THREE.BoxGeometry(1, 1, 1);
  for (const [entries, material] of [
    [city, new THREE.MeshStandardMaterial({ roughness: 0.86, metalness: 0.14 })],
    [windows, new THREE.MeshBasicMaterial()],
  ]) {
    const batch = new THREE.InstancedMesh(geometry, material, entries.length);
    entries.forEach(([x, y, z, w, h, d, color], i) => {
      transform.position.set(x, y, z);
      transform.scale.set(w, h, d);
      transform.updateMatrix();
      batch.setMatrixAt(i, transform.matrix);
      batch.setColorAt(i, tint.setHex(color));
    });
    root.add(batch);
  }
}
