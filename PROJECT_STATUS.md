# Project status

## Standalone game update — November 17, 2026

The canonical source is [cryptokali007/suitrump-fud-breach](https://github.com/cryptokali007/suitrump-fud-breach). The corresponding desktop checkout is `WinApp/Projects/SuiTrumpFudRun3DRevamped`.

- The mission takes the blue mascot through the perimeter, relays, a two-phase boss fight, and extraction. First person is the default. `V` switches to the chase camera.
- The arena has textured steel, beveled cover, a new skyline, and friendly walrus and seal mascots.
- Repeater, Riptide, and Rickroll are available on `1`–`3`. Riptide deals splash damage. Rickroll disables scam bots and rug runners and recharges in ten seconds.
- Four-second takedown chains, clear ranks, and browser-local personal bests reward replay.

## Run and build

- Run `npm ci` and `npm run dev` to preview at `http://127.0.0.1:4182/`.
- Run `npm run build` for the static build.
- Run `npm run build:offline` for `dist-offline/SuiTrump-FUD-Breach.html`. The standalone file bundles the game and enforces a Content Security Policy that blocks network connections.
- For local development and the Windows launcher, see the [README](README.md).

## Validation

Syntax checks, production and offline builds, and the four Playwright suites passed. A regular-input Brave playthrough reached extraction with 18,282 points. A separate offline run reached 18,306 and retained the record across reload. Both runs made zero network requests.

Vite reports a size advisory for the Three.js bundle, which compresses to approximately 170 kB gzip.

The repository distributes the standalone game's source. The next step for contributors is to build locally using the README.
