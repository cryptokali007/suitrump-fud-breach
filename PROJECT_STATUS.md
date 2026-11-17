# Project status

## Standalone game update — November 17, 2026

The canonical source is [cryptokali007/suitrump-fud-breach](https://github.com/cryptokali007/suitrump-fud-breach). The corresponding desktop checkout is `WinApp/Projects/SuiTrumpFudRun3DRevamped`.

- The mission takes the blue mascot through the perimeter, relays, a two-phase boss fight, and extraction. First person is the default. `V` switches to the chase camera.
- The arena has textured steel, beveled cover, a new skyline, and friendly walrus and seal mascots.
- Repeater, Riptide, and Rickroll are available on `1`–`3`. Riptide deals splash damage. Rickroll disables scam bots and rug runners and recharges in ten seconds.
- Four-second takedown chains, clear ranks, and a session best reward replay.
- The coin update reuses the original MMAC PNG and frame metadata for the 260-point SUI coin. A matching 600-point SuiTrump portrait coin resets Dash. The player model uses swept blond hair and a tailored navy suit.
- The current build holds scores in memory for the browser session. Players choose to copy a result or download a receipt after extraction. Run `npm run verify:score -- <receipt.json>` to recalculate a submitted score.

## Run and build

- Run `npm ci` and `npm run dev` to preview at `http://127.0.0.1:4182/`.
- Run `npm run build` for the static build.
- Run `npm run build:offline` for `dist-offline/SuiTrump-FUD-Breach.html`. The standalone file bundles the game and enforces a Content Security Policy that blocks network connections.
- For local development and the Windows launcher, see the [README](README.md).

## Validation

Syntax checks, production and offline builds, six scoring tests, and the control, mission, mobile, combat, and visual Playwright reviews passed.

The final offline Brave playthrough collected both coins and extracted with 18,388 points. Copy and JSON download succeeded. The offline verifier recalculated the same result, the score reset on reload, and the browser made zero HTTP or WebSocket requests. The final MP4 is 39 seconds at 1280×720 and 60 FPS with stereo game audio.

The game and recorded playthrough are in `Deliverables/SuiTrump-FUD-Breach-Coins-2026-11-17/WD-Stuff`. Vite reports a size advisory for the Three.js bundle, which compresses to approximately 202 kB gzip. Use the README to rebuild or swap the coin sound files.
