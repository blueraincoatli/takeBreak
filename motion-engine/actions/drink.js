/**
 * 喝水动作检测器
 * @module motion-engine/actions/drink
 */

import { ActionAnalyzer } from './base.js';
import { POSE_LANDMARKS } from '../core/detector.js';
import { pointInEllipse, distance } from '../utils/geometry.js';

/**
 * 喝水检测器默认阈值
 */
const DEFAULT_THRESHOLDS = {
  minDuration: 2000,        // 最小持续时间 (ms)
  confirmationTime: 1000,   // 确认时间 (ms)
  mouthRegionRadiusX: 0.12, // 嘴部区域 X 半径
  mouthRegionRadiusY: 0.08, // 嘴部区域 Y 半径
  minVisibility: 0.6        // 最小可见度
};

/**
 * 喝水检测器
 */
export class DrinkAnalyzer extends ActionAnalyzer {
  name = 'drink';
  
  /** @type {string} 内部状态 */
  #internalState = 'IDLE';
  
  /** @type {number|null} 开始时间 */
  #startTime = null;
  
  /** @type {number} 持续时间 */
  #duration = 0;
  
  /** @type {boolean} 是否已检测到手接近嘴 */
  #handNearMouth = false;

  /**
   * @param {Object} config - 配置
   */
  constructor(config = {}) {
    super({
      name: 'drink',
      targetCount: config.targetCount || 1,
      thresholds: { ...DEFAULT_THRESHOLDS, ...config.thresholds }
    });
  }

  /**
   * 重置
   */
  reset() {
    super.reset();
    this.#internalState = 'IDLE';
    this.#startTime = null;
    this.#duration = 0;
    this.#handNearMouth = false;
  }

  /**
   * 分析检测结果
   * @param {Object} poseResult - 检测结果
   * @returns {Object} 动作状态
   */
  analyze(poseResult) {
    const landmarks = poseResult.landmarks;
    if (!landmarks) return this.currentState;

    const timestamp = poseResult.timestamp || Date.now();

    // 获取关键点
    const nose = landmarks[POSE_LANDMARKS.NOSE];
    const mouthLeft = landmarks[POSE_LANDMARKS.MOUTH_LEFT];
    const mouthRight = landmarks[POSE_LANDMARKS.MOUTH_RIGHT];
    
    // 手部关键点（手腕、食指、小指、拇指）
    const leftWrist = landmarks[POSE_LANDMARKS.LEFT_WRIST];
    const rightWrist = landmarks[POSE_LANDMARKS.RIGHT_WRIST];
    const leftIndex = landmarks[POSE_LANDMARKS.LEFT_INDEX];
    const rightIndex = landmarks[POSE_LANDMARKS.RIGHT_INDEX];
    const leftPinky = landmarks[POSE_LANDMARKS.LEFT_PINKY];
    const rightPinky = landmarks[POSE_LANDMARKS.RIGHT_PINKY];
    const leftThumb = landmarks[POSE_LANDMARKS.LEFT_THUMB];
    const rightThumb = landmarks[POSE_LANDMARKS.RIGHT_THUMB];

    // 检查关键点可见性
    if (!nose || nose.visibility < this.thresholds.minVisibility) {
      this.updateState({
        phase: 'idle',
        feedback: '请面向摄像头'
      });
      return this.currentState;
    }

    // 计算嘴部中心
    let mouthCenter = { x: nose.x, y: nose.y + 0.03 }; // 默认使用鼻子下方
    if (mouthLeft && mouthRight && 
        mouthLeft.visibility > 0.5 && mouthRight.visibility > 0.5) {
      mouthCenter = {
        x: (mouthLeft.x + mouthRight.x) / 2,
        y: (mouthLeft.y + mouthRight.y) / 2
      };
    }

    // 检测手是否接近嘴
    const handPoints = [
      { point: rightWrist, side: 'right' },
      { point: leftWrist, side: 'left' },
      { point: rightIndex, side: 'right' },
      { point: leftIndex, side: 'left' },
      { point: rightPinky, side: 'right' },
      { point: leftPinky, side: 'left' },
      { point: rightThumb, side: 'right' },
      { point: leftThumb, side: 'left' }
    ];

    let isNear = false;
    let nearestDistance = Infinity;

    for (const { point } of handPoints) {
      if (!point || point.visibility < this.thresholds.minVisibility) continue;

      // 计算到嘴部中心的距离
      const dist = distance(point, mouthCenter);
      
      // 检查是否在嘴部区域内
      if (pointInEllipse(point, mouthCenter, 
          this.thresholds.mouthRegionRadiusX, 
          this.thresholds.mouthRegionRadiusY)) {
        isNear = true;
        nearestDistance = Math.min(nearestDistance, dist);
      }
    }

    // 计算进度（基于距离）
    const proximityProgress = isNear ? 
      Math.max(0, 1 - nearestDistance / this.thresholds.mouthRegionRadiusX) : 0;

    // 状态机处理
    this.#processState(isNear, proximityProgress, timestamp);

    return this.currentState;
  }

  /**
   * 处理状态转换
   * @param {boolean} isNear - 手是否接近嘴
   * @param {number} proximityProgress - 接近进度
   * @param {number} timestamp - 时间戳
   */
  #processState(isNear, proximityProgress, timestamp) {
    const t = this.thresholds;

    switch (this.#internalState) {
      case 'IDLE':
        if (isNear) {
          this.#internalState = 'APPROACHING';
          this.#startTime = timestamp;
          this.updateState({
            phase: 'preparing',
            feedback: '检测到喝水动作...'
          });
        } else {
          this.updateState({
            phase: 'idle',
            feedback: '请拿起水杯喝水'
          });
        }
        break;

      case 'APPROACHING':
        if (!isNear) {
          // 手离开了，但时间不够
          this.#internalState = 'IDLE';
          this.#startTime = null;
          this.updateState({
            phase: 'idle',
            feedback: '请保持动作'
          });
        } else {
          const elapsed = timestamp - this.#startTime;
          const progress = Math.min(1, elapsed / t.confirmationTime);

          if (elapsed >= t.confirmationTime) {
            this.#internalState = 'DRINKING';
            this.emitFeedback('很好，继续喝水', 'success');
          }

          this.updateState({
            phase: 'preparing',
            progress: progress * 0.5, // 前50%进度
            feedback: `保持住...`
          });
        }
        break;

      case 'DRINKING':
        if (!isNear) {
          // 手离开嘴
          const elapsed = timestamp - this.#startTime;
          
          if (elapsed >= t.minDuration) {
            // 完成喝水
            this.#internalState = 'COMPLETED';
            this.#duration = elapsed;
            this.incrementCount(1);
            
            this.updateState({
              phase: 'completed',
              progress: 1,
              feedback: '喝水完成！'
            });
            
            this.emitFeedback('太好了！记得多喝水', 'success');
          } else {
            // 时间不够
            this.#internalState = 'IDLE';
            this.#startTime = null;
            this.updateState({
              phase: 'idle',
              feedback: '喝水时间太短'
            });
            this.emitFeedback('多喝几口', 'warning');
          }
        } else {
          // 继续喝水
          const elapsed = timestamp - this.#startTime;
          const progress = Math.min(1, 
            t.confirmationTime / t.minDuration + 
            (elapsed - t.confirmationTime) / (t.minDuration - t.confirmationTime) * 0.5
          );

          this.updateState({
            phase: 'active',
            progress: progress,
            feedback: `${Math.round(elapsed / 1000)}秒`
          });
        }
        break;

      case 'COMPLETED':
        // 保持完成状态，直到被重置
        break;
    }
  }

  /**
   * 获取喝水持续时间
   * @returns {number}
   */
  get duration() {
    return this.#duration;
  }
}

export default DrinkAnalyzer;