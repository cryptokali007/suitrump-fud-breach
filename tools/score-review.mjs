import assert from "node:assert/strict";
import { test } from "node:test";
import { checkRun, ENCOUNTERS, RunScore, SCORE_GAME, SCORE_VERSION, receiptHashInput, runRank } from "../src/scoring.js";

function completedRun() {
  const ledger = new RunScore();
  let at = 0;
  function add(type, id, kind) {
    at += 250;
    return ledger.record({ type, at, id, kind });
  }
  assert.equal(add("coin", "opening", "sui"), 260);
  ENCOUNTERS.breach.forEach((kind, index) => add("enemy", `breach-${index}`, kind));
  assert.equal(ledger.score, 1285);
  add("stage", "relays");
  assert.equal(add("coin", "gate", "suitrump"), 600);
  add("enemy", "relay-0", "agent");
  assert.equal(add("coin", "relay-0", "sui"), 260);
  for (let index = 1; index <= 3; index += 1) add("relay", `relay-${index}`);
  add("stage", "boss");
  assert.equal(add("enemy", "bot-wave", "bot"), 0);
  assert.throws(() => add("coin", "bot-wave", "sui"), /no scoring source/);
  add("boss");
  add("stage", "extract");
  add("extract");
  const stats = { health: 84, shots: 19, hits: 15, takedowns: 7, peakChain: 6 };
  return {
    game: SCORE_GAME, version: SCORE_VERSION, score: ledger.score, events: ledger.events, stats,
    durationMs: at, rank: runRank(ledger.score, at, stats),
  };
}

test("a complete mission reproduces the score from events", () => {
  const run = completedRun();
  assert.equal(checkRun(JSON.parse(JSON.stringify(run))), run.score);
});

test("the checksum payload ignores field order and excludes the checksum itself", () => {
  const run = completedRun();
  const reordered = { sha256: "placeholder", ...Object.fromEntries(Object.entries(run).reverse()) };
  assert.equal(receiptHashInput(reordered), receiptHashInput(run));
});

test("a changed final score is rejected", () => {
  const run = completedRun();
  assert.throws(() => checkRun({ ...run, score: run.score + 1 }), /Recorded points differ/);
});

test("a repeated coin and a fabricated source are rejected", () => {
  const run = completedRun();
  const [first] = run.events;
  assert.throws(() => checkRun({ ...run, events: [first, ...run.events] }), /Repeated or missing coin/);
  assert.throws(() => checkRun({ ...run, events: [{ ...first, id: "unknown" }, ...run.events.slice(1)] }), /no scoring source/);
});

test("a forged relay ID or skipped objective is rejected", () => {
  const run = completedRun();
  const events = run.events.map((event) => event.type === "relay" ? { ...event, id: [event.id] } : event);
  assert.throws(() => checkRun({ ...run, events }), /Invalid relay/);
  assert.throws(() => checkRun({ ...run, events: run.events.filter((event) => event.id !== "relay-3") }), /skips a required/);
});

test("an incomplete run cannot claim an extracted score", () => {
  const run = completedRun();
  assert.throws(() => checkRun({ ...run, events: run.events.slice(0, -1) }), /must end at extraction/);
});
