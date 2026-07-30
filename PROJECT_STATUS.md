# Project Status

## Purpose

`SuiTrump: FUD Breach` is the fully revamped, single-player browser edition of the original SuiTrump 3D shooter. It targets a visually strong desktop experience first, with a functional landscape-phone control/layout baseline and no multiplayer or on-chain scope.

## Canonical paths

- Upgraded project: `C:\Users\Owner\CodexApp\WinApp\Projects\SuiTrumpFudRun3DRevamped`
- Preserved original: `C:\Users\Owner\CodexApp\WinApp\Projects\SuiTrumpFudRun3D`
- Private GitHub handoff: `https://github.com/cryptokali007/suitrump-fud-breach`

## Run and preview

```powershell
.\Start-SuiTrumpFudRun3DRevamped.ps1
```

- Local URL: `http://127.0.0.1:4182/`
- Direct development command: `npm run dev`
- Production build: `npm run build`
- Production preview: `npm run preview`
- Stop local server: `.\Stop-SuiTrumpFudRun3DRevamped.ps1`
- Automated showcase capture: `npm run record:showcase`
- Browser order for this project: Brave, then Mullvad Browser. Mullvad is normally preferred on this machine, but its current profile cannot create a WebGL context for this Three.js game. Chrome/system-default launching remains disabled.

## Current implementation

- Mission chain: breach, relay destruction, boss fight, extraction, victory/rank
- Combat: hitscan fire, aim assistance, dash, radial SUI pulse, enemy projectiles, pickups
- Opposition: four enemy archetypes plus a two-phase boss with volleys and summons
- Presentation: procedural models, skyline arena, atmospheric lighting, bloom, particles, shockwaves, layered HUD, radar, procedural audio
- Input: keyboard/mouse, first/third-person camera, fullscreen, pause/restart, landscape touch controls
- Performance controls: low/medium/high graphics presets; low-cost `?qa=1` automation mode

## Verification

Last full verification: 2026-07-12. Launcher/WebGL recovery verified separately on 2026-07-14.

- `npm install`: completed, zero reported vulnerabilities
- `npm run check`: passed
- `npm run build`: passed
- Official web-game Playwright client: passed combat/state/error pass
- Mission transition suite: passed breach through victory plus game-over path
- Controls suite: passed camera, dash, pulse, pause, normal gunfire damage, fullscreen, restart
- Mobile suite: passed landscape controls/start action and portrait rotate behavior
- High-quality full-page screenshots: visually reviewed; no console or page errors
- Normal player URL: passed keyboard start, arrow-look fallback, movement, gunfire kill/score, quality persistence, audio mute/unmute, restart, and sustained 60 FPS verification
- Launcher lifecycle: ownership-checked stop and `-NoBrowser` restart passed; HTTP 200 returned the correct project
- Live Mullvad diagnosis on 2026-07-14: Vite loaded, then Three.js failed with `Error creating WebGL context`. The project launcher now uses Brave first and the page shows a renderer diagnostic instead of a black screen when WebGL is unavailable.
- Automated showcase capture on 2026-07-14: passed a choreographed title-to-victory run with movement, gunfire, dash, SUI Pulse, first/third-person views, relays, boss, extraction, and procedural audio. Final MP4 verified at 1280x720, 60 FPS, H.264 video, stereo 48 kHz AAC audio, 27.27 seconds, with zero browser errors.

Vite reports a chunk-size warning for the Three.js/post-processing bundle. The generated JavaScript is roughly 152 KB gzip, so this is a deployment optimization note, not a runtime blocker.

## Private GitHub handoff — 2026-07-29

- Private repository created at `https://github.com/cryptokali007/suitrump-fud-breach`
- `main` is the default branch
- Intended source payload passed credential filename and credential-pattern scans
- Fresh GitHub clone completed `npm ci`, `npm run check`, and `npm run build`
- Current npm audit reports zero vulnerabilities after updating transitive PostCSS to `8.5.25`
- Generated dependencies, builds, test output, logs, recordings, and environment files remain excluded from Git

## Deploy/cloud state

- Not deployed
- Private GitHub source handoff is ready for collaborator access
- No cloud project, billing account, API key, backend, wallet, or on-chain dependency
- No unresolved placeholder values

## Next recommended action

Add the project developer and trusted collaborator as private-repository collaborators when their GitHub usernames are available. They can clone the repository, run `npm ci`, and use `npm run dev` or `npm run build`.

## Lane boundary

Windows Codex app project. Keep it under `WinApp\Projects`; it is separate from MMAC and from all Grok/Antigravity workspaces.
