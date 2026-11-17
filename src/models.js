import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { palette } from "./config.js";
import pulseChargeUrl from "./assets/pulse-charge.webp?inline";

let pulseChargeFace;

export function material(color, options = {}) {
  const mat = new THREE.MeshStandardMaterial({
    color,
    roughness: options.roughness ?? 0.72,
    metalness: options.metalness ?? 0.28,
    flatShading: options.flatShading ?? true,
    transparent: options.transparent ?? false,
    opacity: options.opacity ?? 1,
  });
  if (options.emissive) {
    mat.emissive = new THREE.Color(options.emissive === true ? color : options.emissive);
    mat.emissiveIntensity = options.emissiveIntensity ?? 1;
  }
  return mat;
}

function mesh(geometry, mat, x = 0, y = 0, z = 0) {
  const result = new THREE.Mesh(geometry, mat);
  result.position.set(x, y, z);
  result.castShadow = true;
  result.receiveShadow = true;
  return result;
}

function box(mat, size, position) {
  return mesh(new THREE.BoxGeometry(size[0], size[1], size[2]), mat, position[0], position[1], position[2]);
}

function beveledBox(mat, [width, height, depth], [x, y, z], radius = 0.06) {
  return mesh(new RoundedBoxGeometry(width, height, depth, 2, radius), mat, x, y, z);
}

function capsuleLike(mat, radius, height, position, segments = 8) {
  return mesh(new THREE.CapsuleGeometry(radius, height, 4, segments), mat, position[0], position[1], position[2]);
}

export function createPlayerModel() {
  const group = new THREE.Group();
  const suit = material(0x174380, { roughness: 0.59, metalness: 0.22, flatShading: false });
  const blue = material(palette.playerBlue, { roughness: 0.44, metalness: 0.08, flatShading: false });
  const white = material(palette.white, { roughness: 0.65, metalness: 0.12 });
  const tie = material(palette.playerTie, { emissive: true, emissiveIntensity: 0.18 });
  const hair = material(palette.playerHair, { roughness: 0.52, metalness: 0.13, flatShading: false });
  const gold = material(palette.gold, { emissive: true, emissiveIntensity: 0.32 });
  const glow = material(palette.sui, { emissive: true, emissiveIntensity: 1.15 });
  const lapel = material(0x08182f, { roughness: 0.58, metalness: 0.21 });

  const torso = beveledBox(suit, [1.01, 1.1, 0.58], [0, 1.32, 0], 0.12);
  const shirt = beveledBox(white, [0.38, 0.74, 0.08], [0, 0.05, 0.296], 0.025);
  const neckTie = beveledBox(tie, [0.11, 0.55, 0.07], [0, 0.03, 0.341], 0.021);
  const backplate = beveledBox(lapel, [0.61, 0.42, 0.08], [0, 0.13, -0.29], 0.04);
  const head = beveledBox(blue, [0.69, 0.67, 0.63], [0, 2.18, 0], 0.16);
  const nose = beveledBox(blue, [0.17, 0.18, 0.19], [0, 2.16, 0.34], 0.065);
  torso.add(shirt, neckTie, backplate);
  for (const side of [-1, 1]) {
    const collar = beveledBox(lapel, [0.1, 0.53, 0.06], [side * 0.22, 0.25, 0.281], 0.02);
    collar.rotation.z = side * -0.3;
    const backLight = box(glow, [0.032, 0.25, 0.025], [side * 0.24, 0.13, -0.342]);
    torso.add(collar, backLight);
    group.add(beveledBox(lapel, [0.14, 0.052, 0.055], [side * 0.14, 2.27, 0.314], 0.025));
  }
  group.add(torso, head, nose);

  const hairShape = new THREE.SphereGeometry(1, 14, 8);
  for (let index = 0; index < 3; index += 1) {
    const sweep = mesh(hairShape, hair, -0.035 - index * 0.045, 2.53 + index * 0.058, -0.07 + index * 0.15);
    sweep.scale.set(0.402 - index * 0.018, 0.13 + index * 0.019, 0.29 - index * 0.03);
    sweep.rotation.z = -0.18;
    group.add(sweep);
  }

  const leftArm = capsuleLike(suit, 0.17, 0.62, [-0.6, 1.34, 0]);
  const rightArm = capsuleLike(suit, 0.17, 0.62, [0.6, 1.34, 0]);
  const leftLeg = capsuleLike(suit, 0.19, 0.60, [-0.25, 0.46, 0]);
  const rightLeg = capsuleLike(suit, 0.19, 0.60, [0.25, 0.46, 0]);
  for (const arm of [leftArm, rightArm]) arm.add(beveledBox(blue, [0.29, 0.21, 0.28], [0, -0.41, 0.045]));
  for (const leg of [leftLeg, rightLeg]) leg.add(beveledBox(lapel, [0.36, 0.23, 0.51], [0, -0.31, 0.10]));
  group.add(leftArm, rightArm, leftLeg, rightLeg);

  const gunRoot = new THREE.Group();
  gunRoot.position.set(0.5, 1.45, 0.35);
  const gunBody = beveledBox(lapel, [0.31, 0.31, 0.95], [0, 0, 0.35]);
  const gunRail = beveledBox(gold, [0.22, 0.055, 0.72], [0, 0.16, 0.35], 0.02);
  const gunCore = mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.62, 10), glow, 0, 0, 0.98);
  gunCore.rotation.x = Math.PI / 2;
  gunRoot.add(gunBody, gunRail, gunCore);
  group.add(gunRoot);

  const halo = mesh(new THREE.TorusGeometry(0.48, 0.026, 8, 36, Math.PI * 1.72), glow.clone(), 0, 2.94, 0);
  halo.castShadow = false;
  halo.rotation.x = Math.PI / 2;
  group.add(halo);

  group.userData.parts = { leftArm, rightArm, leftLeg, rightLeg, gunRoot, halo, torso };
  group.userData.baseY = 0;
  return group;
}

export function createFirstPersonWeapon() {
  const group = new THREE.Group();
  const suit = material(palette.playerSuit, { roughness: 0.6, metalness: 0.42 });
  const blue = material(palette.playerBlue, { roughness: 0.5, metalness: 0.28 });
  const alloy = material(0x324258, { roughness: 0.53, metalness: 0.48, flatShading: false });
  const inlay = material(0x255c85, { roughness: 0.58, metalness: 0.3, emissive: 0x092237, emissiveIntensity: 0.52 });
  const glow = material(palette.sui, { emissive: true, emissiveIntensity: 0.9 });
  const leftHand = beveledBox(blue, [0.24, 0.24, 0.38], [-0.22, -0.16, -0.16]);
  const rightHand = beveledBox(blue, [0.24, 0.24, 0.38], [0.22, -0.16, -0.16]);
  const leftSleeve = beveledBox(suit, [0.3, 0.34, 0.56], [-0.3, -0.25, 0.14]);
  const rightSleeve = beveledBox(suit, [0.3, 0.34, 0.56], [0.3, -0.25, 0.14]);
  const body = beveledBox(alloy, [0.4, 0.3, 1.1], [0, -0.02, -0.55], 0.065);
  const sideRail = beveledBox(inlay, [0.43, 0.11, 0.75], [0, -0.04, -0.57], 0.035);
  const barrel = mesh(new THREE.CylinderGeometry(0.05, 0.08, 0.65, 12), glow, 0, 0.04, -1.28);
  barrel.rotation.x = Math.PI / 2;
  const sight = beveledBox(glow, [0.035, 0.04, 0.12], [0, 0.15, -0.77], 0.012);
  group.add(leftSleeve, rightSleeve, leftHand, rightHand, body, sideRail, barrel, sight);
  group.position.set(0.44, -0.54, -0.84);
  group.rotation.y = -0.08;
  group.scale.setScalar(0.67);
  group.userData.parts = { body, barrel, sight, leftHand, rightHand };
  return group;
}

export function createEnemyModel(kind) {
  const group = new THREE.Group();
  const primary = material(kind.color, { roughness: 0.62, metalness: kind.ai === "drone" ? 0.7 : 0.34 });
  const accent = material(kind.accent, { emissive: true, emissiveIntensity: kind.ai === "drone" ? 1.6 : 0.28 });
  const dark = material(0x090d16, { roughness: 0.82, metalness: 0.55 });
  const skin = material(palette.enemySkin, { roughness: 0.72, metalness: 0.12 });

  if (kind.ai === "drone") {
    const body = mesh(new THREE.OctahedronGeometry(0.56, 0), primary, 0, 1.55, 0);
    const eye = mesh(new THREE.SphereGeometry(0.15, 12, 8), accent, 0, 1.56, 0.52);
    const ring = mesh(new THREE.TorusGeometry(0.82, 0.08, 8, 22), accent, 0, 1.55, 0);
    ring.rotation.x = Math.PI / 2;
    group.add(body, eye, ring);
    group.userData.parts = { body, eye, ring };
    return group;
  }

  const torso = box(dark, [0.82, 1.02, 0.48], [0, 1.25, 0]);
  const panel = box(primary, [0.42, 0.64, 0.07], [0, 1.28, 0.28]);
  const head = box(skin, [0.58, 0.56, 0.52], [0, 2.03, 0]);
  const visor = box(accent, [0.6, 0.13, 0.08], [0, 2.08, 0.29]);
  const leftArm = capsuleLike(dark, 0.15, 0.58, [-0.54, 1.26, 0], 6);
  const rightArm = capsuleLike(dark, 0.15, 0.58, [0.54, 1.26, 0], 6);
  const leftLeg = capsuleLike(dark, 0.18, 0.6, [-0.22, 0.42, 0], 6);
  const rightLeg = capsuleLike(dark, 0.18, 0.6, [0.22, 0.42, 0], 6);
  group.add(torso, panel, head, visor, leftArm, rightArm, leftLeg, rightLeg);

  if (kind.ai === "sniper") {
    const rifle = box(primary, [0.16, 0.18, 1.42], [0.52, 1.42, 0.52]);
    const scope = mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.38, 8), accent, 0.52, 1.58, 0.54);
    scope.rotation.x = Math.PI / 2;
    group.add(rifle, scope);
  } else if (kind.ai === "rusher") {
    const blade = mesh(new THREE.ConeGeometry(0.18, 1.12, 4), accent, 0.7, 1.22, 0.3);
    blade.rotation.x = Math.PI / 2;
    group.add(blade);
  } else {
    group.add(box(primary, [0.18, 0.2, 0.9], [0.52, 1.4, 0.42]));
  }

  group.userData.parts = { torso, head, leftArm, rightArm, leftLeg, rightLeg, visor };
  return group;
}

export function createRelayModel(index) {
  const group = new THREE.Group();
  const dark = material(0x08101f, { roughness: 0.52, metalness: 0.72 });
  const glow = material(index === 1 ? palette.purple : palette.danger, { emissive: true, emissiveIntensity: 2.5 });
  const gold = material(palette.gold, { emissive: true, emissiveIntensity: 0.4 });
  const base = mesh(new THREE.CylinderGeometry(1.25, 1.48, 0.45, 8), dark, 0, 0.22, 0);
  const tower = mesh(new THREE.CylinderGeometry(0.38, 0.62, 3.1, 8), dark, 0, 1.9, 0);
  const core = mesh(new THREE.OctahedronGeometry(0.62, 0), glow, 0, 3.6, 0);
  const ringA = mesh(new THREE.TorusGeometry(0.92, 0.075, 8, 28), glow, 0, 3.6, 0);
  const ringB = mesh(new THREE.TorusGeometry(0.72, 0.055, 8, 24), gold, 0, 3.6, 0);
  ringA.rotation.x = Math.PI / 2;
  ringB.rotation.y = Math.PI / 2;
  group.add(base, tower, core, ringA, ringB);
  group.userData.parts = { core, ringA, ringB };
  return group;
}

export function createBossModel() {
  const group = new THREE.Group();
  const black = material(0x374258, { roughness: 0.44, metalness: 0.54 });
  const red = material(palette.danger, { emissive: true, emissiveIntensity: 1.72 });
  const gold = material(palette.gold, { emissive: true, emissiveIntensity: 0.54 });
  const core = mesh(new THREE.IcosahedronGeometry(1.73, 1), black, 0, 3.25, 0);
  const eye = mesh(new THREE.SphereGeometry(0.5, 20, 14), red, 0, 3.25, 1.59);
  const crown = mesh(new THREE.CylinderGeometry(0.11, 0.42, 1.15, 10), black, 0, 5.14, 0);
  const ringA = mesh(new THREE.TorusGeometry(2.15, 0.12, 10, 36), red, 0, 3.25, 0);
  const ringB = mesh(new THREE.TorusGeometry(2.7, 0.08, 8, 40), gold, 0, 3.25, 0);
  ringA.rotation.x = Math.PI / 2;
  ringB.rotation.y = Math.PI / 2;
  group.add(core, eye, crown, ringA, ringB);
  const cap = mesh(new THREE.TorusGeometry(0.58, 0.035, 6, 30), gold, 0, 5.38, 0);
  cap.rotation.x = Math.PI / 2;
  group.add(cap);

  for (let index = 0; index < 4; index += 1) {
    const arm = new THREE.Group();
    arm.rotation.y = index * Math.PI / 2;
    const joint = mesh(new THREE.CylinderGeometry(0.26, 0.4, 2.5, 8), black, 0, 3.25, 2.5);
    joint.rotation.x = Math.PI / 2;
    const pod = beveledBox(black, [0.78, 0.72, 1.18], [0, 3.25, 2.98], 0.14);
    const muzzle = mesh(new THREE.CylinderGeometry(0.26, 0.33, 0.36, 12), red, 0, 3.25, 3.67);
    muzzle.rotation.x = Math.PI / 2;
    arm.add(joint, pod, muzzle);
    group.add(arm);
  }

  group.userData.parts = { core, eye, crown, ringA, ringB };
  return group;
}

export function createPickupModel(kind) {
  const group = new THREE.Group();
  const color = kind === "health" ? palette.green : kind === "armor" ? palette.gold : palette.sui;
  const glow = material(color, { emissive: true, emissiveIntensity: 2.2 });
  const inner = material(palette.white, { emissive: color, emissiveIntensity: 0.7 });
  const outer = mesh(new THREE.TorusGeometry(0.48, 0.11, 8, 18), glow, 0, 0, 0);
  const core = kind === "sui"
    ? mesh(new THREE.CircleGeometry(0.41, 32), pulseChargeMaterial())
    : mesh(kind === "health" ? new THREE.BoxGeometry(0.38, 0.38, 0.38) : new THREE.OctahedronGeometry(0.32, 0), inner);
  group.add(outer, core);
  group.userData.parts = { outer, core };
  return group;
}

function pulseChargeMaterial() {
  if (!pulseChargeFace) {
    const map = new THREE.TextureLoader().load(pulseChargeUrl);
    map.colorSpace = THREE.SRGBColorSpace;
    pulseChargeFace = new THREE.MeshBasicMaterial({ map, side: THREE.DoubleSide, toneMapped: false });
  }
  return pulseChargeFace;
}

export function createAquaticMascot(kind) {
  const group = new THREE.Group();
  const walrus = kind === "walrus";
  const skin = material(walrus ? 0x437988 : 0x668ba4, { roughness: 0.73, metalness: 0.08, flatShading: false });
  const muzzle = material(walrus ? 0x96b1b4 : 0xacc6d4, { roughness: 0.8, flatShading: false });
  const ivory = material(0xe2dec5, { roughness: 0.68, flatShading: false });
  const dark = material(0x090e19);
  const sphere = new THREE.SphereGeometry(1, 20, 12);
  function oval(mat, position, scale) {
    const piece = mesh(sphere, mat, ...position);
    piece.scale.set(...scale);
    group.add(piece);
    return piece;
  }
  oval(skin, [0, 0.57, -0.23], [walrus ? 0.74 : 0.59, 0.58, 1.06]);
  oval(skin, [0, 0.96, 0.47], [0.48, 0.49, 0.52]);
  oval(dark, [0, 0.96, 0.98], [0.145, 0.085, 0.08]);
  for (const side of [-1, 1]) {
    oval(dark, [0.245 * side, 1.14, 0.84], [0.065, 0.08, 0.055]);
    oval(muzzle, [0.19 * side, 0.86, 0.89], [0.24, 0.17, 0.16]);
    const flipper = oval(skin, [0.67 * side, 0.19, 0.07], [0.37, 0.15, 0.58]);
    flipper.rotation.y = side * 0.53;
    const tail = oval(skin, [0.22 * side, 0.23, -1.13], [0.2, 0.125, 0.46]);
    tail.rotation.y = -side * 0.54;
    if (walrus) {
      const tusk = mesh(new THREE.ConeGeometry(0.082, 0.49, 10), ivory, 0.21 * side, 0.64, 0.98);
      tusk.rotation.set(Math.PI - 0.18, 0, side * 0.16);
      group.add(tusk);
    }
  }
  return group;
}

export function createWaterDrop() {
  const profile = [[0, -0.24], [0.13, -0.22], [0.22, -0.12], [0.23, 0.005], [0.17, 0.14], [0.08, 0.25], [0, 0.42]]
    .map(([radius, height]) => new THREE.Vector2(radius, height));
  return new THREE.Mesh(
    new THREE.LatheGeometry(profile, 16),
    material(0x3ebeff, { emissive: 0x168dff, emissiveIntensity: 1.4, roughness: 0.25, flatShading: false }),
  );
}

export function setShadowRecursive(root, enabled = true) {
  root.traverse((child) => {
    if (!child.isMesh) return;
    child.castShadow = enabled;
    child.receiveShadow = enabled;
  });
}
