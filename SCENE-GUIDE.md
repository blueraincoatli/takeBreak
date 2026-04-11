# TakeBreak Scene 开发指南

## 概述

TakeBreak 是一个基于 Electron 的休息提醒工具，支持**静态动画场景**和**运动检测场景**两种类型。当收到 heartbeat 请求时，随机选取一个 scene，在全屏窗口中播放。运动场景使用 MediaPipe 进行实时姿态检测。

## 目录结构

```
takeBreak/
├── main.js                 # Electron 主进程 + HTTP 服务器
├── public/
│   └── models/            # MediaPipe 模型文件（公共，所有场景复用）
│       ├── pose_landmarker_lite.task   # 姿态检测 (5.7MB)
│       ├── face_landmarker.task         # 面部检测 (3.7MB) ⚠️ 有 bug
│       └── hand_landmarker.task         # 手部检测 (7.8MB)
├── scenes/                 # 所有场景目录
│   ├── hammer/             # 静态场景：SVG 动画
│   │   ├── manifest.json
│   │   └── index.html
│   ├── squat/               # 运动场景：深蹲计数
│   │   ├── manifest.json
│   │   └── index.html      # 内嵌 MediaPipe + 深蹲检测
│   └── ...
└── docs/                   # 文档
```

---

## 场景类型

### 静态场景 (Static Scene)

纯动画/视频场景，无需摄像头。适合动画特效、视频叠加、搞笑画面。

**实现方式：** SVG 动画、CSS 动画、视频播放、动态 WebP

**示例：** `hammer`、`cat-on-screen`、`cat-paw`

### 运动场景 (Motion Scene)

需要摄像头，使用 MediaPipe 进行实时姿态检测。

**实现方式：** MediaPipe Pose + Canvas 绘制 + 状态机

**示例：** `squat`（深蹲计数）

⚠️ **注意：** FaceLandmarker `detectForVideo()` 在 tasks-vision@0.10.14 有 WASM bug，返回 `undefined`。面部相关的检测暂不可用，建议使用 Pose 关键点估算。

---

## 框架机制

### 1. Scene 发现

`main.js` 扫描 `scenes/` 目录，满足以下条件的子目录会被识别为 scene：
- 是一个目录
- 包含 `index.html` 文件

目录名即为 scene id，请使用有意义的、不易重名的命名。

### 2. 触发流程

```
HTTP GET /remind
  -> captureScreen()          截取当前屏幕
  -> 随机选一个 scene（或指定 ?scene=<id>）
  -> 读取 manifest.json       获取 duration 等配置
  -> 创建全屏 BrowserWindow   frameless, always-on-top
  -> 加载 index.html
  -> did-finish-load 时注入截图
  -> duration + 2s 后自动关闭（或用户手动关闭）
```

### 3. 屏幕截图注入

框架会在页面加载完成后，自动将当前屏幕截图注入到 `.bg-screenshot` 元素：

```html
<div class="bg-screenshot"></div>
```

```css
.bg-screenshot {
    position: fixed; top: 0; left: 0;
    width: 100vw; height: 100vh;
    background: #000 no-repeat center center;
    background-size: 100vw 100vh;
    z-index: 0;
}
```

### 4. 关闭窗口

**手动关闭：**
```js
document.addEventListener('dblclick', () => window.close());
```

**完成通知（运动场景）：**
```js
await fetch('http://localhost:3721/api/scene-complete', { method: 'POST' });
setTimeout(() => window.close(), 1500);
```

---

## manifest.json 格式

```json
{
  "id": "scene-id",
  "name": "显示名称",
  "description": "描述",
  "type": "static",
  "duration": 8,
  "difficulty": "easy",
  "requirements": {
    "camera": false,
    "fullscreen": true
  },
  "config": {
    "targetCount": 5
  }
}
```

| 字段 | 必需 | 说明 |
|------|------|------|
| `id` | ✅ | 建议与目录名一致 |
| `type` | | `static`（默认）或 `motion` |
| `duration` | | 单位秒，默认 8；实际关闭时间 = duration + 2s |
| `requirements.camera` | | `true` 表示需要摄像头 |

---

## 运动场景开发

### 模型加载

模型文件存放在 `public/models/`，通过 `/models/<filename>` 访问：

```javascript
import { FilesetResolver, PoseLandmarker } from
  'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/vision_bundle.js';

const vision = await FilesetResolver.forVisionTasks(
  'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm'
);

const poseLandmarker = await PoseLandmarker.createFromOptions(vision, {
  baseOptions: {
    modelAssetPath: '/models/pose_landmarker_lite.task',
    delegate: 'CPU'
  },
  runningMode: 'VIDEO',
  numPoses: 1
});
```

### 检测循环

```javascript
function detectLoop() {
  const now = performance.now();
  const results = poseLandmarker.detectForVideo(video, now);

  if (results.landmarks?.length > 0) {
    drawSkeleton(results.landmarks[0]);
    analyzeAction(results.landmarks[0]);
  }

  requestAnimationFrame(detectLoop);
}
```

### Pose 关键点索引

```
MediaPipe Pose 33 关键点：

0-10:   面部 (nose, eyes, ears, mouth)
11-12:  肩膀 (shoulders)
13-14:  肘部 (elbows)
15-16:  手腕 (wrists)
17-22:  手部细节
23-24:  髋部 (hips) ← 深蹲检测关键
25-26:  膝盖 (knees) ← 深蹲检测关键
27-28:  脚踝 (ankles)
29-32:  脚部细节
```

### 深蹲检测示例

```javascript
// 三点角度计算
function threePointAngle(a, b, c) {
  const v1 = { x: a.x - b.x, y: a.y - b.y };
  const v2 = { x: c.x - b.x, y: c.y - b.y };
  const dot = v1.x*v2.x + v1.y*v2.y;
  const mag = Math.sqrt(v1.x*v1.x + v1.y*v1.y) * Math.sqrt(v2.x*v2.x + v2.y*v2.y);
  return Math.acos(Math.max(-1, Math.min(1, dot / mag))) * 180 / Math.PI;
}

// 检测状态
let squatPhase = 'stand';
let squatCount = 0;
const SQUAT_ANGLE = 110;  // 低于此值 = 下蹲中
const STAND_ANGLE = 160;  // 高于此值 = 站起

function detectSquat(lm) {
  const lHip = lm[23], lKnee = lm[25], lAnkle = lm[27];
  const rHip = lm[24], rKnee = lm[26], rAnkle = lm[28];
  if (!lHip || !rHip) return;

  const avgAngle = (
    threePointAngle(lHip, lKnee, lAnkle) +
    threePointAngle(rHip, rKnee, rAnkle)
  ) / 2;

  if (squatPhase === 'stand' && avgAngle < SQUAT_ANGLE) {
    squatPhase = 'down';
  } else if (squatPhase === 'down' && avgAngle > STAND_ANGLE) {
    squatPhase = 'stand';
    squatCount++;
  }
}
```

---

## 素材类型对比

| 维度 | SVG 动画 | 视频 (MP4/WebM) | 动态 WebP |
|------|---------|----------------|-----------|
| 文件大小 | KB 级 | MB 级 | 几百KB~几MB |
| 真实感 | 抽象/卡通 | 真实画面 | 介于两者之间 |
| 透明叠加 | 天然支持 | 需 WebM alpha | 支持（有损） |
| 动画控制 | 精确（CSS/JS） | 有限 | 自动循环 |
| 适用场景 | 图形特效、物体运动 | 真实拍摄 | AI 素材、短循环 |

---

## 模板

### 静态场景

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <title>Scene 名称</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { overflow: hidden; position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; }
        .bg-screenshot { position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background-size: 100vw 100vh; z-index: 0; }
        .overlay { position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; z-index: 10000; }
    </style>
</head>
<body>
    <div class="bg-screenshot"></div>
    <div class="overlay" id="overlay">
        <!-- 你的内容 -->
    </div>
    <script>
        document.getElementById('overlay').addEventListener('dblclick', () => window.close());
    </script>
</body>
</html>
```

### 运动场景

参考 `scenes/squat/index.html`（已完成的深蹲场景），包含完整的摄像头、MediaPipe、骨骼绘制、计数逻辑。

---

## 调试方法

```bash
curl http://localhost:3721/heartbeat           # 触发随机场景
curl http://localhost:3721/remind?scene=squat  # 触发指定场景
curl http://localhost:3721/scenes               # 查看所有场景
curl http://localhost:3721/health               # 健康检查
```

---

## HTTP API

| 路由 | 方法 | 说明 |
|------|------|------|
| `/heartbeat` | GET | 触发随机场景 |
| `/remind` | GET | 同上，支持 `?scene=<id>` 指定场景 |
| `/scenes` | GET | 列出所有场景及其 manifest |
| `/health` | GET | 应用状态 |
| `/models/<file>` | GET | 返回 `public/models/` 下的模型文件 |
| `/api/scene-complete` | POST | 运动场景完成通知 |

---

# Spec 开发流程

所有新 Scene 开发遵循 Spec-Driven Development：先写 SPEC.md，再实现。

## SPEC.md 章节清单

```
1. 概述（场景目标和风格）
2. 目标定义 + DoD（成功标准）
3. 技术方案
4. 动画时序设计
5. 实施步骤 Checklist
6. 检测方法
7. 失败处理
8. 迭代记录
9. 文案池
```

## 当前场景状态

| Scene ID | Type | 状态 |
|----------|------|------|
| `hammer` | Static | ✅ 已完成 |
| `cat-on-screen` | Static | ✅ 已完成 |
| `cat-paw` | Static | ✅ 已完成 |
| `squat` | Motion | ✅ 已完成 |
| `drink-water` | Motion | 📋 规划中 |
| `twist` | Motion | 📋 规划中 |
| `achievement` | Static | 📋 Spec only |
| `breathing` | Static | 📋 Spec only |
| `fake-bsod` | Static | 📋 Spec only |
| `sunset` | Static | 📋 Spec only |
