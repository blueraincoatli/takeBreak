# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

TakeBreak is an Electron-based break reminder tool with **AI motion detection**. An HTTP server listens on port 3721; when `/heartbeat` or `/remind` is hit, it captures a screenshot, picks a scene at random, and opens a fullscreen kiosk window to play it. Motion scenes use MediaPipe for real-time pose detection.

## Commands

```bash
npm start                # Launch Electron app (starts HTTP server + opens windows on heartbeat)
npm test                 # curl http://localhost:3721/heartbeat
curl http://localhost:3721/health    # Health check
curl http://localhost:3721/scenes    # List discovered scenes
curl http://localhost:3721/remind    # Trigger a scene
curl http://localhost:3721/remind?scene=squat  # Trigger specific scene
```

Dependencies use npmmirror (configured in `.npmrc`). First-time setup: run `setup.bat`.

## Architecture

**main.js** is the single entry point combining:
- Electron main process (app lifecycle, BrowserWindow management)
- HTTP server (routes: `/heartbeat`, `/remind`, `/health`, `/scenes`, `/models/*`)
- Scene discovery (scans `scenes/` for directories containing `index.html`)
- Screen capture via `desktopCapturer` and injection into scene HTML
- Static file serving for `/models/` → `public/models/`

There is no build step or bundler. All code runs directly.

## Directory Structure

```
takeBreak/
├── main.js                 # Electron 主进程 + HTTP 服务器
├── public/
│   └── models/             # MediaPipe 模型文件（公共）
│       ├── pose_landmarker_lite.task
│       ├── face_landmarker.task
│       └── hand_landmarker.task
├── scenes/                 # 所有场景
│   ├── hammer/             # 静态动画场景
│   ├── cat-on-screen/
│   ├── squat/              # 运动检测场景
│   └── ...
└── docs/                   # 文档
```

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
- Use `window.close()` for click-to-close, or POST to `/api/scene-complete`
- Only browser-native APIs available (`nodeIntegration: false`, `contextIsolation: true`)
- `manifest.duration` controls auto-close time (actual = duration + 2s)

**New scene development**: Follow Spec-Driven Development per `SCENE-GUIDE.md` - create SPEC.md first with DoD, implement, then verify.

## Motion Detection

Motion scenes use **MediaPipe Tasks Vision** for real-time pose detection.

**Model files** are stored in `public/models/` and served via `/models/*` route:
- `pose_landmarker_lite.task` — 33 关键点姿态检测
- `face_landmarker.task` — 面部 478 关键点
- `hand_landmarker.task` — 手部 21 关键点

**Usage in scene**:
```javascript
const vision = await FilesetResolver.forVisionTasks(
  'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm'
);
const poseLandmarker = await PoseLandmarker.createFromOptions(vision, {
  baseOptions: { modelAssetPath: '/models/pose_landmarker_lite.task' },
  runningMode: 'VIDEO'
});
```

**Known issue**: FaceLandmarker `detectForVideo()` has a WASM bug that returns `undefined`. Use pose detection for body-based actions (squat, twist, etc.) until fixed.

## Current Scenes

| Scene ID | Type | Style | Status |
|----------|------|-------|--------|
| `hammer` | Static | Exaggerated comedy (SVG animation) | ✅ Complete |
| `cat-on-screen` | Static | Cat video overlay on screen | ✅ Complete |
| `cat-paw` | Static | Animated WebP cat paw | ✅ Complete |
| `squat` | Motion | AI 深蹲计数 | ✅ Complete |
| `drink-water` | Motion | AI 喝水检测 | 📋 Planned |
| `twist` | Motion | AI 转体运动 | 📋 Planned |
| `achievement` | Static | Gamified | 📋 Spec only |
| `breathing` | Static | Minimal/elegant | 📋 Spec only |
| `fake-bsod` | Static | Fake blue screen | 📋 Spec only |
| `sunset` | Static | Warm/wholesome | 📋 Spec only |

## Key Implementation Notes

- **Development mode**: main.js currently hardcodes `sceneName = 'cat-on-screen'` instead of random selection. Restore random selection before release.
- **Sound**: Scenes use Web Audio API for synthesized sounds (no external audio files needed).
- **Video assets**: Use `muted` + `autoplay` attributes. WebM with alpha channel for transparent overlays.
- **npm scripts**: `npm test` uses `curl --noproxy localhost` to bypass proxy settings.
- **Electron startup**: Due to `ELECTRON_RUN_AS_NODE` env var set by OpenClaw, use `set ELECTRON_RUN_AS_NODE=` before starting, or run `node_modules\electron\dist\electron.exe .` directly.
