# Gnozian Remastered

Mobile-first, offline-first remaster of Gnozian using Babylon.js.

> Status: **foundation / first playable vertical slice**. The full original game's content, mechanics, UI, and graphics have **not** yet been ported. This repository must not be mistaken for a finished remaster.

## Goals

- One responsive web build for Android/iOS browsers and GitHub Pages.
- Installable PWA with offline operation after first online install.
- Low-poly world rendered with Babylon.js and editable Blockbench `.bbmodel` source assets.
- Deterministic simulation independent of rendering and input.
- Preserve Gnozian game rules through an audited, incremental migration from the original repository.

## Development

Requires Node.js 22+.

```bash
npm install
npm run dev
npm run typecheck
npm run build
```

GitHub Pages runs from `dist` via GitHub Actions. To enable deployment: **Settings → Pages → Build and deployment → Source: GitHub Actions**.

## Offline

The service worker installs a versioned application shell and stores same-origin assets. The first visit requires an internet connection; installed builds can be relaunched offline. Network multiplayer still requires a server and is not available offline.

## Licensing

Remaster source is GPL-3.0-or-later, consistent with the original. Existing art and content require rights/licensing review before public import.

## Roadmap

1. Babylon.js + mobile touch controls + PWA shell.
2. Port original engine, state contracts, saves and deterministic tests.
3. Build low-poly Blockbench asset library for every visible game entity.
4. Rebuild gameplay UI for touch, portrait, landscape and accessibility.
5. Port AI, diplomacy, economy, research, achievements and multiplayer.
6. Profile mobile devices, benchmark, test offline upgrade and ship stable releases.
