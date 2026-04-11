This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

TakeBreak is an Electron-based break reminder tool with **AI motion detection**. An HTTP server listens on port 3721; when `/heartbeat` or `/remind` is hit, it captures a screenshot, picks a scene at random, and opens a fullscreen kiosk window to play it. Motion scenes use MediaPipe for real-time pose detection.

## Commands

```bash
npm start                # Launch Electron app (starts HTTP server + opens windows on heartbeat)
npm test                 # curl http://localhost:3721/heartbeat
curl http://localhost:3721/health    # Health check
curl http://localhost:3721/scenes     # List discovered scenes
curl http://localhost:3721/remind    # Trigger a scene
curl http://localhost:3721/remind?scene=squat  # Trigger specific scene
```

Dependencies use npmmirror (configured in `.npmrc`). First-time setup: run `setup.bat`.

## Architecture

**main.js** is the single entry point combining:
- Electron main process (app lifecycle, BrowserWindow management)
- HTTP server (routes: `/heartbeat`, `/remind`, `/health`, `/scenes`, `/models/*`, `/api/scene-complete`)
- Scene discovery (scans `scenes/` for directories containing `index.html`)
- Screen capture via `desktopCapturer` and injection into scene HTML
- Static file serving for `/models/*` → `public/models/`

There is no build step or bundler. All code runs directly.

## Directory Structure

```
takeBreak/
├── main.js                 # Electron 主进程 + HTTP 服务器
├── package.json
├── public/
│   ├── models/             # MediaPipe 模型文件（公共）
│   │   ├── pose_landmarker_lite.task
│   │   ├── face_landmarker.task
│   │   └── hand_landmarker.task
│   ├── claude-logo-256.png
│   ├── claude-logo-512.png
│   └── claude-logo-1024.png
├── assets/                 # 项目素材（logos、音频等）
│   └── claude-logo.svg     # 官方 Claude Logo (1200x1200 SVG)
├── scenes/                 # 所有场景
│   ├── hammer/             # 静态动画场景
│   ├── cat-on-screen/
│   ├── cat-paw/
│   ├── squat/              # 运动场景：AI 深蹲计数
│   ├── drink-water/        # 运动场景（目录已建，待实现）
│   ├── liquid-glass/       # 静态（目录已建，待实现）
│   ├── merit-plus-one/      # 静态（目录已建，待实现）
│   └── ...
├── scenes-motion/          # ⚠️ 废弃旧目录，已迁移到 scenes/
├── docs/                   # 文档
│   ├── ARCHITECTURE.md     # 系统架构
│   ├── API-SPEC.md         # HTTP API 规格
│   ├── ALGORITHMS.md       # 检测算法
│   ├── SPEC-MOTION-SCENES.md  # 运动场景设计规格
│   ├── TASKS.md            # 开发任务清单
│   └── SPEC-MOTION-ENGINE.md  # 运动引擎规格
├── test/                   # 临时开发测试页
│   ├── index.html          # 合并测试页（face/pose/hand）
│   ├── test-motion.html     # 运动检测测试
│   └── test-skeleton-draw.html # 骨骼渲染测试
├── test-full-body.html     # ⚠️ 遗留测试文件，待清理到 test/
├── SCENE-GUIDE.md          # 场景开发指南（Spec-Driven Dev 流程）
└── CLAUDE.md               # 本文件
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

## Motion Detection

Motion scenes use **MediaPipe Tasks Vision** for real-time pose detection.

**Model files** stored in `public/models/`, served via `/models/*`:
- `pose_landmarker_lite.task` — 33 关键点姿态检测
- `face_landmarker.task` — 面部 478 关键点
- `hand_landmarker.task` — 手部 21 关键点

**Loading (in scene HTML)**:
```javascript
import { FilesetResolver, PoseLandmarker } from
  'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/vision_bundle.js';

const vision = await FilesetResolver.forVisionTasks(
  'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm'
);
const poseLandmarker = await PoseLandmarker.createFromOptions(vision, {
  baseOptions: { modelAssetPath: '/models/pose_landmarker_lite.task' },
  runningMode: 'VIDEO'
});
```

**Known issue**: FaceLandmarker `detectForVideo()` returns `undefined` in tasks-vision@0.10.14 (MediaPipe WASM bug). Use pose detection for body-based actions (squat, twist, etc.) until upstream is fixed.

## Current Scenes

| Scene ID | Type | Status |
|----------|------|--------|
| `hammer` | Static | ✅ Complete |
| `cat-on-screen` | Static | ✅ Complete |
| `cat-paw` | Static | ✅ Complete |
| `squat` | Motion | ✅ Complete |
| `liquid-glass` | Static | 📋 Planned |
| `merit-plus-one` | Static | 📋 Planned |
| `boss-is-coming` | Static | 📋 Planned |
| `breathing` | Static | 📋 Spec only |
| `drink-water` | Motion | 📋 Spec only |
| `twist` | Motion | 📋 Spec only |
| `fake-bsod` | Static | 📋 Spec only |
| `sunset` | Static | 📋 Spec only |

## Key Implementation Notes

- **Sound**: Scenes use Web Audio API for synthesized sounds (no external audio files needed).
- **Video assets**: Use `muted` + `autoplay` attributes. WebM with alpha channel for transparent overlays.
- **npm scripts**: `npm test` uses `curl --noproxy localhost` to bypass proxy settings.
- **Electron startup**: Due to `ELECTRON_RUN_AS_NODE` env var set by OpenClaw, use `set ELECTRON_RUN_AS_NODE=` before starting, or run `node_modules\electron\dist\electron.exe .` directly.
- **Development mode**: main.js currently hardcodes scene selection instead of random. Restore random before release.
