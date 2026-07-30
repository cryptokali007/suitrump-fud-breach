# SuiTrump: FUD Breach

SuiTrump: FUD Breach is a desktop-first, single-player 3D browser shooter built with Three.js and Vite. It combines fast arcade combat, a complete objective chain, a multi-phase boss, extraction, rank scoring, desktop mouse-look, procedural audio, and a functional landscape-touch baseline.

The project is fully local and static. It has no wallet, chain, RPC, account, analytics, CDN, backend, API key, or cloud dependency.

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
| Dash | `Shift` or `Q` |
| SUI pulse | `E` or right mouse |
| First/third person | `V` |
| Pause/resume | `P` |
| Restart | `R` |
| Graphics quality | `G` |
| Audio | `U` |
| Fullscreen | `F` |
| Release mouse | `Esc` |

PC is the primary target. On touch devices, the existing baseline uses a left movement pad, right aim/fire pad, and Dash/Pulse buttons. Landscape is supported; portrait intentionally shows a rotate prompt.

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
  audio.js
  bootstrap.js
  config.js
  game.js
  models.js
test-actions/
tools/
```

`src/` contains the game runtime, procedural models, mission logic, rendering, input, HUD, and audio. `tools/` contains project-owned Playwright review and showcase-capture scripts.

Live operational state is in `PROJECT_STATUS.md`; implementation history is in `progress.md`.

## Repository status

This repository is currently a private source handoff for project collaborators. No public license has been selected yet; choose one deliberately before changing the repository to public.
