/**
 * 关键点平滑处理
 * @module motion-engine/utils/smoothing
 */

/**
 * 滑动平均平滑器
 */
export class LandmarkSmoother {
  /**
   * @param {number} windowSize - 窗口大小（帧数）
   */
  constructor(windowSize = 5) {
    this.history = [];
    this.windowSize = windowSize;
  }

  /**
   * 添加新的关键点数据并返回平滑后的结果
   * @param {Array<{x: number, y: number, z?: number, visibility: number}>} landmarks 
   * @returns {Array<{x: number, y: number, z: number, visibility: number}>}
   */
  add(landmarks) {
    this.history.push(landmarks);
    if (this.history.length > this.windowSize) {
      this.history.shift();
    }
    return this.getSmoothed();
  }

  /**
   * 获取平滑后的关键点
   * @returns {Array<{x: number, y: number, z: number, visibility: number}>}
   */
  getSmoothed() {
    if (this.history.length === 0) return null;
    
    const numLandmarks = this.history[0].length;
    const smoothed = [];
    
    for (let i = 0; i < numLandmarks; i++) {
      let sumX = 0, sumY = 0, sumZ = 0, sumVis = 0;
      let count = 0;
      
      for (const frame of this.history) {
        if (frame[i] && frame[i].visibility > 0.5) {
          sumX += frame[i].x;
          sumY += frame[i].y;
          sumZ += frame[i].z || 0;
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
        // 使用最新的数据
        smoothed.push(this.history[this.history.length - 1][i]);
      }
    }
    
    return smoothed;
  }

  /**
   * 清空历史
   */
  clear() {
    this.history = [];
  }
}

/**
 * 指数移动平均平滑器（更低延迟）
 */
export class ExponentialSmoother {
  /**
   * @param {number} alpha - 平滑系数（0-1，越大越接近原始数据）
   */
  constructor(alpha = 0.5) {
    this.alpha = alpha;
    this.previous = null;
  }

  /**
   * 平滑单个关键点
   * @param {{x: number, y: number, z?: number, visibility: number}} landmark 
   * @returns {{x: number, y: number, z: number, visibility: number}}
   */
  smooth(landmark) {
    if (!this.previous) {
      this.previous = { ...landmark, z: landmark.z || 0 };
      return this.previous;
    }

    const smoothed = {
      x: this.alpha * landmark.x + (1 - this.alpha) * this.previous.x,
      y: this.alpha * landmark.y + (1 - this.alpha) * this.previous.y,
      z: this.alpha * (landmark.z || 0) + (1 - this.alpha) * this.previous.z,
      visibility: landmark.visibility
    };

    this.previous = smoothed;
    return smoothed;
  }

  /**
   * 重置
   */
  reset() {
    this.previous = null;
  }
}

/**
 * 速度计算器
 */
export class VelocityCalculator {
  constructor() {
    this.previous = null;
    this.previousTime = null;
  }

  /**
   * 计算关键点的速度
   * @param {{x: number, y: number}} landmark - 当前关键点
   * @param {number} timestamp - 当前时间戳（ms）
   * @returns {{vx: number, vy: number, speed: number}} 速度信息
   */
  calculate(landmark, timestamp) {
    if (!this.previous || !this.previousTime) {
      this.previous = { ...landmark };
      this.previousTime = timestamp;
      return { vx: 0, vy: 0, speed: 0 };
    }

    const dt = (timestamp - this.previousTime) / 1000; // 秒
    if (dt === 0) {
      return { vx: 0, vy: 0, speed: 0 };
    }

    const vx = (landmark.x - this.previous.x) / dt;
    const vy = (landmark.y - this.previous.y) / dt;
    const speed = Math.sqrt(vx * vx + vy * vy);

    this.previous = { ...landmark };
    this.previousTime = timestamp;

    return { vx, vy, speed };
  }

  /**
   * 重置
   */
  reset() {
    this.previous = null;
    this.previousTime = null;
  }
}

/**
 * 关键点追踪器（整合平滑和速度计算）
 */
export class LandmarkTracker {
  /**
   * @param {Object} options - 配置选项
   * @param {number} options.smoothingWindow - 平滑窗口大小
   * @param {number} options.smoothingAlpha - 指数平滑系数
   * @param {boolean} options.useExponential - 是否使用指数平滑
   */
  constructor(options = {}) {
    this.smoother = options.useExponential
      ? new ExponentialSmoother(options.smoothingAlpha || 0.5)
      : new LandmarkSmoother(options.smoothingWindow || 5);
    this.velocityCalc = new VelocityCalculator();
  }

  /**
   * 处理关键点数据
   * @param {Array} landmarks - 原始关键点
   * @param {number} timestamp - 时间戳
   * @returns {{landmarks: Array, velocities: Array}}
   */
  process(landmarks, timestamp = Date.now()) {
    let smoothed;
    
    if (this.smoother instanceof ExponentialSmoother) {
      smoothed = landmarks.map(lm => this.smoother.smooth(lm));
    } else {
      smoothed = this.smoother.add(landmarks);
    }

    const velocities = smoothed.map(lm => 
      this.velocityCalc.calculate(lm, timestamp)
    );

    return { landmarks: smoothed, velocities };
  }

  /**
   * 重置
   */
  reset() {
    this.smoother.clear?.() || this.smoother.reset?.();
    this.velocityCalc.reset();
  }
}
