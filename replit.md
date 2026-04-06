# Streamer Pro

A futuristic full-stack video & music streaming platform. Black-and-white design with glassmorphism UI.

## Architecture

- **Frontend**: Vanilla JS (ES Modules), Vite 8 build tool
- **Backend**: Express.js + WebSocket (ws) on port 8080
- **Dev**: Vite dev server (port 5000) proxies `/api` and `/ws` to the backend
- **Prod**: Express serves Vite-built `dist/` (single port via `NODE_ENV=production`)

## Project Structure

```
app.js                  — App entry point, bootstraps all modules
index.html              — App shell HTML
style.css               — Global design system (black/white/glassmorphism)
vite.config.js          — Vite config (dev proxy → backend port 8080)

modules/
  video/
    player.js           — Video orchestrator, format auto-detection (HLS/DASH/Direct)
    controls.js         — Play/pause, seek bar, fullscreen, keyboard shortcuts
    gestures.js         — Touch swipe gestures (seek, volume)
    library.js          — Video grid, search, history panel, admin video merging
    admin.js            — Admin panel (add/remove custom stream URLs, localStorage)
    pip.js              — Picture-in-Picture support
  music/
    player.js           — Audio player, playlist, AudioContext
    playlist.js         — Playlist management
    visualizer.js       — Canvas audio visualizer
  engine/
    hlsEngine.js        — HLS (.m3u8) playback via hls.js
    dashEngine.js       — DASH (.mpd) playback via dash.js
    chunkEngine.js      — MP4 byte-range chunk streaming via MediaSource API
    bufferManager.js    — Buffer health monitoring
    mediaSourceHandler.js — MSE (MediaSource Extensions) wrapper
  teleparty/
    client.js           — WebSocket client
    room.js             — Room create/join/leave
    chat.js             — Chat UI
  ui/
    navigation.js       — Bottom nav, side panel system (admin/history/teleparty)
    orb.js              — Anti-gravity background orb animation
    transitions.js      — Flash icon helpers
  utils/
    eventBus.js         — Central pub/sub event system
    state.js            — Shared app state, watch history (localStorage)
    format.js           — Time formatting
    deviceCapability.js — Low-perf mode detection

server/
  server.js             — Express: content API, admin video CRUD, audio proxy, static serving
  socket.js             — WebSocket: teleparty room management
  rooms.js              — Room state

public/                 — PWA manifest, service worker, icons
render.yaml             — Render.com deployment config
```

## Features

- **Custom player** — all controls overlay the video, no native browser controls
- **Format auto-detection** — HLS (.m3u8), DASH (.mpd), MP4, WebM, etc.
- **Admin panel** — add any streaming URL via the gear icon; stored in localStorage
- **Teleparty** — watch-together rooms via WebSocket
- **Music player** — audio visualizer, playlist, shuffle/repeat
- **Watch history** — continue-watching with progress bars
- **PWA** — installable, service worker

## Dev Commands

```bash
npm run dev     # Start both Vite (5000) and Express (8080)
npm run build   # Build Vite frontend to dist/
npm start       # Production: serve everything from Express (NODE_ENV=production)
```

## Render Deployment

- Build command: `npm install && npm run build`
- Start command: `npm start`
- `NODE_ENV=production` is set in render.yaml

## Player Bug Fix (tap-overlay)

The controls overlay (`z-index: 2, pointer-events: none`) sits above the tap overlay (`z-index: 1`). Interactive children (`.controls-top/center/bottom`) have `pointer-events: all` so buttons work, while transparent areas fall through to the tap overlay for tap-to-play/pause.
