# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

TakeBreak is an Electron-based break reminder tool. An HTTP server listens on port 3721; when `/heartbeat` or `/remind` is hit, it captures a screenshot, picks a scene at random, and opens a fullscreen kiosk window to play it.

## Commands

```bash
npm start                # Launch Electron app (starts HTTP server + opens windows on heartbeat)
npm test                 # curl http://localhost:3721/heartbeat
curl http://localhost:3721/health    # Health check
curl http://localhost:3721/scenes    # List discovered scenes
curl http://localhost:3721/remind    # Trigger a scene
```

Dependencies use npmmirror (configured in `.npmrc`). First-time setup: run `setup.bat`.

## Architecture

**main.js** is the single entry point combining:
- Electron main process (app lifecycle, BrowserWindow management)
- HTTP server (routes: `/heartbeat`, `/remind`, `/health`, `/scenes`)
- Scene discovery (scans `scenes/` for directories containing `index.html`)
- Screen capture via `desktopCapturer` and injection into scene HTML

There is no build step or bundler. All code runs directly.

## Scene System

Each scene is a self-contained directory under `scenes/<scene-id>/`:

```
scenes/<scene-id>/
  manifest.json   # Required: { id, name, duration, ... }
  index.html      # Required: standalone HTML page with all CSS/JS inline
  <assets>        # Optional: images, video, SVG
```

**Scene discovery**: `getScenes()` in main.js lists subdirectories of `scenes/` that contain `index.html`. Directory name = scene id.

**Trigger flow**: HTTP request -> `captureScreen()` -> pick scene -> read `manifest.json` for duration -> create fullscreen BrowserWindow -> load index.html -> inject screenshot as `background-image` on `.bg-screenshot` element.

**Scene HTML requirements**:
- Must contain a `.bg-screenshot` element (framework injects screenshot here)
- Content layer at `z-index: 10000+`
- Use `window.close()` for click-to-close
- Only browser-native APIs available (`nodeIntegration: false`, `contextIsolation: true`)
- `manifest.duration` controls auto-close time (actual = duration + 2s)

**New scene development**: Follow Spec-Driven Development per `SCENE-GUIDE.md` - create SPEC.md first with DoD, implement, then verify.

## Current Scenes

| Scene ID | Style | Status |
|----------|-------|--------|
| `hammer` | Exaggerated comedy (SVG animation) | Complete |
| `cat-on-screen` | Cat video overlay on screen | Complete |
| `cat-paw` | Animated WebP cat paw | Complete |
| `achievement` | Gamified | Spec only |
| `breathing` | Minimal/elegant | Spec only |
| `fake-bsod` | Fake blue screen | Spec only |
| `sunset` | Warm/wholesome | Spec only |

## Key Implementation Notes

- **Development mode**: main.js currently hardcodes `sceneName = 'cat-on-screen'` instead of random selection. Restore random selection before release.
- **Sound**: Scenes use Web Audio API for synthesized sounds (no external audio files needed).
- **Video assets**: Use `muted` + `autoplay` attributes. WebM with alpha channel for transparent overlays.
- **npm scripts**: `npm test` uses `curl --noproxy localhost` to bypass proxy settings.
