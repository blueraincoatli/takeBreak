# 开发任务清单 (TASKS.md)

## 已完成任务

### ✅ 深蹲场景 (squat)

**完成时间：** 2026-04-11

**实现内容：**
- [x] MediaPipe Pose 检测集成
- [x] 本地模型文件 (`public/models/pose_landmarker_lite.task`)
- [x] 深蹲状态机 (STANDING → DESCENDING → BOTTOM → ASCENDING → COUNTED)
- [x] 膝角计算与阈值判断
- [x] 骨骼可视化渲染
- [x] 实时计数与 UI 反馈
- [x] 完成动画与音效
- [x] HTTP API 集成 (`/api/scene-complete`)

**已知问题：**
- FaceLandmarker `detectForVideo()` 返回 `undefined`（MediaPipe tasks-vision@0.10.14 WASM bug），暂用 pose 检测替代

---

## 待开发任务

### 阶段 1: 基础设施 (已完成)

- [x] 公共模型目录 (`public/models/`)
- [x] HTTP 静态文件服务 (`/models/*`)
- [x] 场景触发 API (`/remind?scene=<id>`)
- [x] 完成通知 API (`/api/scene-complete`)

### 阶段 2: 新动作场景

#### 2.1 喝水检测 (drink-water)

- [ ] 创建 `scenes/drink-water/` 目录
- [ ] 实现 DrinkAnalyzer（手嘴距离检测）
- [ ] 设计 UI（水杯进度条）
- [ ] 添加喝水持续时长判断

**预估时间：** 2 天

#### 2.2 转体运动 (twist)

- [ ] 创建 `scenes/twist/` 目录
- [ ] 实现 TwistAnalyzer（躯干旋转角度）
- [ ] 设计 UI（左右进度条）
- [ ] 添加方向指示动画

**预估时间：** 2 天

#### 2.3 俯卧撑 (pushup)

- [ ] 创建 `scenes/pushup/` 目录
- [ ] 实现 PushupAnalyzer（手肘角度 + 身体高度）
- [ ] 侧面视角引导
- [ ] 设计 UI

**预估时间：** 3 天

### 阶段 3: 体验优化

- [ ] 动作质量评分系统
- [ ] 历史记录与统计
- [ ] 成就系统
- [ ] 多语言支持

---

## 技术债务

| 问题 | 影响 | 优先级 |
|------|------|--------|
| FaceLandmarker WASM bug | 无法使用面部检测 | P2（等待上游修复） |
| 测试文件清理 | 根目录有残留测试文件 | P3 |
| 开发模式硬编码场景 | 需恢复随机选择 | P1 |

---

## 风险与应对

| 风险 | 概率 | 影响 | 应对措施 |
|------|------|------|---------|
| MediaPipe 性能不佳 | 低 | 高 | 已验证，pose 检测 ~12fps 可接受 |
| 动作检测不准确 | 中 | 高 | 设计可调节阈值，收集反馈优化 |
| 用户隐私顾虑 | 低 | 高 | 完全本地处理，明确隐私政策 |

---

## 里程碑

| 日期 | 里程碑 | 交付物 |
|------|--------|--------|
| 2026-04-11 | 深蹲场景完成 | `scenes/squat/` + 公共模型目录 |
| TBD | 喝水场景完成 | `scenes/drink-water/` |
| TBD | 转体场景完成 | `scenes/twist/` |
| TBD | 俯卧撑场景完成 | `scenes/pushup/` |

---

*Created: 2026-04-09*
*Updated: 2026-04-11*
*Status: Active*
