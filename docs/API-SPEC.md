# API 接口详细规格 (API-SPEC.md)

## 1. MotionEngine API

### 1.1 类定义

```typescript
// 核心检测器
class MotionDetector {
  constructor(options: DetectorOptions);
  
  // 生命周期
  initialize(): Promise<void>;
  start(): Promise<void>;
  stop(): void;
  destroy(): void;
  
  // 状态查询
  readonly isInitialized: boolean;
  readonly isRunning: boolean;
  readonly fps: number;
  readonly latency: number;  // 端到端延迟(ms)
  
  // 事件
  on(event: 'pose', handler: (result: PoseResult) => void): void;
  on(event: 'error', handler: (error: Error) => void): void;
  on(event: 'ready', handler: () => void): void;
}

// 检测器配置
interface DetectorOptions {
  videoElement: HTMLVideoElement;
  canvasElement?: HTMLCanvasElement;  // 用于可视化
  modelAssetPath?: string;            // 模型路径，可选
  runningMode?: 'VIDEO' | 'LIVE_STREAM';
  numPoses?: number;                  // 检测人数，默认1
  minPoseDetectionConfidence?: number;  // 默认0.5
  minPosePresenceConfidence?: number;   // 默认0.5
  minTrackingConfidence?: number;       // 默认0.5
}

// 检测结果
interface PoseResult {
  timestamp: number;
  landmarks: Landmark[];        // 33个关键点，归一化坐标
  worldLandmarks: Landmark[];   // 3D坐标（米）
  segmentationMask?: ImageData;
}

interface Landmark {
  x: number;        // 0-1
  y: number;        // 0-1
  z: number;        // 相对于髋部的深度
  visibility: number;  // 0-1
  presence: number;    // 0-1
}
```

### 1.2 使用示例

```javascript
import { MotionDetector } from './motion-engine/core/detector.js';

const detector = new MotionDetector({
  videoElement: document.getElementById('camera'),
  canvasElement: document.getElementById('skeleton'),
  runningMode: 'LIVE_STREAM',
  minPoseDetectionConfidence: 0.6
});

detector.on('ready', () => {
  console.log('模型加载完成');
});

detector.on('pose', (result) => {
  // 将结果传递给分析器
  analyzer.analyze(result);
  
  // 绘制骨骼
  renderer.draw(result);
});

detector.on('error', (err) => {
  console.error('检测错误:', err);
  showErrorToUser(err.message);
});

// 初始化并启动
await detector.initialize();
await detector.start();

// 停止时
window.addEventListener('beforeunload', () => {
  detector.destroy();
});
```

---

## 2. ActionAnalyzer API

### 2.1 基类定义

```typescript
abstract class ActionAnalyzer {
  constructor(config: ActionConfig);
  
  // 核心方法
  abstract analyze(pose: PoseResult): ActionState;
  reset(): void;
  
  // 状态查询
  readonly state: ActionState;
  readonly count: number;
  readonly isCompleted: boolean;
  readonly progress: number;  // 0-1
  
  // 配置
  targetCount: number;
  thresholds: Record<string, number>;
  
  // 事件
  on(event: 'count', handler: (count: number) => void): void;
  on(event: 'complete', handler: () => void): void;
  on(event: 'feedback', handler: (msg: string, level: FeedbackLevel) => void): void;
  on(event: 'stateChange', handler: (from: State, to: State) => void): void;
}

type FeedbackLevel = 'info' | 'warning' | 'success' | 'error';
type State = 'idle' | 'preparing' | 'active' | 'completed';

interface ActionConfig {
  name: string;
  targetCount: number;
  thresholds: Record<string, number>;
}

interface ActionState {
  phase: State;
  count: number;
  progress: number;
  quality: number;      // 0-1，动作质量
  feedback: string;
  details?: Record<string, any>;
}
```

### 2.2 具体动作分析器

```typescript
// 深蹲分析器
class SquatAnalyzer extends ActionAnalyzer {
  constructor(config?: Partial<SquatConfig>);
}

interface SquatConfig extends ActionConfig {
  thresholds: {
    minDescent: number;       // 最小下降比例，默认0.25
    maxKneeAngle: number;     // 最大膝盖角度，默认100
    minHoldFrames: number;    // 底部停留帧数，默认3
    maxSpeed: number;         // 最大速度，默认2.0
  };
}

// 喝水分析器
class DrinkAnalyzer extends ActionAnalyzer {
  constructor(config?: Partial<DrinkConfig>);
}

interface DrinkConfig extends ActionConfig {
  thresholds: {
    minDuration: number;      // 最小持续时间(ms)，默认2000
    confirmationTime: number; // 确认时间(ms)，默认1500
    mouthRegionRadius: number; // 嘴部区域半径，默认0.15
  };
}

// 转体分析器
class TwistAnalyzer extends ActionAnalyzer {
  constructor(config?: Partial<TwistConfig>);
  readonly leftCount: number;
  readonly rightCount: number;
}

interface TwistConfig extends ActionConfig {
  thresholds: {
    rotationThreshold: number; // 旋转阈值，默认0.35
    minHoldTime: number;       // 最小保持时间(ms)，默认500
  };
}
```

### 2.3 使用示例

```javascript
import { SquatAnalyzer } from './motion-engine/actions/squat.js';

const analyzer = new SquatAnalyzer({
  targetCount: 10,
  thresholds: {
    minDescent: 0.25,
    maxKneeAngle: 100
  }
});

analyzer.on('count', (count) => {
  updateCounter(count);
  playSound('ding');
});

analyzer.on('feedback', (msg, level) => {
  showFeedback(msg, level);
  if (level === 'warning') {
    playSound('hint');
  }
});

analyzer.on('complete', () => {
  showCompletionModal();
  playSound('success');
});

// 在检测循环中
detector.on('pose', (result) => {
  const state = analyzer.analyze(result);
  updateUI(state);
});
```

---

## 3. Renderer API

### 3.1 骨骼渲染器

```typescript
class SkeletonRenderer {
  constructor(canvas: HTMLCanvasElement);
  
  // 渲染
  render(pose: PoseResult, options?: RenderOptions): void;
  clear(): void;
  
  // 配置
  setStyle(style: SkeletonStyle): void;
  
  // 高亮特定连接
  highlightConnection(from: number, to: number, color: string): void;
  highlightLandmark(index: number, color: string): void;
}

interface RenderOptions {
  showSkeleton?: boolean;      // 默认true
  showPoints?: boolean;        // 默认true
  mirror?: boolean;            // 默认true（镜像显示）
  confidenceThreshold?: number; // 默认0.5
}

interface SkeletonStyle {
  lineColor?: string;          // 默认'#00ff88'
  lineWidth?: number;          // 默认2
  pointColor?: string;         // 默认'#00ccff'
  pointRadius?: number;        // 默认4
  highlightColor?: string;     // 默认'#ffcc00'
}

// 预定义连接（骨骼）
const POSE_CONNECTIONS = [
  [11, 12], [11, 23], [12, 24], [23, 24],  // 躯干
  [11, 13], [13, 15], [12, 14], [14, 16],  // 手臂
  [23, 25], [25, 27], [24, 26], [26, 28],  // 腿部
  [15, 17], [15, 19], [16, 18], [16, 20],  // 手部
];
```

### 3.2 使用示例

```javascript
import { SkeletonRenderer } from './motion-engine/renderer/skeleton.js';

const renderer = new SkeletonRenderer(
  document.getElementById('skeleton')
);

renderer.setStyle({
  lineColor: '#00ff88',
  pointColor: '#00ccff',
  lineWidth: 3
});

detector.on('pose', (result) => {
  renderer.render(result, {
    showSkeleton: true,
    mirror: true
  });
  
  // 高亮膝盖
  renderer.highlightConnection(23, 25, '#ff0000');
  renderer.highlightConnection(24, 26, '#ff0000');
});
```

---

## 4. 场景框架 API

### 4.1 场景接口

```typescript
interface MotionScene {
  // 元数据
  readonly id: string;
  readonly name: string;
  readonly manifest: SceneManifest;
  
  // 生命周期
  initialize(config: SceneConfig): Promise<void>;
  start(): void;
  pause(): void;
  resume(): void;
  stop(): void;
  destroy(): void;
  
  // 状态
  readonly isRunning: boolean;
  readonly isPaused: boolean;
  readonly progress: number;  // 0-1
  
  // 结果
  readonly result?: SceneResult;
  
  // 事件
  onReady: () => void;
  onStart: () => void;
  onProgress: (progress: number) => void;
  onComplete: (result: SceneResult) => void;
  onError: (error: Error) => void;
}

interface SceneManifest {
  id: string;
  name: string;
  description: string;
  type: 'motion';
  duration: number;  // 预估时长(秒)
  difficulty: 'easy' | 'medium' | 'hard';
  requirements: {
    camera: boolean;
    fullscreen: boolean;
    audio: boolean;
  };
  config: Record<string, any>;
}

interface SceneConfig {
  targetCount?: number;
  timeout?: number;
  feedbackLevel?: 'minimal' | 'normal' | 'detailed';
  [key: string]: any;
}

interface SceneResult {
  completed: boolean;
  count: number;
  targetCount: number;
  duration: number;  // 实际用时(ms)
  quality?: number;  // 平均质量 0-1
  details?: Record<string, any>;
}
```

### 4.2 场景基类

```typescript
abstract class BaseMotionScene extends EventEmitter implements MotionScene {
  protected detector: MotionDetector;
  protected analyzer: ActionAnalyzer;
  protected renderer: SkeletonRenderer;
  
  constructor(manifest: SceneManifest);
  
  // 子类需要实现
  protected abstract createAnalyzer(): ActionAnalyzer;
  protected abstract onAnalyze(state: ActionState): void;
  protected abstract onComplete(): void;
  
  // 工具方法
  protected playSound(name: string): void;
  protected showFeedback(message: string, level?: FeedbackLevel): void;
  protected updateProgress(progress: number): void;
}
```

---

## 5. 主进程通信 API

### 5.1 IPC 通道

```typescript
// Main -> Renderer
interface MainToRendererEvents {
  'motion:start': {
    sceneId: string;
    config: SceneConfig;
  };
  
  'motion:pause': void;
  'motion:resume': void;
  'motion:stop': void;
}

// Renderer -> Main
interface RendererToMainEvents {
  'motion:ready': {
    sceneId: string;
  };
  
  'motion:started': {
    sceneId: string;
    timestamp: number;
  };
  
  'motion:progress': {
    sceneId: string;
    progress: number;
    count: number;
  };
  
  'motion:complete': {
    sceneId: string;
    result: SceneResult;
  };
  
  'motion:error': {
    sceneId: string;
    error: string;
  };
}
```

### 5.2 使用示例

```javascript
// Renderer 端
const { ipcRenderer } = require('electron');

// 报告场景准备就绪
ipcRenderer.send('motion:ready', { sceneId: 'squat' });

// 报告进度
analyzer.on('count', (count) => {
  ipcRenderer.send('motion:progress', {
    sceneId: 'squat',
    progress: count / analyzer.targetCount,
    count
  });
});

// 报告完成
analyzer.on('complete', () => {
  ipcRenderer.send('motion:complete', {
    sceneId: 'squat',
    result: {
      completed: true,
      count: analyzer.count,
      targetCount: analyzer.targetCount,
      duration: Date.now() - startTime,
      quality: calculateAverageQuality()
    }
  });
});
```

```javascript
// Main 端
const { ipcMain } = require('electron');

ipcMain.on('motion:complete', (event, data) => {
  console.log(`场景 ${data.sceneId} 完成`, data.result);
  
  // 记录到历史
  history.add(data);
  
  // 关闭场景窗口
  closeSceneWindow();
  
  // 恢复主窗口
  showMainWindow();
});
```

---

## 6. 配置系统 API

### 6.1 全局配置

```typescript
interface MotionEngineConfig {
  // 检测器配置
  detector: {
    modelPath?: string;
    runningMode: 'VIDEO' | 'LIVE_STREAM';
    minPoseDetectionConfidence: number;
    minPosePresenceConfidence: number;
    minTrackingConfidence: number;
  };
  
  // 渲染配置
  renderer: {
    showSkeleton: boolean;
    showPoints: boolean;
    mirror: boolean;
    style: SkeletonStyle;
  };
  
  // 音频配置
  audio: {
    enabled: boolean;
    volume: number;
    sounds: Record<string, string>;  // 音效路径映射
  };
  
  // 隐私配置
  privacy: {
    saveVideo: boolean;
    saveImages: boolean;
    saveStatistics: boolean;
  };
}

// 默认配置
const DEFAULT_CONFIG: MotionEngineConfig = {
  detector: {
    runningMode: 'LIVE_STREAM',
    minPoseDetectionConfidence: 0.5,
    minPosePresenceConfidence: 0.5,
    minTrackingConfidence: 0.5
  },
  renderer: {
    showSkeleton: true,
    showPoints: true,
    mirror: true,
    style: {
      lineColor: '#00ff88',
      lineWidth: 2,
      pointColor: '#00ccff',
      pointRadius: 4
    }
  },
  audio: {
    enabled: true,
    volume: 0.8,
    sounds: {
      start: 'assets/sounds/start.mp3',
      count: 'assets/sounds/count.mp3',
      complete: 'assets/sounds/success.mp3',
      hint: 'assets/sounds/hint.mp3'
    }
  },
  privacy: {
    saveVideo: false,
    saveImages: false,
    saveStatistics: true
  }
};
```

### 6.2 配置加载

```javascript
import { loadConfig, mergeConfig } from './motion-engine/config.js';

// 加载用户配置
const userConfig = await loadConfig();

// 合并默认配置
const config = mergeConfig(DEFAULT_CONFIG, userConfig);

// 应用配置
detector.setOptions(config.detector);
renderer.setStyle(config.renderer.style);
```

---

*Created: 2026-04-09*
*Status: Draft*
