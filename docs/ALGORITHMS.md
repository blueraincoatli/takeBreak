# 动作检测算法详细设计 (ALGORITHMS.md)

## 1. 深蹲检测算法 (Squat Detection)

### 1.1 关键点定义

```
使用 MediaPipe Pose 33 点中的以下关键点：

上半身：
- 0: 鼻子 (nose)
- 11, 12: 左/右肩 (shoulders)
- 23, 24: 左/右髋 (hips)

下半身：
- 25, 26: 左/右膝 (knees)
- 27, 28: 左/右踝 (ankles)

辅助点：
- 15, 16: 左/右手腕 (用于判断是否手放头后等变式)
```

### 1.2 核心指标计算

#### 下蹲深度 (Squat Depth)

```javascript
function calculateSquatDepth(landmarks) {
  // 获取髋部 y 坐标（图像坐标系，y 向下为正）
  const leftHip = landmarks[23];
  const rightHip = landmarks[24];
  const hipY = (leftHip.y + rightHip.y) / 2;
  
  // 获取站立时的参考高度（使用脚踝作为基准）
  const leftAnkle = landmarks[27];
  const rightAnkle = landmarks[28];
  const ankleY = (leftAnkle.y + rightAnkle.y) / 2;
  
  // 计算身高（鼻尖到脚踝）
  const nose = landmarks[0];
  const height = Math.abs(nose.y - ankleY);
  
  // 下蹲深度 = (髋部下降距离) / 身高
  const standingHipY = this.calibration.standingHipY || nose.y - height * 0.5;
  const descent = Math.max(0, standingHipY - hipY);
  const depthRatio = descent / height;
  
  return {
    depthRatio,        // 0-1，越接近1表示蹲得越深
    hipY,
    ankleY,
    height
  };
}
```

#### 膝盖角度 (Knee Angle)

```javascript
function calculateKneeAngle(landmarks, side = 'left') {
  const hipIndex = side === 'left' ? 23 : 24;
  const kneeIndex = side === 'left' ? 25 : 26;
  const ankleIndex = side === 'left' ? 27 : 28;
  
  const hip = landmarks[hipIndex];
  const knee = landmarks[kneeIndex];
  const ankle = landmarks[ankleIndex];
  
  // 向量：髋到膝，踝到膝
  const v1 = { x: hip.x - knee.x, y: hip.y - knee.y };
  const v2 = { x: ankle.x - knee.x, y: ankle.y - knee.y };
  
  // 计算夹角
  const angle = calculateAngle(v1, v2);
  
  return angle;  // 度数，180表示腿伸直
}
```

#### 背部角度 (Back Angle)

```javascript
function calculateBackAngle(landmarks) {
  // 使用肩中点 - 髋中点的角度
  const leftShoulder = landmarks[11];
  const rightShoulder = landmarks[12];
  const shoulderMid = {
    x: (leftShoulder.x + rightShoulder.x) / 2,
    y: (leftShoulder.y + rightShoulder.y) / 2
  };
  
  const leftHip = landmarks[23];
  const rightHip = landmarks[24];
  const hipMid = {
    x: (leftHip.x + rightHip.x) / 2,
    y: (leftHip.y + rightHip.y) / 2
  };
  
  // 计算与垂直线的夹角
  const dx = shoulderMid.x - hipMid.x;
  const dy = shoulderMid.y - hipMid.y;
  const angle = Math.abs(Math.atan2(dx, -dy) * 180 / Math.PI);
  
  return angle;  // 0表示完全直立，越大表示越前倾
}
```

### 1.3 状态机设计

```
状态定义：

IDLE (空闲)
  └── 未检测到站立姿态
  
STANDING (站立)
  └── 检测到站立，等待下蹲
  
DESCENDING (下降中)
  └── 髋部正在下降
  └── 进入条件：depthRatio > 0.05
  
BOTTOM (底部)
  └── 达到下蹲最低点
  └── 进入条件：depthRatio > 0.25 且速度接近0
  
ASCENDING (上升中)
  └── 正在站起
  └── 进入条件：髋部上升
  
COUNTED (已计数)
  └── 完成一次，等待回到站立
```

### 1.4 状态转换条件

```javascript
const STATE_TRANSITIONS = {
  IDLE: {
    to: 'STANDING',
    condition: (metrics) => metrics.isStanding && metrics.visibility > 0.8
  },
  
  STANDING: {
    to: 'DESCENDING',
    condition: (metrics) => metrics.depthRatio > 0.05 && metrics.velocity < -0.01
  },
  
  DESCENDING: {
    to: 'BOTTOM',
    condition: (metrics) => metrics.depthRatio > 0.25 && Math.abs(metrics.velocity) < 0.005
  },
  
  BOTTOM: {
    to: 'ASCENDING',
    condition: (metrics) => metrics.velocity > 0.01
  },
  
  ASCENDING: {
    to: 'COUNTED',
    condition: (metrics) => metrics.depthRatio < 0.1,
    action: 'incrementCount'
  },
  
  COUNTED: {
    to: 'STANDING',
    condition: (metrics) => metrics.isStanding,
    after: 500  // 延迟500ms，防止抖动
  }
};
```

### 1.5 质量评分算法

```javascript
function calculateSquatQuality(metrics) {
  let score = 10;
  const feedback = [];
  
  // 深度评分 (40%)
  if (metrics.depthRatio < 0.2) {
    score -= 3;
    feedback.push('再低一点');
  } else if (metrics.depthRatio < 0.25) {
    score -= 1;
    feedback.push('可以更深');
  }
  
  // 膝盖角度评分 (30%)
  if (metrics.kneeAngle > 100) {
    score -= 2;
    feedback.push('膝盖再弯曲一些');
  }
  
  // 背部角度评分 (20%)
  if (metrics.backAngle > 30) {
    score -= 2;
    feedback.push('背部挺直');
  }
  
  // 速度控制评分 (10%)
  if (metrics.maxVelocity > 0.05) {
    score -= 1;
    feedback.push('慢一点，控制节奏');
  }
  
  return {
    score: Math.max(0, score),
    feedback: feedback.length > 0 ? feedback[0] : '很好！',
    details: feedback
  };
}
```

---

## 2. 喝水检测算法 (Drink Detection)

### 2.1 检测区域定义

```javascript
// 嘴部区域（椭圆）
const MOUTH_REGION = {
  center: (landmarks) => {
    // 使用鼻子下方作为嘴部中心参考
    const nose = landmarks[0];
    const leftMouth = landmarks[9];   // 左嘴角
    const rightMouth = landmarks[10]; // 右嘴角
    return {
      x: (leftMouth.x + rightMouth.x) / 2,
      y: nose.y + (leftMouth.y - nose.y) * 0.5
    };
  },
  radiusX: 0.08,  // 归一化宽度
  radiusY: 0.06   // 归一化高度
};

// 手部关键点
const HAND_LANDMARKS = {
  left: [15, 17, 19],   // 手腕、食指、小指
  right: [16, 18, 20]
};
```

### 2.2 手嘴接近检测

```javascript
function isHandNearMouth(landmarks, handSide = 'right') {
  const mouthCenter = MOUTH_REGION.center(landmarks);
  const handIndices = HAND_LANDMARKS[handSide];
  
  // 检查手部的多个点
  for (const index of handIndices) {
    const handPoint = landmarks[index];
    
    // 计算到嘴部中心的距离
    const dx = handPoint.x - mouthCenter.x;
    const dy = handPoint.y - mouthCenter.y;
    
    // 椭圆距离判断
    const normalizedDist = Math.sqrt(
      (dx / MOUTH_REGION.radiusX) ** 2 + 
      (dy / MOUTH_REGION.radiusY) ** 2
    );
    
    if (normalizedDist < 1.0 && handPoint.visibility > 0.7) {
      return {
        isNear: true,
        distance: normalizedDist,
        handPoint
      };
    }
  }
  
  return { isNear: false };
}
```

### 2.3 喝水动作识别

```javascript
class DrinkDetector {
  constructor() {
    this.state = 'IDLE';
    this.nearStartTime = null;
    this.minDuration = 2000;  // 最少2秒
    this.confirmationTime = 1500; // 1.5秒确认
  }
  
  analyze(landmarks) {
    const rightHand = isHandNearMouth(landmarks, 'right');
    const leftHand = isHandNearMouth(landmarks, 'left');
    const isNear = rightHand.isNear || leftHand.isNear;
    
    const now = Date.now();
    
    switch (this.state) {
      case 'IDLE':
        if (isNear) {
          this.state = 'APPROACHING';
          this.nearStartTime = now;
        }
        break;
        
      case 'APPROACHING':
        if (!isNear) {
          this.state = 'IDLE';
          this.nearStartTime = null;
        } else if (now - this.nearStartTime > this.confirmationTime) {
          this.state = 'DRINKING';
          this.onStartDrinking?.();
        }
        break;
        
      case 'DRINKING':
        if (!isNear) {
          const duration = now - this.nearStartTime;
          if (duration > this.minDuration) {
            this.state = 'COMPLETED';
            this.onComplete?.({ duration });
          } else {
            this.state = 'IDLE';
            this.onCancel?.({ reason: 'too_short', duration });
          }
          this.nearStartTime = null;
        }
        break;
        
      case 'COMPLETED':
        // 保持完成状态
        break;
    }
    
    return {
      state: this.state,
      progress: this.nearStartTime ? 
        Math.min(1, (now - this.nearStartTime) / this.minDuration) : 0,
      isNear
    };
  }
}
```

---

## 3. 转体检测算法 (Twist Detection)

### 3.1 躯干角度计算

```javascript
function calculateTorsoRotation(landmarks) {
  // 获取肩中点和髋中点
  const leftShoulder = landmarks[11];
  const rightShoulder = landmarks[12];
  const shoulderMid = {
    x: (leftShoulder.x + rightShoulder.x) / 2,
    y: (leftShoulder.y + rightShoulder.y) / 2
  };
  
  const leftHip = landmarks[23];
  const rightHip = landmarks[24];
  const hipMid = {
    x: (leftHip.x + rightHip.x) / 2,
    y: (leftHip.y + rightHip.y) / 2
  };
  
  // 计算肩宽和髋宽（用于归一化）
  const shoulderWidth = Math.abs(rightShoulder.x - leftShoulder.x);
  const hipWidth = Math.abs(rightHip.x - leftHip.x);
  const avgWidth = (shoulderWidth + hipWidth) / 2;
  
  // 计算水平偏移
  const shoulderOffset = shoulderMid.x - hipMid.x;
  const rotationRatio = shoulderOffset / avgWidth;
  
  // 转换为角度（近似）
  const angle = Math.atan2(rotationRatio, 1) * 180 / Math.PI;
  
  return {
    angle,           // 正数=右转，负数=左转
    ratio: rotationRatio,
    isTwisting: Math.abs(rotationRatio) > 0.3
  };
}
```

### 3.2 左右转体计数

```javascript
class TwistDetector {
  constructor() {
    this.leftCount = 0;
    this.rightCount = 0;
    this.state = 'CENTER';
    this.lastDirection = null;
  }
  
  analyze(landmarks) {
    const rotation = calculateTorsoRotation(landmarks);
    const THRESHOLD = 0.35;
    
    let newState = 'CENTER';
    if (rotation.ratio > THRESHOLD) {
      newState = 'RIGHT';
    } else if (rotation.ratio < -THRESHOLD) {
      newState = 'LEFT';
    }
    
    // 状态转换计数
    if (this.state === 'CENTER' && newState !== 'CENTER') {
      this.lastDirection = newState;
    }
    
    if (this.state !== 'CENTER' && newState === 'CENTER') {
      // 完成一次转体
      if (this.state === 'LEFT') {
        this.leftCount++;
        this.onTwist?.('left', this.leftCount);
      } else if (this.state === 'RIGHT') {
        this.rightCount++;
        this.onTwist?.('right', this.rightCount);
      }
    }
    
    this.state = newState;
    
    return {
      state: this.state,
      leftCount: this.leftCount,
      rightCount: this.rightCount,
      total: this.leftCount + this.rightCount,
      angle: rotation.angle
    };
  }
}
```

---

## 4. 通用工具函数

### 4.1 角度计算

```javascript
/**
 * 计算两个向量的夹角（度数）
 */
function calculateAngle(v1, v2) {
  const dot = v1.x * v2.x + v1.y * v2.y;
  const mag1 = Math.sqrt(v1.x ** 2 + v1.y ** 2);
  const mag2 = Math.sqrt(v2.x ** 2 + v2.y ** 2);
  
  if (mag1 === 0 || mag2 === 0) return 0;
  
  const cos = Math.max(-1, Math.min(1, dot / (mag1 * mag2)));
  return Math.acos(cos) * 180 / Math.PI;
}

/**
 * 计算三点形成的角度（中间点为顶点）
 */
function calculateThreePointAngle(a, b, c) {
  const v1 = { x: a.x - b.x, y: a.y - b.y };
  const v2 = { x: c.x - b.x, y: c.y - b.y };
  return calculateAngle(v1, v2);
}
```

### 4.2 关键点平滑

```javascript
class LandmarkSmoother {
  constructor(windowSize = 5) {
    this.history = [];
    this.windowSize = windowSize;
  }
  
  add(landmarks) {
    this.history.push(landmarks);
    if (this.history.length > this.windowSize) {
      this.history.shift();
    }
    return this.getSmoothed();
  }
  
  getSmoothed() {
    if (this.history.length === 0) return null;
    
    const numLandmarks = this.history[0].length;
    const smoothed = [];
    
    for (let i = 0; i < numLandmarks; i++) {
      let sumX = 0, sumY = 0, sumZ = 0, sumVis = 0;
      let count = 0;
      
      for (const frame of this.history) {
        if (frame[i].visibility > 0.5) {
          sumX += frame[i].x;
          sumY += frame[i].y;
          sumZ += frame[i].z;
          sumVis += frame[i].visibility;
          count++;
        }
      }
      
      if (count > 0) {
        smoothed.push({
          x: sumX / count,
          y: sumY / count,
          z: sumZ / count,
          visibility: sumVis / count
        });
      } else {
        smoothed.push(this.history[this.history.length - 1][i]);
      }
    }
    
    return smoothed;
  }
}
```

### 4.3 可见性检查

```javascript
function checkVisibility(landmarks, indices, minVisibility = 0.7) {
  for (const i of indices) {
    if (landmarks[i].visibility < minVisibility) {
      return false;
    }
  }
  return true;
}

function getVisibleLandmarks(landmarks) {
  return landmarks.filter(lm => lm.visibility > 0.7);
}
```

---

## 5. 边界情况处理

### 5.1 深蹲边界情况

| 情况 | 处理策略 |
|------|---------|
| 部分身体出画面 | 提示"请后退，让全身入镜" |
| 穿宽松衣服 | 依赖骨骼点，不受衣服影响 |
| 手持重物 | 检测手部位置，提示"空手练习" |
| 速度过快 | 过滤，不计数，提示"慢一点" |
| 半蹲 | depthRatio < 0.2 不计数 |
| 膝盖内扣 | 检测膝盖相对位置，给出提示 |

### 5.2 喝水边界情况

| 情况 | 处理策略 |
|------|---------|
| 手遮挡嘴 | 检测手部关键点，仍可识别 |
| 侧身喝水 | 使用 3D 坐标，考虑 z 轴 |
| 时间过短 | < 2秒不算完成，提示"多喝一点" |
| 假动作 | 结合持续时间判断 |
| 多人入镜 | 选择最清晰的人脸 |

---

*Created: 2026-04-09*
*Status: Draft*
