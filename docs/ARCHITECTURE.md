# takeBreak 技术架构文档 (ARCHITECTURE.md)

## 1. 系统架构图

```
┌─────────────────────────────────────────────────────────────┐
│                    Electron Main Process                     │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │  Scheduler  │  │  Scene Mgr  │  │  Static File Server │  │
│  │  (定时器)    │  │  (场景管理)  │  │  (/models/*)        │  │
│  └──────┬──────┘  └──────┬──────┘  └──────────┬──────────┘  │
└─────────┼────────────────┼────────────────────┼─────────────┘
          │                │                    │
          ▼                ▼                    ▼
┌─────────────────────────────────────────────────────────────┐
│                  Electron Renderer Process                   │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐    │
│  │              Scene Container (HTML)                  │    │
│  │                                                      │    │
│  │   ┌─────────────┐    ┌─────────────────────────┐    │    │
│  │   │ Static Scene│    │     Motion Scene        │    │    │
│  │   │ (动画/图片)  │    │  ┌─────────────────┐    │    │    │
│  │   │             │    │  │  Camera Layer   │    │    │    │
│  │   │ cat-on-screen│    │  │  ├─ Video       │    │    │    │
│  │   │ hammer      │    │  │  └─ Skeleton    │    │    │    │
│  │   │ sunset      │    │  │                 │    │    │    │
│  │   │ ...         │    │  │  Detection Layer│    │    │    │
│  │   └─────────────┘    │  │  ├─ MediaPipe   │    │    │    │
│  │                      │  │  └─ Analyzers   │    │    │    │
│  │                      │  │                 │    │    │    │
│  │                      │  │  UI Layer       │    │    │    │
│  │                      │  │  ├─ Counter     │    │    │    │
│  │                      │  │  ├─ Feedback    │    │    │    │
│  │                      │  │  └─ Progress    │    │    │    │
│  │                      │  └─────────────────┘    │    │    │
│  │                      │                         │    │    │
│  │                      │  drink-water, squat,   │    │    │
│  │                      │  twist, pushup...      │    │    │
│  │                      └─────────────────────────┘    │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. 目录结构

```
takeBreak/
├── main.js                 # Electron 主进程 + HTTP 服务器
├── package.json
├── public/
│   └── models/             # MediaPipe 模型文件（公共，供所有场景复用）
│       ├── pose_landmarker_lite.task   # 姿态检测 (5.7MB)
│       ├── face_landmarker.task        # 面部检测 (3.7MB)
│       └── hand_landmarker.task        # 手部检测 (7.8MB)
├── scenes/                 # 所有场景目录
│   ├── hammer/             # 静态场景：SVG 动画
│   │   ├── manifest.json
│   │   ├── index.html
│   │   └── hammer.svg
│   ├── cat-on-screen/      # 静态场景：视频叠加
│   ├── cat-paw/            # 静态场景：动态 WebP
│   ├── squat/              # 运动场景：深蹲计数
│   │   ├── manifest.json
│   │   └── index.html      # 内嵌 MediaPipe + 深蹲检测逻辑
│   ├── drink-water/        # 运动场景（规划中）
│   └── ...
├── docs/                   # 文档
│   ├── ARCHITECTURE.md
│   ├── API-SPEC.md
│   ├── ALGORITHMS.md
│   └── ...
└── SCENE-GUIDE.md          # 场景开发指南
```

---

## 3. 模块依赖关系

```
public/models/               # 静态资源，通过 HTTP 提供服务
     │
     └──► /models/xxx.task  # 场景通过此 URL 加载模型

scenes/<scene-id>/
├── index.html              # 自包含，无外部依赖
│   ├── CSS (内嵌)
│   ├── JS (内嵌，ES Module)
│   └── MediaPipe CDN
│
└── manifest.json           # 元数据
```

**场景加载模型流程：**
```
1. 场景 index.html 加载
2. import MediaPipe from CDN
3. FilesetResolver.forVisionTasks(CDN_WASM_PATH)
4. PoseLandmarker.createFromOptions({ modelAssetPath: '/models/pose_landmarker_lite.task' })
5. main.js 接收 /models/ 请求，返回 public/models/ 下的文件
```

---

## 4. 数据流

### 4.1 静态场景数据流

```
Scheduler (定时触发)
     │
     ▼
Select Scene
     │
     ▼
Capture Screen Screenshot
     │
     ▼
Load Scene HTML
     │
     ▼
Inject Screenshot into .bg-screenshot
     │
     ▼
Play Animation
     │
     ▼
User closes OR timeout → window.close()
```

### 4.2 运动场景数据流

```
Scheduler (定时触发)
     │
     ▼
Select Motion Scene (e.g., squat)
     │
     ▼
Load Scene HTML
     │
     ├──► Request Camera Permission
     │
     ├──► Load MediaPipe Model from /models/
     │
     ▼
Start Detection Loop
     │
     ├──► Camera Frame
     │         │
     │         ▼
     │    MediaPipe Pose Landmarker
     │         │
     │         ▼
     │    PoseResult (33 landmarks)
     │         │
     │         ├──► Action Analyzer (squat detection)
     │         │          │
     │         │          ▼
     │         │    Update Counter / Feedback
     │         │
     │         └──► Skeleton Renderer
     │
     ▼
Target reached → POST /api/scene-complete → window.close()
```

---

## 5. HTTP API

| 路由 | 方法 | 说明 |
|------|------|------|
| `/heartbeat` | GET | 触发随机场景 |
| `/remind` | GET | 同 `/heartbeat`，支持 `?scene=<id>` 指定场景 |
| `/health` | GET | 应用状态信息 |
| `/scenes` | GET | 列出所有场景及其 manifest 信息 |
| `/models/<file>` | GET | 返回 `public/models/<file>` 模型文件 |
| `/api/scene-complete` | POST | 场景完成通知，关闭窗口 |

---

## 6. 关键接口

### 6.1 Scene Manifest

```json
{
  "id": "squat",
  "name": "深蹲挑战",
  "description": "完成5个深蹲，AI实时计数",
  "type": "motion",
  "duration": 60,
  "difficulty": "medium",
  "requirements": {
    "camera": true,
    "fullscreen": true
  },
  "config": {
    "targetCount": 5,
    "actionType": "squat"
  }
}
```

### 6.2 Pose Landmark 索引

```
MediaPipe Pose 33 关键点：

0-10:   面部 (nose, eyes, ears, mouth)
11-12:  肩膀 (shoulders)
13-14:  肘部 (elbows)
15-16:  手腕 (wrists)
17-22:  手部细节 (pinky, index, thumb)
23-24:  髋部 (hips)
25-26:  膝盖 (knees)
27-28:  脚踝 (ankles)
29-32:  脚部细节 (heels, foot index)
```

### 6.3 深蹲检测状态机

```
STANDING → DESCENDING → BOTTOM → ASCENDING → (count++) → STANDING
    ↑                                                      │
    └──────────────────────────────────────────────────────┘

触发条件：
- STANDING → DESCENDING: 膝角 < 110°
- DESCENDING → BOTTOM: 膝角 < 90°
- BOTTOM → ASCENDING: 膝角开始增大
- ASCENDING → STANDING: 膝角 > 160°，计数+1
```

---

## 7. 性能考虑

### 7.1 渲染优化

| 优化点 | 策略 |
|--------|------|
| 骨骼绘制 | 使用 requestAnimationFrame |
| 视频处理 | 降低分辨率 (640x480) |
| 检测频率 | ~12 fps，跳过中间帧 |
| 内存管理 | 场景关闭时释放资源 |

### 7.2 模型加载

| 优化点 | 策略 |
|--------|------|
| 模型存储 | 本地 `public/models/`，避免每次下载 |
| WASM 加载 | 从 CDN 加载，浏览器缓存 |
| 首次加载 | 显示加载动画，预估时间 |

---

## 8. 安全与隐私

### 8.1 摄像头权限

- 首次使用时由浏览器自动申请权限
- 场景关闭后摄像头自动停止
- 明确提示"摄像头仅本地处理"

### 8.2 数据处理

- 视频流**仅本地处理**，不录制，不上传
- MediaPipe WASM 在浏览器沙箱中运行
- 不保存任何图像/视频数据

### 8.3 代码安全

- 运动检测代码在渲染进程运行（沙箱）
- 主进程仅做调度和静态文件服务
- `nodeIntegration: false`, `contextIsolation: true`

---

## 9. 技术栈

| 层级 | 技术 |
|------|------|
| 桌面框架 | Electron |
| 运动检测 | MediaPipe Tasks Vision |
| 可视化 | Canvas 2D |
| 模型分发 | HTTP 静态文件服务 |
| 构建工具 | 无（原生 ES Modules） |

---

*Created: 2026-04-09*
*Updated: 2026-04-11*
*Status: Active*
