/**
 * 运动检测器 - 基于 MediaPipe Pose
 * @module motion-engine/core/detector
 */

import { FilesetResolver, PoseLandmarker } from '@mediapipe/tasks-vision';

/**
 * MediaPipe Pose 关键点索引
 */
export const POSE_LANDMARKS = {
  NOSE: 0,
  LEFT_EYE_INNER: 1,
  LEFT_EYE: 2,
  LEFT_EYE_OUTER: 3,
  RIGHT_EYE_INNER: 4,
  RIGHT_EYE: 5,
  RIGHT_EYE_OUTER: 6,
  LEFT_EAR: 7,
  RIGHT_EAR: 8,
  MOUTH_LEFT: 9,
  MOUTH_RIGHT: 10,
  LEFT_SHOULDER: 11,
  RIGHT_SHOULDER: 12,
  LEFT_ELBOW: 13,
  RIGHT_ELBOW: 14,
  LEFT_WRIST: 15,
  RIGHT_WRIST: 16,
  LEFT_PINKY: 17,
  RIGHT_PINKY: 18,
  LEFT_INDEX: 19,
  RIGHT_INDEX: 20,
  LEFT_THUMB: 21,
  RIGHT_THUMB: 22,
  LEFT_HIP: 23,
  RIGHT_HIP: 24,
  LEFT_KNEE: 25,
  RIGHT_KNEE: 26,
  LEFT_ANKLE: 27,
  RIGHT_ANKLE: 28,
  LEFT_HEEL: 29,
  RIGHT_HEEL: 30,
  LEFT_FOOT_INDEX: 31,
  RIGHT_FOOT_INDEX: 32
};

/**
 * 骨骼连接定义
 */
export const POSE_CONNECTIONS = [
  // 躯干
  [11, 12], // 左肩 - 右肩
  [11, 23], // 左肩 - 左髋
  [12, 24], // 右肩 - 右髋
  [23, 24], // 左髋 - 右髋
  
  // 左臂
  [11, 13], // 左肩 - 左肘
  [13, 15], // 左肘 - 左腕
  [15, 17], // 左腕 - 左小指
  [15, 19], // 左腕 - 左食指
  [15, 21], // 左腕 - 左拇指
  
  // 右臂
  [12, 14], // 右肩 - 右肘
  [14, 16], // 右肘 - 右腕
  [16, 18], // 右腕 - 右小指
  [16, 20], // 右腕 - 右食指
  [16, 22], // 右腕 - 右拇指
  
  // 左腿
  [23, 25], // 左髋 - 左膝
  [25, 27], // 左膝 - 左踝
  [27, 29], // 左踝 - 左脚跟
  [27, 31], // 左踝 - 左脚尖
  [29, 31], // 左脚跟 - 左脚尖
  
  // 右腿
  [24, 26], // 右髋 - 右膝
  [26, 28], // 右膝 - 右踝
  [28, 30], // 右踝 - 右脚跟
  [28, 32], // 右踝 - 右脚尖
  [30, 32], // 右脚跟 - 右脚尖
];

/**
 * 检测结果类型
 * @typedef {Object} PoseResult
 * @property {number} timestamp - 时间戳
 * @property {Array<{x: number, y: number, z: number, visibility: number}>} landmarks - 归一化关键点
 * @property {Array<{x: number, y: number, z: number}>} worldLandmarks - 3D坐标（米）
 */

/**
 * 运动检测器类
 */
export class MotionDetector extends EventTarget {
  #poseLandmarker = null;
  #videoElement = null;
  #canvasElement = null;
  #isRunning = false;
  #isInitialized = false;
  #lastFrameTime = 0;
  #frameCount = 0;
  #fpsHistory = [];
  
  /** @type {number} 目标帧率 */
  targetFps = 30;
  
  /** @type {number} 最小检测置信度 */
  minDetectionConfidence = 0.5;
  
  /** @type {number} 最小追踪置信度 */
  minTrackingConfidence = 0.5;
  
  /** @type {number} 最小存在置信度 */
  minPresenceConfidence = 0.5;

  /**
   * @param {Object} options - 配置选项
   * @param {HTMLVideoElement} options.videoElement - 视频元素
   * @param {HTMLCanvasElement} [options.canvasElement] - 画布元素（可选）
   * @param {string} [options.modelPath] - 模型路径
   * @param {number} [options.targetFps] - 目标帧率
   */
  constructor(options) {
    super();
    this.#videoElement = options.videoElement;
    this.#canvasElement = options.canvasElement;
    this.modelPath = options.modelPath;
    
    if (options.targetFps) this.targetFps = options.targetFps;
    
    this.onResults = this.onResults.bind(this);
  }

  /**
   * 是否已初始化
   */
  get isInitialized() {
    return this.#isInitialized;
  }

  /**
   * 是否正在运行
   */
  get isRunning() {
    return this.#isRunning;
  }

  /**
   * 当前帧率
   */
  get fps() {
    if (this.#fpsHistory.length === 0) return 0;
    return Math.round(this.#fpsHistory.reduce((a, b) => a + b, 0) / this.#fpsHistory.length);
  }

  /**
   * 初始化检测器
   */
  async initialize() {
    try {
      // 加载 MediaPipe Vision Tasks
      const vision = await FilesetResolver.forVisionTasks(
        'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm'
      );

      // 创建 PoseLandmarker
      this.#poseLandmarker = await PoseLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: this.modelPath || 
            'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task',
          delegate: 'GPU'
        },
        runningMode: 'VIDEO',
        numPoses: 1,
        minPoseDetectionConfidence: this.minDetectionConfidence,
        minPosePresenceConfidence: this.minPresenceConfidence,
        minTrackingConfidence: this.minTrackingConfidence
      });

      this.#isInitialized = true;
      this.dispatchEvent(new CustomEvent('ready'));
      
      return true;
    } catch (error) {
      this.dispatchEvent(new CustomEvent('error', { detail: error }));
      throw error;
    }
  }

  /**
   * 启动摄像头和检测
   */
  async start() {
    if (!this.#isInitialized) {
      await this.initialize();
    }

    if (this.#isRunning) {
      return;
    }

    try {
      // 获取摄像头
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: 'user'
        }
      });

      this.#videoElement.srcObject = stream;
      await this.#videoElement.play();

      this.#isRunning = true;
      this.#lastFrameTime = performance.now();
      
      // 开始检测循环
      this.detectLoop();
      
      this.dispatchEvent(new CustomEvent('started'));
    } catch (error) {
      this.dispatchEvent(new CustomEvent('error', { detail: error }));
      throw error;
    }
  }

  /**
   * 检测循环
   */
  detectLoop() {
    if (!this.#isRunning) return;

    const now = performance.now();
    const elapsed = now - this.#lastFrameTime;
    const targetInterval = 1000 / this.targetFps;

    if (elapsed >= targetInterval) {
      // 计算 FPS
      if (this.#fpsHistory.length > 10) {
        this.#fpsHistory.shift();
      }
      this.#fpsHistory.push(1000 / elapsed);

      // 执行检测
      this.detect();
      this.#lastFrameTime = now;
    }

    requestAnimationFrame(() => this.detectLoop());
  }

  /**
   * 执行单次检测
   */
  detect() {
    if (!this.#poseLandmarker || !this.#videoElement) return;

    const timestamp = performance.now();
    
    try {
      const results = this.#poseLandmarker.detectForVideo(this.#videoElement, timestamp);
      
      if (results.landmarks && results.landmarks.length > 0) {
        const poseResult = {
          timestamp,
          landmarks: results.landmarks[0],
          worldLandmarks: results.worldLandmarks?.[0] || null
        };

        this.dispatchEvent(new CustomEvent('pose', { detail: poseResult }));
        this.#frameCount++;
      }
    } catch (error) {
      this.dispatchEvent(new CustomEvent('error', { detail: error }));
    }
  }

  /**
   * 停止检测
   */
  stop() {
    this.#isRunning = false;

    // 停止摄像头
    if (this.#videoElement.srcObject) {
      const tracks = this.#videoElement.srcObject.getTracks();
      tracks.forEach(track => track.stop());
      this.#videoElement.srcObject = null;
    }

    this.dispatchEvent(new CustomEvent('stopped'));
  }

  /**
   * 销毁检测器
   */
  destroy() {
    this.stop();
    
    if (this.#poseLandmarker) {
      this.#poseLandmarker.close();
      this.#poseLandmarker = null;
    }

    this.#isInitialized = false;
    this.#fpsHistory = [];
    this.#frameCount = 0;
  }
}

// 导出默认
export default MotionDetector;