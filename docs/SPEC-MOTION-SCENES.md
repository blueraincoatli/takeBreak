# 运动场景设计规格 (SPEC-MOTION-SCENES.md)

## 1. 场景概述

运动场景是 takeBreak 的交互界面，结合动画、摄像头检测和实时反馈。

**通用设计原则：**
- 全屏沉浸式体验
- 清晰的视觉引导
- 实时反馈动作质量
- 趣味化的完成奖励

---

## 2. 场景通用结构

```
scenes-motion/{scene-name}/
├── manifest.json          # 场景元数据
├── index.html            # 主页面
├── style.css             # 样式
├── app.js                # 场景逻辑
├── detector.js           # 检测器配置（可选）
└── assets/               # 资源文件
    ├── sounds/           # 音效
    └── images/           # 图片
```

### 2.1 manifest.json 规范

```json
{
  "id": "squat",
  "name": "深蹲挑战",
  "description": "完成10个深蹲，AI实时计数",
  "type": "motion",
  "duration": 60,
  "difficulty": "medium",
  "requirements": {
    "camera": true,
    "fullscreen": true
  },
  "config": {
    "targetCount": 10,
    "actionType": "squat",
    "feedbackLevel": "detailed"
  }
}
```

### 2.2 index.html 通用模板

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{scene-name}</title>
  <link rel="stylesheet" href="style.css">
  <!-- MediaPipe -->
  <script src="https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3"></script>
</head>
<body>
  <!-- 背景层 -->
  <div class="bg-screenshot"></div>
  <div class="bg-overlay"></div>

  <!-- 摄像头层 -->
  <div class="camera-container">
    <video id="camera" autoplay playsinline></video>
    <canvas id="skeleton"></canvas>
  </div>

  <!-- UI 层 -->
  <div class="ui-layer">
    <!-- 顶部：标题和倒计时 -->
    <header class="scene-header">
      <h1 class="scene-title">深蹲挑战</h1>
      <div class="timer">60s</div>
    </header>

    <!-- 中部：计数和进度 -->
    <div class="progress-section">
      <div class="count-display">
        <span class="current">0</span>
        <span class="separator">/</span>
        <span class="target">10</span>
      </div>
      <div class="progress-bar">
        <div class="progress-fill"></div>
      </div>
    </div>

    <!-- 底部：反馈区域 -->
    <div class="feedback-area">
      <div class="feedback-text">准备开始...</div>
      <div class="feedback-hint">双脚与肩同宽，背部挺直</div>
    </div>
  </div>

  <!-- 完成弹窗 -->
  <div class="completion-modal hidden">
    <div class="modal-content">
      <div class="success-icon">🎉</div>
      <h2>完成！</h2>
      <p>你完成了 10 个深蹲</p>
      <div class="stats">
        <div class="stat">
          <span class="stat-value">8.5</span>
          <span class="stat-label">平均质量</span>
        </div>
        <div class="stat">
          <span class="stat-value">45s</span>
          <span class="stat-label">用时</span>
        </div>
      </div>
      <button class="close-btn">太棒了</button>
    </div>
  </div>

  <script type="module" src="app.js"></script>
</body>
</html>
```

---

## 3. 具体场景设计

### 3.1 drink-water (喝水检测)

**目标：** 检测用户喝水动作，确保真的喝了水

**视觉设计：**
- 背景：清新的蓝色渐变，水滴元素
- 中央：一个水杯图标，随检测进度填充
- 摄像头：右下角小窗，显示上半身

**交互流程：**

```
1. 初始化
   └── 请求摄像头权限
   └── 加载 MediaPipe 模型
   └── 显示"请拿起水杯"

2. 检测阶段
   ├── 未检测到手："请拿起水杯"
   ├── 手接近嘴："检测到喝水动作..."
   ├── 持续2秒：进度条填充
   └── 完成："喝水完成！✓"

3. 完成
   └── 显示完成动画
   └── 播放水滴音效
   └── 3秒后自动关闭
```

**检测参数：**

```javascript
{
  targetCount: 1,           // 只需完成一次
  minDuration: 2000,        // 最少2秒
  mouthRegion: {
    radius: 0.15,           // 嘴部区域半径
    landmarks: [9, 10]      // 使用嘴部关键点
  },
  handLandmarks: [15, 16, 19, 20]  // 手腕和手指
}
```

---

### 3.2 squat (深蹲计数)

**目标：** 完成10个标准深蹲

**视觉设计：**
- 背景：健身房风格，深色+霓虹色点缀
- 中央：大号数字计数器
- 侧边：实时姿态评分（下蹲深度指示器）

**交互流程：**

```
1. 准备阶段 (5s)
   └── "准备开始深蹲"
   └── 倒计时 3-2-1

2. 运动阶段
   ├── 站立："准备下蹲"
   ├── 下蹲中：深度指示器填充
   │   └── 不够深："再低一点！"
   ├── 底部："保持！"
   └── 站起：计数+1，"第 N 个！"

3. 完成
   └── 庆祝动画
   └── 显示统计数据
```

**视觉反馈元素：**

| 元素 | 说明 |
|------|------|
| 深度指示器 | 垂直条，显示当前下蹲深度 |
| 质量环 | 围绕数字的圆环，颜色表示质量 |
| 骨骼高亮 | 膝盖角度实时显示 |
| 连击数 | 连续高质量动作计数 |

---

### 3.3 twist (转体运动)

**目标：** 左右各转体5次，缓解腰部疲劳

**视觉设计：**
- 背景：柔和的渐变色
- 中央：一个旋转的箭头指示
- 底部：左右进度条

**交互流程：**

```
1. 引导
   └── "向左转体"
   └── 箭头动画指向左侧

2. 检测
   ├── 左转到位："保持..."
   ├── 回正："很好，回正"
   ├── 右转："现在向右"
   └── 完成一组：进度更新

3. 循环
   └── 左右各5次
   └── 中途提示"还有3组"
```

---

### 3.4 pushup (俯卧撑)

**目标：** 完成10个俯卧撑

**设计要点：**
- 需要检测全身姿态
- 对摄像头角度有要求（建议侧面）
- 提供角度调整引导

---

## 4. UI 组件规范

### 4.1 计数器组件

```css
.count-display {
  font-size: 120px;
  font-weight: bold;
  font-family: 'DIN Alternate', sans-serif;
  text-shadow: 0 0 30px rgba(255,255,255,0.5);
}

.count-display .current {
  color: #fff;
}

.count-display .target {
  color: rgba(255,255,255,0.5);
  font-size: 60px;
}
```

### 4.2 进度条组件

```css
.progress-bar {
  width: 300px;
  height: 8px;
  background: rgba(255,255,255,0.2);
  border-radius: 4px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #00ff88, #00ccff);
  transition: width 0.3s ease;
}
```

### 4.3 反馈文字组件

```css
.feedback-text {
  font-size: 24px;
  font-weight: 500;
  padding: 12px 24px;
  border-radius: 24px;
  background: rgba(0,0,0,0.5);
  backdrop-filter: blur(10px);
  transition: all 0.3s ease;
}

.feedback-text.success {
  background: rgba(0,255,136,0.3);
  color: #00ff88;
}

.feedback-text.warning {
  background: rgba(255,200,0,0.3);
  color: #ffc800;
}
```

---

## 5. 音效设计

| 事件 | 音效类型 | 说明 |
|------|---------|------|
| 开始 | 轻快的提示音 | 类似游戏开始 |
| 计数 | 清脆的"叮" | 每完成一个 |
| 反馈 | 语音合成 | "再低一点"等 |
| 完成 | 胜利音效 | 庆祝感 |
| 连击 | 渐强音 | 连续高质量动作 |

---

## 6. 开发优先级

1. **P0 - drink-water**
   - 最简单的动作检测
   - 验证技术可行性

2. **P1 - squat**
   - 最经典的运动场景
   - 展示完整功能

3. **P2 - twist**
   - 补充腰部运动
   - 左右对称检测

4. **P3 - pushup**
   - 复杂动作
   - 需要侧面视角

---

*Created: 2026-04-09*
*Status: Draft*
