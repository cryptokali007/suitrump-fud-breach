# SuiTrump: FUD Breach

SuiTrump: FUD Breach is a standalone, single-player Three.js arcade shooter by [cryptokali007](https://github.com/cryptokali007). Play as Sui Trump, the blue-faced president of the Sui Memeverse. Clear the FUD defenders, cut the relays, and defeat the Mainstream Media Machine before extraction.

The project is fully local and static. It has no wallet, chain, RPC, account, analytics, CDN, backend, API key, or cloud dependency.

## Play the offline build

Open `SuiTrump-FUD-Breach.html` in a desktop browser with WebGL 2. The file contains the game, styles, and renderer. The bundled file's Content Security Policy blocks network connections.

To create it from source, run `npm ci` and `npm run build:offline`. The default output is `dist-offline/SuiTrump-FUD-Breach.html`.

## Requirements

- Node.js `20.19+` or `22.12+`
- npm
- A current desktop browser with WebGL support

## Clone and run

```shell
git clone https://github.com/cryptokali007/suitrump-fud-breach.git
cd suitrump-fud-breach
npm ci
npm run dev
```

Open `http://127.0.0.1:4182/`.

Windows users can instead double-click:

```text
Start-SuiTrumpFudRun3DRevamped.bat
```

The launcher starts Vite and opens Brave, with Mullvad Browser as the fallback. Use `Stop-SuiTrumpFudRun3DRevamped.ps1` to stop that local server.

## Mission

1. Breach the perimeter and clear the opening defenders.
2. Destroy all three FUD relay nodes.
3. Defeat the Mainstream Media Machine and its summoned adds.
4. Reach extraction for a time-, health-, and accuracy-weighted rank.

## Controls

| Action | Input |
| --- | --- |
| Move | `WASD` |
| Look | Mouse after clicking the game; arrow keys are a fallback |
| Fire | Left mouse or `Space` |
| Select a weapon | `1` Repeater, `2` Riptide, `3` Rickroll |
| Dash | `Shift` or `Q` |
| SUI pulse | `E` or right mouse |
| First/third person | `V` |
| Pause/resume | `P` or the Resume button |
| Restart | `R` |
| Graphics quality | `G` |
| Audio | `U` |
| Fullscreen | `F` |
| Release mouse and pause | `Esc` |

PC is the primary target. Missions start in first person. Press `V` for the chase camera. Touch devices in landscape use a left movement pad, right aim/fire pad, and Dash, Pulse, Pause, and weapon buttons.

The Repeater fires quickly. Riptide deals heavier damage and splashes nearby targets. Rickroll disables a scam bot or rug runner on a direct hit and takes ten seconds to recharge.

## Scoring

Chain takedowns within four seconds to build a multiplier up to 2×. Destroying relays, defeating the boss, and extracting quickly add points. The result screen shows points, clearance time, accuracy, KOs, longest chain, rank, and the best clear of the current session.

| Pickup | Points | Effect |
| --- | ---: | --- |
| SUI coin | 260 | Recharges 2.4 seconds of Pulse |
| SuiTrump coin | 600 | Resets Dash cooldown |

The SUI coin uses the original MMAC sprite atlas and spin timing. The SuiTrump coin uses the same animated body with a portrait on the face. To replace either chime, overwrite `src/assets/audio/sui-coin.wav` or `src/assets/audio/suitrump-coin.wav` with a PCM WAV and rebuild.

After extraction, **Share score** opens a copyable result and a downloadable JSON receipt. Scores stay in the current tab until the player copies or downloads a result. To check a receipt locally, run:

```shell
npm run verify:score -- path/to/score.json
```

The verifier checks the checksum, replays scoring events, and compares the resulting points and rank. Receipts are player-supplied under a trust-based system.

## Build and verify

```shell
npm run check
npm run build
```

Focused Playwright regression suites:

```shell
npx playwright install chromium
npm run test:mission
npm run test:controls
npm run test:mobile
npm run test:combat
```

Create the automated 720p showcase capture with the WebGL scene, HUD, and procedural audio mixed into one WebM:

```shell
npm run record:showcase
```

The default capture output is written to ignored local directory `output/showcase`. Override it with a second script argument or the `SUITRUMP_SHOWCASE_OUTPUT` environment variable.

The game exposes `window.render_game_to_text()` and deterministic `window.advanceTime(ms)` hooks. QA helpers exist only with `?test=1` or `?qa=1`; normal play does not expose them.

## Project layout

```text
src/
  arena-art.js
  audio.js
  bootstrap.js
  config.js
  game.js
  models.js
test-actions/
tools/
```

`src/` contains the game runtime, procedural models, mission logic, rendering, input, HUD, and audio. `tools/` contains project-owned Playwright review and showcase-capture scripts.

See [project status](PROJECT_STATUS.md) for the current build and [progress notes](progress.md) for implementation history.
