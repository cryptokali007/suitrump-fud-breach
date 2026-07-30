export const TAU = Math.PI * 2;
export const STEP = 1 / 60;
export const WORLD_HALF_X = 30;
export const WORLD_HALF_Z = 38;

export const palette = {
  void: 0x03050c,
  sky: 0x07152b,
  fog: 0x091a33,
  floor: 0x071426,
  floorAlt: 0x0d2440,
  sui: 0x65d7ff,
  suiDeep: 0x1768ff,
  gold: 0xffd45f,
  danger: 0xff4268,
  orange: 0xff8a38,
  purple: 0xa76bff,
  green: 0x54efac,
  white: 0xf4fbff,
  ink: 0x07101d,
  playerBlue: 0x27a7ff,
  playerSuit: 0x071a4a,
  playerTie: 0xed344e,
  playerHair: 0xf6cd48,
  enemySkin: 0xd7a174,
};

export const ENEMY_TYPES = {
  agent: {
    id: "agent",
    label: "FUD AGENT",
    color: palette.danger,
    accent: palette.white,
    health: 4,
    speed: 2.9,
    damage: 7,
    fireRate: 1.65,
    range: 13,
    score: 120,
    ai: "ranged",
  },
  farmer: {
    id: "farmer",
    label: "ENGAGEMENT FARMER",
    color: palette.orange,
    accent: palette.gold,
    health: 5,
    speed: 4.45,
    damage: 12,
    fireRate: 1.15,
    range: 2.1,
    score: 170,
    ai: "rusher",
  },
  sniper: {
    id: "sniper",
    label: "FAKE NEWS SNIPER",
    color: palette.purple,
    accent: 0xffc0ff,
    health: 3,
    speed: 2.05,
    damage: 16,
    fireRate: 3.0,
    range: 20,
    score: 210,
    ai: "sniper",
  },
  bot: {
    id: "bot",
    label: "NGMI BOT",
    color: palette.green,
    accent: palette.sui,
    health: 3,
    speed: 3.5,
    damage: 6,
    fireRate: 1.25,
    range: 10,
    score: 145,
    ai: "drone",
  },
};

export const STAGE_COPY = {
  breach: {
    title: "BREACH THE PERIMETER",
    objective: "Clear the outer FUD security detail.",
  },
  relays: {
    title: "CUT THE SIGNAL",
    objective: "Destroy all three propaganda relay nodes.",
  },
  boss: {
    title: "BREAK THE NARRATIVE",
    objective: "Defeat the Mainstream Media Machine.",
  },
  extract: {
    title: "EXTRACT",
    objective: "Reach the SUI extraction pad.",
  },
};

export const OUTER_SPAWNS = [
  [-20, 18], [-10, 5], [0, 9], [11, 4], [21, 18], [-22, -4], [22, -5],
];

export const INNER_SPAWNS = [
  [-21, -17], [-12, -29], [0, -22], [12, -29], [21, -17], [-17, -6], [17, -6],
];

export function clamp(value, minimum, maximum) {
  return Math.max(minimum, Math.min(maximum, value));
}

export function random(minimum, maximum) {
  return minimum + Math.random() * (maximum - minimum);
}

export function distance2(ax, az, bx, bz) {
  const dx = ax - bx;
  const dz = az - bz;
  return dx * dx + dz * dz;
}

export function forwardOf(yaw) {
  return { x: Math.sin(yaw), z: Math.cos(yaw) };
}

export function rightOf(yaw) {
  const forward = forwardOf(yaw);
  return { x: -forward.z, z: forward.x };
}

export function wrapAngle(value) {
  while (value > Math.PI) value -= TAU;
  while (value < -Math.PI) value += TAU;
  return value;
}

export function round(value) {
  return Math.round(value * 100) / 100;
}
