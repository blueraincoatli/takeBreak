/**
 * 深蹲动作检测器（支持半身模式）
 * @module motion-engine/actions/squat
 */

import { ActionAnalyzer } from './base.js';
import { POSE_LANDMARKS } from '../core/detector.js';
import { threePointAngle, distance } from '../utils/geometry.js';

/**
 * 深蹲检测器默认阈值
 */
const DEFAULT_THRESHOLDS = {
  // 全身模式
  minDescent: 0.2,        // 最小下降比例（相对于身高）
  goodDescent: 0.3,       // 良好下降比例
  maxKneeAngle: 110,      // 最大膝盖角度（度）
  minKneeAngle: 70,       // 最小膝盖角度
  maxBackAngle: 30,       // 最大背部倾斜角度
  minHoldFrames: 2,       // 底部停留帧数
  maxSpeed: 0.03,         // 最大速度（防止抖动误触发）
  smoothingWindow: 3,     // 平滑窗口
  
  // 半身模式（座位起立）
  minShoulderRise: 0.15,  // 最小肩膀上移（相对于脸高）
  goodShoulderRise: 0.25, // 良好上移
  seatedSmoothingWindow: 5
};

/**
 * 深蹲检测器（支持全身和半身模式）
 */
export class SquatAnalyzer extends ActionAnalyzer {
  name = 'squat';
  
  /** @type {string} 内部状态 */
  #internalState = 'STANDING';
  
  /** @type {boolean} 是否全身模式 */
  #isFullBody = false;
  
  /** @type {number} 站立时的髋部/肩膀高度参考 */
  #standingRefY = null;
  
  /** @type {number} 身高参考 */
  #height = null;
  
  /** @type {number} 脸高参考（半身模式） */
  #faceHeight = null;
  
  /** @type {number[]} 深度历史 */
  #depthHistory = [];
  
  /** @type {number} 底部停留帧计数 */
  #bottomFrameCount = 0;

  /**
   * @param {Object} config - 配置
   */
  constructor(config = {}) {
    super({
      name: 'squat',
      targetCount: config.targetCount || 10,
      thresholds: { ...DEFAULT_THRESHOLDS, ...config.thresholds }
    });
  }

  /**
   * 重置
   */
  reset() {
    super.reset();
    this.#internalState = 'STANDING';
    this.#standingRefY = null;
    this.#height = null;
    this.#faceHeight = null;
    this.#depthHistory = [];
    this.#bottomFrameCount = 0;
  }

  /**
   * 分析检测结果
   * @param {Object} poseResult - 检测结果
   * @returns {Object} 动作状态
   */
  analyze(poseResult) {
    const landmarks = poseResult.landmarks;
    if (!landmarks) return this.currentState;

    // 提取关键点
    const nose = landmarks[POSE_LANDMARKS.NOSE];
    const leftShoulder = landmarks[POSE_LANDMARKS.LEFT_SHOULDER];
    const rightShoulder = landmarks[POSE_LANDMARKS.RIGHT_SHOULDER];
    const leftHip = landmarks[POSE_LANDMARKS.LEFT_HIP];
    const rightHip = landmarks[POSE_LANDMARKS.RIGHT_HIP];
    const leftKnee = landmarks[POSE_LANDMARKS.LEFT_KNEE];
    const rightKnee = landmarks[POSE_LANDMARKS.RIGHT_KNEE];
    const leftAnkle = landmarks[POSE_LANDMARKS.LEFT_ANKLE];
    const rightAnkle = landmarks[POSE_LANDMARKS.RIGHT_ANKLE];

    // 检测是否全身可见
    const hasFullBody = leftHip?.visibility > 0.5 && 
                        rightHip?.visibility > 0.5 && 
                        leftAnkle?.visibility > 0.5 && 
                        rightAnkle?.visibility > 0.5;

    // 根据模式选择分析
    if (hasFullBody) {
      this.#isFullBody = true;
      return this.#analyzeFullSquat(landmarks);
    } else {
      this.#isFullBody = false;
      return this.#analyzeSeatedMovement(landmarks);
    }
  }

  /**
   * 全身模式：深蹲检测
   */
  #analyzeFullSquat(landmarks) {
    const leftHip = landmarks[POSE_LANDMARKS.LEFT_HIP];
    const rightHip = landmarks[POSE_LANDMARKS.RIGHT_HIP];
    const leftKnee = landmarks[POSE_LANDMARKS.LEFT_KNEE];
    const rightKnee = landmarks[POSE_LANDMARKS.RIGHT_KNEE];
    const leftAnkle = landmarks[POSE_LANDMARKS.LEFT_ANKLE];
    const rightAnkle = landmarks[POSE_LANDMARKS.RIGHT_ANKLE];
    const nose = landmarks[POSE_LANDMARKS.NOSE];
    const leftShoulder = landmarks[POSE_LANDMARKS.LEFT_SHOULDER];
    const rightShoulder = landmarks[POSE_LANDMARKS.RIGHT_SHOULDER];

    const hipY = (leftHip.y + rightHip.y) / 2;
    const ankleY = (leftAnkle.y + rightAnkle.y) / 2;
    
    // 计算身高
    if (nose && nose.visibility > 0.5) {
      this.#height = Math.abs(nose.y - ankleY);
    }

    // 初始化参考
    if (!this.#standingRefY && this.#internalState === 'STANDING') {
      this.#standingRefY = hipY;
    }

    // 计算深度
    let depthRatio = 0;
    if (this.#standingRefY && this.#height) {
      const descent = Math.max(0, hipY - this.#standingRefY);
      depthRatio = descent / this.#height;
    }

    // 计算膝盖角度
    const leftKneeAngle = threePointAngle(leftHip, leftKnee, leftAnkle);
    const rightKneeAngle = threePointAngle(rightHip, rightKnee, rightAnkle);
    const kneeAngle = Math.min(leftKneeAngle, rightKneeAngle);

    // 计算背部角度
    const shoulderMid = {
      x: (leftShoulder.x + rightShoulder.x) / 2,
      y: (leftShoulder.y + rightShoulder.y) / 2
    };
    const hipMid = {
      x: (leftHip.x + rightHip.x) / 2,
      y: (leftHip.y + rightHip.y) / 2
    };
    const backAngle = Math.abs(
      Math.atan2(shoulderMid.x - hipMid.x, -(shoulderMid.y - hipMid.y)) * 180 / Math.PI
    );

    // 平滑
    this.#depthHistory.push(depthRatio);
    if (this.#depthHistory.length > this.thresholds.smoothingWindow) {
      this.#depthHistory.shift();
    }
    const smoothDepth = this.#depthHistory.reduce((a, b) => a + b, 0) / this.#depthHistory.length;

    // 速度
    const velocity = this.#depthHistory.length > 1 ?
      this.#depthHistory[this.#depthHistory.length - 1] - this.#depthHistory[this.#depthHistory.length - 2] : 0;

    // 状态机
    this.#processFullBodyState({ smoothDepth, kneeAngle, backAngle, velocity });

    return this.currentState;
  }

  /**
   * 半身模式：座位起立检测
   */
  #analyzeSeatedMovement(landmarks) {
    const nose = landmarks[POSE_LANDMARKS.NOSE];
    const leftShoulder = landmarks[POSE_LANDMARKS.LEFT_SHOULDER];
    const rightShoulder = landmarks[POSE_LANDMARKS.RIGHT_SHOULDER];

    const shoulderY = (leftShoulder.y + rightShoulder.y) / 2;
    
    // 计算脸高作为尺度
    if (nose && nose.visibility > 0.5) {
      const mouth = landmarks[POSE_LANDMARKS.MOUTH_LEFT] || landmarks[POSE_LANDMARKS.MOUTH_RIGHT];
      if (mouth) {
        this.#faceHeight = Math.abs(nose.y - mouth.y) * 3; // 估算脸高
      }
    }

    // 初始化参考
    if (!this.#standingRefY && this.#internalState === 'STANDING') {
      this.#standingRefY = shoulderY;
    }

    // 计算位移（负值=上移=站起）
    let displacement = 0;
    if (this.#standingRefY && this.#faceHeight) {
      displacement = (shoulderY - this.#standingRefY) / this.#faceHeight;
    }

    // 平滑
    this.#depthHistory.push(displacement);
    if (this.#depthHistory.length > this.thresholds.seatedSmoothingWindow) {
      this.#depthHistory.shift();
    }
    const smooth = this.#depthHistory.reduce((a, b) => a + b, 0) / this.#depthHistory.length;

    // 状态机
    this.#processSeatedState({ smooth });

    return this.currentState;
  }

  /**
   * 全身状态机
   */
  #processFullBodyState(metrics) {
    const { smoothDepth, kneeAngle, backAngle, velocity } = metrics;
    const t = this.thresholds;

    switch (this.#internalState) {
      case 'STANDING':
        if (smoothDepth > t.minDescent) {
          this.#internalState = 'DESCENDING';
          this.updateState({ phase: 'active', feedback: '下蹲中...' });
        }
        break;

      case 'DESCENDING':
        if (smoothDepth > t.goodDescent && Math.abs(velocity) < t.maxSpeed) {
          this.#internalState = 'BOTTOM';
          this.#bottomFrameCount = 0;
          this.updateState({ feedback: '保持！' });
        } else if (smoothDepth < t.minDescent) {
          this.#internalState = 'STANDING';
          this.updateState({ feedback: '再深一点' });
        }
        break;

      case 'BOTTOM':
        this.#bottomFrameCount++;
        if (this.#bottomFrameCount >= t.minHoldFrames) {
          this.#internalState = 'ASCENDING';
        }
        break;

      case 'ASCENDING':
        if (smoothDepth < t.minDescent) {
          this.#internalState = 'COUNTED';
          this.incrementCount(0.8);
          this.updateState({ count: this.count, feedback: `第 ${this.count} 个！` });
          setTimeout(() => {
            if (this.#internalState === 'COUNTED') {
              this.#internalState = 'STANDING';
              this.updateState({ phase: 'preparing' });
            }
          }, 300);
        }
        break;
    }
  }

  /**
   * 半身状态机
   */
  #processSeatedState(metrics) {
    const { smooth } = metrics;
    const t = this.thresholds;

    switch (this.#internalState) {
      case 'STANDING':
        if (smooth < -t.minShoulderRise) { // 上移
          this.#internalState = 'ASCENDING';
          this.updateState({ phase: 'active', feedback: '站起来了！' });
        }
        break;

      case 'ASCENDING':
        if (Math.abs(smooth) < 0.05) { // 稳定
          this.#internalState = 'COUNTED';
          this.incrementCount(0.7);
          this.updateState({ count: this.count, feedback: `第 ${this.count} 个！` });
          setTimeout(() => {
            if (this.#internalState === 'COUNTED') {
              this.#internalState = 'STANDING';
              this.updateState({ phase: 'preparing' });
            }
          }, 300);
        }
        break;
    }
  }
}

export default SquatAnalyzer;