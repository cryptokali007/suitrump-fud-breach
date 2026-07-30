import * as THREE from "three";
import { palette } from "./config.js";

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

function capsuleLike(mat, radius, height, position, segments = 8) {
  return mesh(new THREE.CapsuleGeometry(radius, height, 4, segments), mat, position[0], position[1], position[2]);
}

export function createPlayerModel() {
  const group = new THREE.Group();
  const suit = material(palette.playerSuit, { roughness: 0.55, metalness: 0.4 });
  const blue = material(palette.playerBlue, { roughness: 0.5, metalness: 0.22 });
  const white = material(palette.white, { roughness: 0.65, metalness: 0.12 });
  const tie = material(palette.playerTie, { emissive: true, emissiveIntensity: 0.18 });
  const hair = material(palette.playerHair, { roughness: 0.48, metalness: 0.25 });
  const gold = material(palette.gold, { emissive: true, emissiveIntensity: 0.32 });
  const glow = material(palette.sui, { emissive: true, emissiveIntensity: 2.2 });

  const torso = box(suit, [0.92, 1.12, 0.52], [0, 1.32, 0]);
  const shirt = box(white, [0.42, 0.72, 0.08], [0, 1.36, 0.3]);
  const neckTie = box(tie, [0.14, 0.68, 0.08], [0, 1.3, 0.36]);
  const head = box(blue, [0.68, 0.66, 0.62], [0, 2.18, 0]);
  const nose = box(blue, [0.2, 0.18, 0.2], [0, 2.17, 0.39]);
  group.add(torso, shirt, neckTie, head, nose);

  const hairTop = box(hair, [0.82, 0.18, 0.66], [-0.03, 2.58, 0]);
  hairTop.rotation.z = -0.08;
  group.add(hairTop);
  for (let index = 0; index < 4; index += 1) {
    const tuft = mesh(new THREE.ConeGeometry(0.17, 0.48, 5), hair, -0.28 + index * 0.18, 2.73 + index * 0.015, 0.05 + index * 0.03);
    tuft.rotation.z = -1.32;
    group.add(tuft);
  }

  const leftArm = capsuleLike(suit, 0.17, 0.62, [-0.62, 1.34, 0], 6);
  const rightArm = capsuleLike(suit, 0.17, 0.62, [0.62, 1.34, 0], 6);
  const leftLeg = capsuleLike(suit, 0.2, 0.64, [-0.25, 0.45, 0], 6);
  const rightLeg = capsuleLike(suit, 0.2, 0.64, [0.25, 0.45, 0], 6);
  group.add(leftArm, rightArm, leftLeg, rightLeg);

  const gunRoot = new THREE.Group();
  gunRoot.position.set(0.5, 1.45, 0.35);
  const gunBody = box(gold, [0.25, 0.25, 1.05], [0, 0, 0.35]);
  const gunCore = mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.62, 10), glow, 0, 0, 0.98);
  gunCore.rotation.x = Math.PI / 2;
  gunRoot.add(gunBody, gunCore);
  group.add(gunRoot);

  const halo = mesh(new THREE.TorusGeometry(0.56, 0.045, 8, 24), glow, 0, 2.92, 0);
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
  const gold = material(palette.gold, { emissive: true, emissiveIntensity: 0.22 });
  const glow = material(palette.sui, { emissive: true, emissiveIntensity: 1.45 });
  const leftHand = box(blue, [0.24, 0.24, 0.38], [-0.22, -0.16, -0.16]);
  const rightHand = box(blue, [0.24, 0.24, 0.38], [0.22, -0.16, -0.16]);
  const leftSleeve = box(suit, [0.3, 0.34, 0.56], [-0.3, -0.25, 0.14]);
  const rightSleeve = box(suit, [0.3, 0.34, 0.56], [0.3, -0.25, 0.14]);
  const body = box(gold, [0.44, 0.34, 1.15], [0, -0.02, -0.55]);
  const barrel = mesh(new THREE.CylinderGeometry(0.11, 0.15, 0.88, 10), glow, 0, 0.04, -1.32);
  barrel.rotation.x = Math.PI / 2;
  const sight = box(glow, [0.08, 0.12, 0.34], [0, 0.26, -0.62]);
  group.add(leftSleeve, rightSleeve, leftHand, rightHand, body, barrel, sight);
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
  const black = material(0x05060b, { roughness: 0.38, metalness: 0.86 });
  const red = material(palette.danger, { emissive: true, emissiveIntensity: 2.7 });
  const gold = material(palette.gold, { emissive: true, emissiveIntensity: 0.72 });
  const core = mesh(new THREE.DodecahedronGeometry(1.55, 0), black, 0, 3.25, 0);
  const eye = mesh(new THREE.SphereGeometry(0.48, 18, 12), red, 0, 3.25, 1.34);
  const crown = mesh(new THREE.ConeGeometry(1.22, 1.4, 7), gold, 0, 5.1, 0);
  const ringA = mesh(new THREE.TorusGeometry(2.15, 0.12, 10, 36), red, 0, 3.25, 0);
  const ringB = mesh(new THREE.TorusGeometry(2.7, 0.08, 8, 40), gold, 0, 3.25, 0);
  ringA.rotation.x = Math.PI / 2;
  ringB.rotation.y = Math.PI / 2;
  group.add(core, eye, crown, ringA, ringB);

  for (let index = 0; index < 4; index += 1) {
    const arm = new THREE.Group();
    arm.rotation.y = index * Math.PI / 2;
    const joint = mesh(new THREE.CylinderGeometry(0.26, 0.4, 2.5, 8), black, 0, 3.25, 2.5);
    joint.rotation.x = Math.PI / 2;
    const muzzle = mesh(new THREE.CylinderGeometry(0.35, 0.35, 0.48, 10), red, 0, 3.25, 3.8);
    muzzle.rotation.x = Math.PI / 2;
    arm.add(joint, muzzle);
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
  const core = mesh(kind === "health" ? new THREE.BoxGeometry(0.38, 0.38, 0.38) : new THREE.OctahedronGeometry(0.32, 0), inner, 0, 0, 0);
  group.add(outer, core);
  group.userData.parts = { outer, core };
  return group;
}

export function setShadowRecursive(root, enabled = true) {
  root.traverse((child) => {
    if (!child.isMesh) return;
    child.castShadow = enabled;
    child.receiveShadow = enabled;
  });
}
