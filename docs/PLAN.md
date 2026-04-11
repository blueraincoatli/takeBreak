# takeBreak AI 运动教练系统 - 总体规划

## 1. 项目愿景

将 takeBreak 从一个简单的休息提醒动画，升级为**本地 AI 运动教练**。

**核心价值：**
- 定时提醒用户运动/休息
- 通过摄像头实时检测动作完成情况
- 完全本地运行，保护隐私
- 趣味化的互动体验

---

## 2. 技术架构

```
takeBreak/
├── main.js                 # Electron 主进程
├── package.json           # 依赖管理
├── scenes/                # 场景目录（现有）
│   ├── cat-on-screen/
│   ├── cat-paw/
│   ├── hammer/
│   └── ...
├── motion-engine/         # 【新增】运动检测引擎
│   ├── core/
│   │   ├── detector.js    # MediaPipe 初始化与管理
│   │   ├── tracker.js     # 关键点追踪与平滑
│   │   └── analyzer.js    # 动作分析基类
│   ├── actions/           # 具体动作检测器
│   │   ├── squat.js       # 深蹲
│   │   ├── twist.js       # 转体
│   │   ├── drink.js       # 喝水
│   │   └── pushup.js      # 俯卧撑
│   └── renderer/          # 可视化渲染
│       ├── skeleton.js    # 骨骼绘制
│       └── feedback.js    # 实时反馈 UI
├── scenes-motion/         # 【新增】运动场景
│   ├── drink-water/       # 喝水检测场景
│   ├── squat/             # 深蹲计数场景
│   ├── twist/             # 转体场景
│   └── pushup/            # 俯卧撑场景
└── docs/                  # 文档
    ├── PLAN.md            # 本文件
    ├── SPEC-*.md          # 各模块详细规格
    └── ARCHITECTURE.md    # 架构设计
```

---

## 3. 核心模块规划

### 3.1 运动检测引擎 (motion-engine)

| 模块 | 职责 | 技术选型 |
|------|------|---------|
| **Detector** | MediaPipe 初始化、摄像头管理、生命周期 | `@mediapipe/tasks-vision` |
| **Tracker** | 关键点平滑、坐标转换、速度计算 | 卡尔曼滤波 / 简单滑动平均 |
| **Analyzer** | 动作识别基类、状态机管理 | 抽象基类 + 具体实现 |
| **Renderer** | 骨骼绘制、进度显示、反馈动画 | Canvas 2D / WebGL |

### 3.2 动作检测器 (Actions)

每个动作是一个独立模块，统一接口：

```javascript
interface ActionDetector {
  name: string;           // 动作名称
  targetCount: number;    // 目标次数
  
  // 核心方法
  analyze(poseLandmarks): ActionState;  // 分析当前帧
  reset(): void;                         // 重置状态
  
  // 事件
  onCount: (count) => void;      // 完成一次
  onComplete: () => void;        // 完成目标
  onFeedback: (msg) => void;     // 实时反馈（如"再低一点"）
}
```

### 3.3 运动场景 (scenes-motion)

继承现有 scene 架构，但增加摄像头和实时检测：

```
scenes-motion/squat/
├── manifest.json      # 场景元数据
├── index.html         # 主页面
├── style.css          # 样式
├── detector.js        # 检测逻辑
└── assets/            # 资源文件
```

---

## 4. 开发阶段

### Phase 1: 基础引擎 (Week 1)
- [ ] MediaPipe 集成与封装
- [ ] 摄像头权限管理
- [ ] 关键点可视化
- [ ] 性能优化（帧率、延迟）

### Phase 2: 动作检测 (Week 2)
- [ ] 深蹲检测器
- [ ] 喝水检测器
- [ ] 动作计数逻辑
- [ ] 反馈系统（语音 + 视觉）

### Phase 3: 场景开发 (Week 3)
- [ ] drink-water 运动场景
- [ ] squat 运动场景
- [ ] 场景切换与数据传递
- [ ] 运动报告生成

### Phase 4:  polish (Week 4)
- [ ] 更多动作（转体、俯卧撑）
- [ ] 动作质量评分
- [ ] 历史记录与统计
- [ ] 用户体验优化

---

## 5. 关键技术决策

### 5.1 MediaPipe 版本选择

| 选项 | 优点 | 缺点 | 决策 |
|------|------|------|------|
| **Tasks Vision** (官方推荐) | API 简洁、维护好、功能全 | 包较大 (~10MB) | ✅ 选用 |
| Legacy Solutions | 成熟、文档多 | 已弃用 | ❌ 不选 |
| 自研模型 | 完全可控 | 工作量大 | ❌ 不选 |

### 5.2 坐标系与单位

- **输入**: MediaPipe 归一化坐标 (0-1)
- **内部**: 像素坐标 (根据视频分辨率)
- **角度**: 度数 (0-180°)
- **距离**: 像素或归一化 (视场景)

### 5.3 性能目标

| 指标 | 目标 | 说明 |
|------|------|------|
| 检测帧率 | 30fps | 流畅体验 |
| 端到端延迟 | < 100ms | 实时反馈 |
| CPU 占用 | < 30% | 不影响其他工作 |
| 内存占用 | < 500MB | 合理范围 |

### 5.4 隐私策略

- 摄像头数据**绝不离开本地**
- 分析结果可选择性保存
- 提供"仅检测不存储"模式
- 明确的权限申请流程

---

## 6. 风险评估

| 风险 | 可能性 | 影响 | 缓解措施 |
|------|--------|------|---------|
| MediaPipe 性能不佳 | 中 | 高 | 提前做 POC 验证 |
| 动作检测准确率不够 | 中 | 高 | 设计可调节阈值 |
| 用户隐私顾虑 | 中 | 中 | 完全本地 + 透明说明 |
| 复杂动作难以检测 | 高 | 中 | 从简单动作开始 |

---

## 7. 下一步行动

1. **写详细 SPEC** - 各模块的接口、数据结构、算法
2. **搭建 motion-engine 框架** - 核心类与接口
3. **POC 验证** - 先跑通 MediaPipe + 简单检测
4. **开发第一个场景** - drink-water

---

*Created: 2026-04-09*
*Status: Planning*
