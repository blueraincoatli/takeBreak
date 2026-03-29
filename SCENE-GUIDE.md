# TakeBreak Scene 开发指南

## 概述

TakeBreak 是一个基于 Electron 的休息提醒工具。当收到 heartbeat 请求时，随机选取一个 scene，在全屏窗口中播放。Scene 本质上是一个独立的 HTML 页面，可以使用任意前端技术实现动画效果。

## 目录结构

```
takeBreak/
  main.js                 # Electron 主进程 + HTTP 服务器
  package.json
  scenes/                 # 所有 scene 存放于此
    hammer/               # scene 目录名 = scene id
      manifest.json       # 元信息（必需）
      index.html          # 主页面（必需）
      hammer.svg          # 素材文件（可选，按需放置）
    cat-on-screen/
      manifest.json
      index.html
      cat-on-screen.mp4   # 视频素材（可选，按需放置）
```

### 最小 scene 结构

一个 scene 只需要两个文件：

```
scenes/my-scene/
  manifest.json
  index.html
```

## 框架机制

### 1. Scene 发现

`main.js` 扫描 `scenes/` 目录，满足以下条件的子目录会被识别为 scene：

- 是一个目录
- 包含 `index.html` 文件

```js
// main.js 中的发现逻辑
function getScenes() {
  return fs.readdirSync(SCENES_DIR).filter(f =>
    fs.statSync(path.join(SCENES_DIR, f)).isDirectory() &&
    fs.existsSync(path.join(SCENES_DIR, f, 'index.html'))
  );
}
```

**目录名即为 scene id**，请使用有意义的、不易重名的命名（如 `hammer`、`cat-on-screen`）。

### 2. 触发流程

```
HTTP GET /heartbeat
  -> captureScreen()          截取当前屏幕
  -> 随机选一个 scene
  -> 读取 manifest.json       获取 duration 等配置
  -> 创建全屏 BrowserWindow   frameless, always-on-top
  -> 加载 index.html
  -> did-finish-load 时注入截图
  -> duration + 2s 后自动关闭
```

### 3. 屏幕截图注入

框架会在页面加载完成后，自动将当前屏幕截图注入到 `.bg-screenshot` 元素：

```js
// main.js 自动执行
document.querySelector('.bg-screenshot').style.backgroundImage = 'url("file:///...")'
```

因此你的 HTML 中只需要放一个 `.bg-screenshot` 元素，框架会自动填入截图：

```html
<div class="bg-screenshot"></div>
```

对应的基础样式：

```css
.bg-screenshot {
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    background: #000 no-repeat center center;
    background-size: 100vw 100vh;
    z-index: 0;
}
```

### 4. 自动关闭

框架在 `manifest.duration + 2` 秒后自动关闭窗口。用户也可以点击页面主动关闭：

```js
document.addEventListener('click', () => {
    window.close();  // Electron 中直接关闭窗口
});
```

## manifest.json 格式

```json
{
  "id": "scene-id",           // 必需，与目录名保持一致
  "name": "显示名称",          // 可选，用于 /scenes API 返回
  "author": "author",         // 可选
  "description": "描述",      // 可选
  "duration": 8,              // 可选，单位秒，默认 8
  "tags": ["标签"],           // 可选
  "version": "1.0.0"          // 可选
}
```

**关键字段**：
- `id` — 建议与目录名一致
- `duration` — 控制自动关闭时间，实际关闭时间为 `duration + 2` 秒

## 素材类型对比

### SVG 动画（如 hammer 场景）

**适用场景**：图形化的动画效果，如物体运动、形变、特效

```
scenes/hammer/
  index.html        # 包含所有动画逻辑
  hammer.svg        # SVG 素材
```

**引用方式**：

```html
<img src="hammer.svg" alt="hammer">
```

**特点**：
- 文件小（KB 级别）
- 矢量缩放不失真
- 可以用 CSS animation / JS 控制动画
- 适合抽象图形、图标、特效
- 不适合表现真实世界的复杂画面

**动画实现方式**：
- CSS `@keyframes` + `animation` — 简单的位移动画
- CSS `transform` — 旋转、缩放、透视
- SVG 内联 + JS 操作 — 复杂路径动画
- Web Audio API — 合成音效（无需外部音频文件）

### 视频（如 cat-on-screen 场景）

**适用场景**：真实拍摄的内容，需要表现自然、连续的画面

```
scenes/cat-on-screen/
  index.html
  cat-on-screen.mp4    # 视频素材
```

**引用方式**：

```html
<video autoplay loop muted playsinline>
    <source src="cat-on-screen.mp4" type="video/mp4">
    <source src="cat-on-screen.webm" type="video/webm">
</video>
```

**特点**：
- 文件较大（MB 级别）
- 真实感强
- 需要注意自动播放策略：必须 `muted` + `autoplay`
- 可以叠加 CSS 效果（阴影、滤镜、混合模式）
- `loop` 属性使视频循环播放

**透明背景视频**：
- WebM 格式支持 alpha 通道（透明背景）
- 抠图后导出为 `.webm` 即可在页面上实现透明叠加
- 效果：视频中的猫咪覆盖在屏幕截图上，背景透出

### 对比总结

| 维度 | SVG 动画 | 视频素材 |
|------|---------|---------|
| 文件大小 | KB 级 | MB 级 |
| 真实感 | 抽象/卡通 | 真实画面 |
| 透明叠加 | 天然支持 | 需 WebM alpha |
| 动画控制 | 精确（CSS/JS） | 有限（播放/暂停） |
| 音效 | Web Audio API 合成 | 视频内嵌或合成 |
| 适用场景 | 图形特效、物体运动 | 真实拍摄、自然画面 |

## HTML 页面模板

### 基础结构

所有 scene 的 HTML 都应遵循以下基础结构：

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Scene 名称</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }

        body {
            margin: 0; padding: 0; overflow: hidden;
            position: fixed; top: 0; left: 0;
            width: 100vw; height: 100vh;
            font-family: 'Microsoft YaHei', 'PingFang SC', sans-serif;
        }

        /* 必需：接收框架注入的屏幕截图 */
        .bg-screenshot {
            position: fixed; top: 0; left: 0;
            width: 100vw; height: 100vh;
            background: #000 no-repeat center center;
            background-size: 100vw 100vh;
            z-index: 0;
        }

        /* 你的内容层 */
        .overlay {
            position: fixed; top: 0; left: 0;
            width: 100vw; height: 100vh;
            z-index: 10000;
            cursor: pointer;  /* 提示用户可点击关闭 */
        }

        /* 你的样式... */
    </style>
</head>
<body>
    <div class="bg-screenshot"></div>
    <div class="overlay" id="overlay">
        <!-- 你的内容 -->
    </div>
    <script>
        // 点击关闭
        document.getElementById('overlay').addEventListener('click', () => {
            const overlay = document.getElementById('overlay');
            overlay.style.transition = 'opacity 0.3s';
            overlay.style.opacity = '0';
            setTimeout(() => window.close(), 300);
        });
    </script>
</body>
</html>
```

### 注意事项

1. **必须有 `.bg-screenshot` 元素** — 框架通过这个 class 注入屏幕截图
2. **全屏布局** — 使用 `position: fixed` + `100vw/100vh` 覆盖全屏
3. **z-index 分层** — 背景截图 z-index: 0，内容层 z-index: 10000+
4. **点击关闭** — 调用 `window.close()` 即可在 Electron 中关闭窗口
5. **禁止 nodeIntegration** — 窗口创建时已关闭，HTML 中只能用浏览器原生 API

## 常用技巧

### 合成音效（无需音频文件）

```js
function playSound() {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(440, ctx.currentTime);
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.5);
}
```

### CSS 动画时序

利用 `animation-delay` 编排动画序列：

```css
.element-1 { animation: fadeIn 0.5s ease 0.3s forwards; }   /* 0.3s 后出现 */
.element-2 { animation: fadeIn 0.5s ease 0.8s forwards; }   /* 0.8s 后出现 */
.element-3 { animation: slideIn 1s ease 1.2s forwards; }    /* 1.2s 后滑入 */
```

### 视频叠加效果

```css
/* 视频上加阴影，增强立体感 */
video {
    filter: drop-shadow(0 10px 30px rgba(0,0,0,0.5));
}

/* 视频在屏幕截图上方，制造"挡住屏幕"的效果 */
.video-container {
    position: fixed;
    bottom: 0;
    width: 70vw;
    z-index: 10002;
}
```

## 调试方法

1. 启动应用：`npm start`
2. 触发场景：`curl http://localhost:3721/heartbeat`
3. 查看所有场景：`curl http://localhost:3721/scenes`
4. 健康检查：`curl http://localhost:3721/health`

## API 接口

| 接口 | 方法 | 说明 |
|------|------|------|
| `/heartbeat` | GET | 触发随机 scene |
| `/remind` | GET | 同 `/heartbeat` |
| `/health` | GET | 应用状态信息 |
| `/scenes` | GET | 列出所有 scene 及其 manifest 信息 |

---

# Spec 开发流程

## 概述

所有新 Scene 开发必须遵循 Spec-Driven Development 模式，确保目标明确、过程可控、结果可验证。

---

## 核心原则

1. **先规划后动手** — 创建目录 + 编写 SPEC.md，再开始实现
2. **Definition of Done** — 明确定义"完成"的标准
3. **迭代限制** — 设定最大迭代轮数，避免无限循环
4. **失败预案** — 预想可能的失败场景和处理方案

---

## 开发流程

### Phase 1: 规划阶段

```
1. 确定场景创意和目标
2. 创建 scenes/<scene-id>/ 目录
3. 编写 SPEC.md，包含：
   - 概述
   - 目标定义 + 成功标准（DoD）
   - 技术方案
   - 动画时序设计
   - 实施步骤（Checklist）
   - 检测方法
   - 失败处理
   - 迭代规则
   - 文案池
```

### Phase 2: 实现阶段

```
1. 按 SPEC.md 中的实施步骤依次完成
2. 每完成一步，在 Checklist 中打勾
3. 完成一个完整迭代后，进入检测阶段
```

### Phase 3: 检测阶段

```
1. 运行自动化检测命令
2. 执行手动检测清单
3. 对比 DoD 标准
```

### Phase 4: 迭代/完成

```
IF 所有 DoD 标准达成:
    → 标记完成，更新迭代记录

ELSE IF 未达到最大迭代轮数:
    → 记录遗留问题
    → 进入下一轮迭代
    → 返回 Phase 2

ELSE (达到最大迭代轮数):
    → 记录遗留问题到 backlog
    → 标记为"待优化"状态
    → 继续下一个场景开发
```

---

## SPEC.md 模板

每个场景的 SPEC.md 必须包含以下章节：

```markdown
# SPEC: <scene-id>（中文名称）

## 概述
[一句话描述场景的目标和风格]

---

## 目标定义

### 核心目标
[场景要达成的核心目的]

### 成功标准（Definition of Done）

| 标准 | 检测方法 |
|------|---------|
| [具体标准 1] | [如何验证] |
| [具体标准 2] | [如何验证] |
| ... | ... |

---

## 技术方案

### 实现方式
- [使用的技术：SVG动画/视频/CSS动画等]

### 动画时序设计

```
0.0s - [事件 1]
0.5s - [事件 2]
...
N.Ns - 自动关闭
```

---

## 实施步骤

### Step 1: [阶段名称]
- [ ] [具体任务 1]
- [ ] [具体任务 2]

### Step 2: [阶段名称]
...

---

## 检测方法

### 自动化检测
```bash
curl http://localhost:3721/scenes | grep <scene-id>
```

### 手动检测清单
- [ ] [检测项 1]
- [ ] [检测项 2]
...

---

## 失败处理

| 问题类型 | 处理方案 |
|---------|---------|
| [问题 1] | [解决方案] |
| [问题 2] | [解决方案] |

---

## 迭代规则

- **最大迭代轮数**：3 轮
- **单轮时间限制**：30 分钟
- **停止条件**：所有 DoD 标准达成 或 达到最大迭代轮数

### 迭代记录

| 轮次 | 时间 | 完成项 | 遗留问题 | 状态 |
|-----|------|-------|---------|-----|
| 1 | - | - | - | 待开始 |

---

## 文案池

```
[文案 1]
[文案 2]
...
```
```

---

## 当前场景规划

| Scene ID | 风格 | 状态 |
|----------|-----|------|
| `hammer` | 夸张搞笑 | ✅ 已完成 |
| `cat-paw` | 趣味互动 | 📋 规划中 |
| `sunset` | 温馨治愈 | 📋 规划中 |
| `fake-bsod` | 搞笑夸张 | 📋 规划中 |
| `breathing` | 极简优雅 | 📋 规划中 |
| `achievement` | 游戏化 | 📋 规划中 |

---

## 快速开始

开发新场景的标准命令序列：

```bash
# 1. 创建目录
mkdir D:\takeBreak\scenes\<scene-id>

# 2. 创建 SPEC.md（使用上述模板）
# 3. 创建 manifest.json
# 4. 创建 index.html
# 5. 测试
curl.exe http://localhost:3721/remind
```
