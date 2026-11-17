import { CHAIN_WINDOW, ENEMY_TYPES, chainMultiplier } from "./config.js";

export const SCORE_VERSION = 1;
export const SCORE_GAME = "SuiTrump: FUD Breach";
export const COINS = Object.freeze({
  sui: { name: "SUI coin", points: 260, color: 0x65d7ff },
  suitrump: { name: "SuiTrump coin", points: 600, color: 0xffd45f },
});
export const ENCOUNTERS = Object.freeze({
  breach: ["agent", "agent", "farmer", "agent", "bot"],
  relay: ["agent", "sniper", "bot", "farmer", "agent", "sniper"],
});

export function scoreTime(seconds) {
  return Math.round(seconds * 1000);
}

export class RunScore {
  constructor() {
    this.score = 0;
    this.events = [];
    this.stage = "breach";
    this.enemies = new Map();
    this.coins = new Set();
    this.relays = new Set();
    this.bossDefeated = false;
    this.chain = 0;
    this.peakChain = 0;
    this.lastTakedownAt = -Infinity;
  }

  record(event) {
    const { at, type, id, kind } = event;
    const previous = this.events.at(-1);
    requireValid(Number.isSafeInteger(at) && at >= (previous?.at ?? 0), "Score events must be in time order.");
    requireValid(this.stage !== "complete", "Score events cannot follow extraction.");
    const points = this.award(type, id, kind, at);
    this.score += points;
    this.events.push(event);
    return points;
  }

  award(type, id, kind, at) {
    if (type === "enemy") return this.takedown(id, kind, at);
    if (type === "coin") return this.pickup(id, kind);
    if (type === "stage") {
      if (id === "relays" && this.stage === "breach" && this.enemies.size === ENCOUNTERS.breach.length) this.stage = "relay";
      else if (id === "boss" && this.stage === "relay" && this.relays.size === 3) this.stage = "boss";
      else if (id === "extract" && this.stage === "boss" && this.bossDefeated) this.stage = "extract";
      else throw new Error("Mission stage skips a required objective.");
      return 0;
    }
    if (type === "relay") {
      requireValid(this.stage === "relay" && typeof id === "string" && /^relay-[1-3]$/.test(id) && !this.relays.has(id), "Invalid relay destruction.");
      this.relays.add(id);
      return 850;
    }
    if (type === "boss") {
      requireValid(this.stage === "boss" && !this.bossDefeated, "A single boss defeat requires all three relays.");
      this.bossDefeated = true;
      return 5000;
    }
    requireValid(type === "extract" && this.stage === "extract", "Extraction requires the defeated boss.");
    this.stage = "complete";
    return Math.max(0, Math.round(9000 - at * 0.042));
  }

  takedown(id, kind, at) {
    requireValid(typeof id === "string" && !this.enemies.has(id), "Repeated or missing enemy ID.");
    const index = Number(id.slice(id.lastIndexOf("-") + 1));
    const wave = ENCOUNTERS[this.stage];
    const encounter = wave && Number.isInteger(index) && index >= 0 && index < wave.length
      && id === `${this.stage}-${index}` && wave[index] === kind;
    const reinforcement = (this.stage === "boss" || this.stage === "extract")
      && (kind === "bot" || kind === "farmer") && id.startsWith(`${kind}-`) && /^[a-z0-9-]+$/.test(id);
    requireValid(encounter || reinforcement, "Unexpected enemy for this mission stage.");
    this.enemies.set(id, Boolean(reinforcement));
    if (reinforcement) return 0;
    this.chain = at - this.lastTakedownAt < scoreTime(CHAIN_WINDOW) ? this.chain + 1 : 1;
    this.lastTakedownAt = at;
    this.peakChain = Math.max(this.peakChain, this.chain);
    return Math.round(ENEMY_TYPES[kind].score * chainMultiplier(this.chain));
  }

  pickup(id, kind) {
    requireValid(typeof id === "string" && !this.coins.has(id), "Repeated or missing coin source.");
    const fromEnemy = this.enemies.has(id);
    if (kind === "sui") {
      requireValid(id === "opening" || (fromEnemy && !this.enemies.get(id)), "SUI coin has no scoring source in the run.");
    } else {
      requireValid(kind === "suitrump" && id === "gate" && this.stage !== "breach", "SuiTrump coin requires the open gate.");
    }
    this.coins.add(id);
    return COINS[kind].points;
  }
}

export function runRank(score, durationMs, stats) {
  const accuracy = stats.shots > 0 ? stats.hits / stats.shots : 0;
  const rank = score + Math.max(0, 6000 - durationMs * 0.024) + accuracy * 1800 + stats.health * 10;
  if (rank >= 20500) return "S  /  VANGUARD";
  if (rank >= 16500) return "A  /  SIGNAL BREAKER";
  if (rank >= 12500) return "B  /  OPERATOR";
  return "C  /  SURVIVOR";
}

export function checkRun(receipt) {
  requireValid(receipt?.game === SCORE_GAME && receipt.version === SCORE_VERSION && Array.isArray(receipt.events), "Unsupported score receipt.");
  const ledger = new RunScore();
  for (const event of receipt.events) {
    requireValid(event && typeof event === "object", "Invalid score event.");
    ledger.record(event);
  }
  requireValid(ledger.stage === "complete" && ledger.events.at(-1).at === receipt.durationMs, "The receipt must end at extraction.");
  requireValid(ledger.score === receipt.score, "Recorded points differ from the calculated score.");
  const stats = receipt.stats;
  requireValid(stats && Number.isSafeInteger(stats.shots) && Number.isSafeInteger(stats.hits)
    && stats.shots >= stats.hits && stats.hits >= 0
    && Number.isInteger(stats.health) && stats.health >= 1 && stats.health <= 100, "Invalid run statistics.");
  requireValid(stats.takedowns === ledger.enemies.size && stats.peakChain === ledger.peakChain, "Takedowns or chain differ from the score events.");
  requireValid(receipt.rank === runRank(receipt.score, receipt.durationMs, stats), "Rank differs from the recorded statistics.");
  return ledger.score;
}

export function receiptHashInput({ sha256: _sha256, ...payload }) {
  return JSON.stringify(payload, (key, value) => {
    if (value && typeof value === "object" && !Array.isArray(value)) {
      return Object.fromEntries(Object.keys(value).sort().map((name) => [name, value[name]]));
    }
    return value;
  });
}

function requireValid(condition, message) {
  if (!condition) throw new Error(message);
}
