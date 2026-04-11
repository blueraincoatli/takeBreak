# 运动检测引擎详细规格 (SPEC-MOTION-ENGINE.md)

## 1. 模块概述

运动检测引擎是 takeBreak AI 运动教练的核心，负责：
- 管理 MediaPipe 模型和摄像头
- 实时分析人体姿态
- 识别特定动作并计数
- 提供可视化反馈

---

## 2. 核心类设计

### 2.1 MotionDetector (检测器)

```javascript
class MotionDetector extends EventEmitter {
  constructor(options) {
    // options:
    // - videoElement: HTMLVideoElement
    // - canvasElement: HTMLCanvasElement (可选，用于可视化)
    // - modelPath: string (模型路径，可选)
    // - runningMode: 'VIDEO' | 'LIVE_STREAM'
  }

  // 生命周期
  async initialize(): Promise<void>    // 加载模型
  async start(): Promise<void>         // 启动摄像头
  stop(): void                         // 停止
  destroy(): void                      // 清理资源

  // 状态
  get isInitialized(): boolean
  get isRunning(): boolean
  get fps(): number                    // 当前帧率

  // 事件
  'pose': (result: PoseResult) => void     // 检测到姿态
  'error': (error: Error) => void          // 错误
}
```

### 2.2 PoseResult (检测结果)

```javascript
interface PoseResult {
  timestamp: number;           // 时间戳
  landmarks: Landmark[];       // 33 个关键点
  worldLandmarks: Landmark[];  // 3D 坐标（米）
  segmentationMask?: ImageData; // 分割掩码
}

interface Landmark {
  x: number;      // 0-1 (归一化)
  y: number;
  z: number;
  visibility: number;  // 0-1，可见度置信度
  presence: number;    // 0-1，存在置信度
}
```

### 2.3 ActionAnalyzer (动作分析器基类)

```javascript
class ActionAnalyzer extends EventEmitter {
  constructor(config: ActionConfig)

  // 核心方法
  analyze(pose: PoseResult): ActionState
  reset(): void

  // 状态查询
  get state(): ActionState
  get count(): number
  get isCompleted(): boolean

  // 事件
  'count': (count: number) => void
  'complete': () => void
  'feedback': (message: string, level: 'info' | 'warning' | 'success') => void
  'stateChange': (from: State, to: State) => void
}

interface ActionConfig {
  name: string;
  targetCount: number;
  thresholds: {
    // 各动作自定义阈值
  };
}

interface ActionState {
  phase: 'idle' | 'preparing' | 'active' | 'completed';
  count: number;
  progress: number;      // 0-1，当前动作完成度
  quality: number;       // 0-1，动作质量评分
  feedback: string;      // 实时反馈文字
}
```

---

## 3. 具体动作检测器

### 3.1 SquatAnalyzer (深蹲)

**检测逻辑：**

```
状态机:
  IDLE -> PREPARING: 检测到站立姿态
  PREPARING -> DOWN: 髋部下降超过阈值
  DOWN -> UP: 髋部上升超过阈值
  UP -> COUNT: 完成一次，计数+1

关键指标:
  - 下蹲深度: 髋部 y 坐标变化 > 30% 身高
  - 膝盖角度: < 90° 为有效深蹲
  - 背部角度: 保持相对直立
```

**阈值配置：**

```javascript
const squatConfig = {
  name: 'squat',
  targetCount: 10,
  thresholds: {
    minDescent: 0.25,        // 最小下降比例（相对于身高）
    maxKneeAngle: 100,       // 最大膝盖角度（度）
    minHoldFrames: 3,        // 底部停留帧数
    maxSpeed: 2.0,           // 最大速度（防止抖动误触发）
  }
};
```

**反馈规则：**

| 情况 | 反馈 |
|------|------|
| 下蹲不够深 | "再低一点！" |
| 膝盖内扣 | "膝盖向外打开" |
| 速度太快 | "慢一点，控制节奏" |
| 完成一次 | "很好！第 N 个" |
| 全部完成 | "太棒了！10个深蹲完成" |

### 3.2 DrinkAnalyzer (喝水)

**检测逻辑：**

```
状态机:
  IDLE -> HAND_UP: 手部接近嘴部区域
  HAND_UP -> DRINKING: 保持 2 秒以上
  DRINKING -> COMPLETED: 手离开嘴部

关键指标:
  - 手嘴距离: < 15% 身高
  - 持续时间: > 2 秒
  - 头部姿态: 轻微后仰（可选）
```

**嘴部区域定义：**

```javascript
// 使用面部关键点定义嘴部区域
const mouthCenter = {
  x: landmarks[POSE_LANDMARKS.MOUTH_LEFT].x,
  y: (landmarks[POSE_LANDMARKS.MOUTH_LEFT].y + 
      landmarks[POSE_LANDMARKS.MOUTH_RIGHT].y) / 2
};

const mouthRadius = 0.15; // 归一化半径
```

### 3.3 TwistAnalyzer (转体)

**检测逻辑：**

```
检测肩膀/髋部的水平旋转角度
区分左转/右转
每侧各计一次为完整一个
```

---

## 4. 工具函数

### 4.1 几何计算

```javascript
// lib/geometry.js

// 计算两点距离
distance(a: Landmark, b: Landmark): number

// 计算三点形成的角度（中间点为顶点）
angle(a: Landmark, b: Landmark, c: Landmark): number

// 计算向量夹角
vectorAngle(v1: {x, y}, v2: {x, y}): number

// 判断点是否在区域内
pointInRegion(point: Landmark, center: Landmark, radius: number): boolean

// 平滑关键点（滑动平均）
smoothLandmarks(history: Landmark[][], window: number): Landmark[]
```

### 4.2 姿态判断

```javascript
// lib/pose-utils.js

// 判断是否为站立姿态
isStanding(landmarks: Landmark[]): boolean

// 判断是否为坐姿
isSitting(landmarks: Landmark[]): boolean

// 获取人体朝向
getFacingDirection(landmarks: Landmark[]): 'front' | 'back' | 'left' | 'right'

// 计算身高（鼻尖到脚踝）
estimateHeight(landmarks: Landmark[]): number
```

---

## 5. 性能优化

### 5.1 帧率控制

```javascript
class FrameController {
  constructor(targetFps = 30) {
    this.targetInterval = 1000 / targetFps;
    this.lastFrameTime = 0;
  }

  shouldProcess(currentTime): boolean {
    if (currentTime - this.lastFrameTime >= this.targetInterval) {
      this.lastFrameTime = currentTime;
      return true;
    }
    return false;
  }
}
```

### 5.2 关键点平滑

```javascript
class LandmarkSmoother {
  constructor(windowSize = 5) {
    this.history = [];
    this.windowSize = windowSize;
  }

  add(landmarks: Landmark[]): Landmark[] {
    this.history.push(landmarks);
    if (this.history.length > this.windowSize) {
      this.history.shift();
    }
    return this.getSmoothed();
  }

  getSmoothed(): Landmark[] {
    // 对每个关键点做滑动平均
    return landmarks.map((_, i) => ({
      x: average(this.history.map(h => h[i].x)),
      y: average(this.history.map(h => h[i].y)),
      z: average(this.history.map(h => h[i].z)),
      visibility: this.history[this.history.length - 1][i].visibility
    }));
  }
}
```

---

## 6. 错误处理

| 错误类型 | 处理策略 |
|---------|---------|
| 摄像头权限拒绝 | 显示引导页面，说明用途 |
| 模型加载失败 | 重试 3 次，失败后降级到简单检测 |
| 检测帧率过低 | 自动降低分辨率或模型复杂度 |
| 关键点不可见 | 提示用户调整位置/光线 |
| 多人检测 | 选择最清晰的一个，或提示单人使用 |

---

## 7. 接口汇总

```javascript
// 主入口
import { MotionDetector } from './motion-engine/core/detector.js';
import { SquatAnalyzer } from './motion-engine/actions/squat.js';
import { DrinkAnalyzer } from './motion-engine/actions/drink.js';

// 使用示例
const detector = new MotionDetector({
  videoElement: document.getElementById('video'),
  canvasElement: document.getElementById('canvas')
});

await detector.initialize();
await detector.start();

const analyzer = new SquatAnalyzer({ targetCount: 10 });

detector.on('pose', (result) => {
  const state = analyzer.analyze(result);
  updateUI(state);
});
```

---

*Created: 2026-04-09*
*Status: Draft*
