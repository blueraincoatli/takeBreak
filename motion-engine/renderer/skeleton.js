/**
 * 骨骼渲染器 - 在 Canvas 上绘制姿态关键点和骨骼
 * @module motion-engine/renderer/skeleton
 */

import { POSE_CONNECTIONS } from '../core/detector.js';

/**
 * 默认渲染样式
 */
const DEFAULT_STYLE = {
  lineColor: '#00ff88',
  lineWidth: 2,
  pointColor: '#00ccff',
  pointRadius: 4,
  highlightColor: '#ffcc00',
  lowConfidenceColor: '#ff4444',
  confidenceThreshold: 0.5
};

/**
 * 骨骼渲染器
 */
export class SkeletonRenderer {
  /** @type {HTMLCanvasElement} */
  #canvas = null;
  /** @type {CanvasRenderingContext2D} */
  #ctx = null;
  /** @type {Object} */
  #style = { ...DEFAULT_STYLE };
  /** @type {Map<string, string>} */
  #highlightedConnections = new Map();
  /** @type {Map<number, string>} */
  #highlightedLandmarks = new Map();
  /** @type {boolean} */
  #mirror = true;

  /**
   * @param {HTMLCanvasElement} canvas - 目标画布
   */
  constructor(canvas) {
    this.#canvas = canvas;
    this.#ctx = canvas.getContext('2d');
  }

  /**
   * 设置渲染样式
   * @param {Object} style - 样式配置
   */
  setStyle(style) {
    this.#style = { ...DEFAULT_STYLE, ...style };
  }

  /**
   * 设置镜像模式
   * @param {boolean} mirror - 是否镜像
   */
  setMirror(mirror) {
    this.#mirror = mirror;
  }

  /**
   * 高亮特定连接
   * @param {number} from - 起点索引
   * @param {number} to - 终点索引
   * @param {string} color - 颜色
   */
  highlightConnection(from, to, color) {
    this.#highlightedConnections.set(`${from}-${to}`, color);
  }

  /**
   * 高亮特定关键点
   * @param {number} index - 关键点索引
   * @param {string} color - 颜色
   */
  highlightLandmark(index, color) {
    this.#highlightedLandmarks.set(index, color);
  }

  /**
   * 清除所有高亮
   */
  clearHighlights() {
    this.#highlightedConnections.clear();
    this.#highlightedLandmarks.clear();
  }

  /**
   * 清空画布
   */
  clear() {
    this.#ctx.clearRect(0, 0, this.#canvas.width, this.#canvas.height);
  }

  /**
   * 渲染姿态
   * @param {Object} poseResult - 检测结果
   * @param {Object} options - 渲染选项
   */
  render(poseResult, options = {}) {
    const {
      showSkeleton = true,
      showPoints = true,
      mirror = this.#mirror
    } = options;

    const landmarks = poseResult.landmarks;
    if (!landmarks) return;

    this.clear();

    const width = this.#canvas.width;
    const height = this.#canvas.height;

    // 绘制骨骼连接
    if (showSkeleton) {
      for (const [from, to] of POSE_CONNECTIONS) {
        const fromPoint = landmarks[from];
        const toPoint = landmarks[to];

        if (!fromPoint || !toPoint) continue;
        if (fromPoint.visibility < this.#style.confidenceThreshold ||
            toPoint.visibility < this.#style.confidenceThreshold) {
          continue;
        }

        // 计算坐标（镜像时翻转 x）
        let x1 = fromPoint.x * width;
        let y1 = fromPoint.y * height;
        let x2 = toPoint.x * width;
        let y2 = toPoint.y * height;

        if (mirror) {
          x1 = width - x1;
          x2 = width - x2;
        }

        // 检查是否有高亮
        const connectionKey = `${from}-${to}`;
        const reverseKey = `${to}-${from}`;
        const highlightColor = this.#highlightedConnections.get(connectionKey) ||
                               this.#highlightedConnections.get(reverseKey);

        this.#ctx.beginPath();
        this.#ctx.moveTo(x1, y1);
        this.#ctx.lineTo(x2, y2);
        this.#ctx.strokeStyle = highlightColor || this.#style.lineColor;
        this.#ctx.lineWidth = this.#style.lineWidth;
        this.#ctx.stroke();
      }
    }

    // 绘制关键点
    if (showPoints) {
      for (let i = 0; i < landmarks.length; i++) {
        const point = landmarks[i];
        if (!point || point.visibility < this.#style.confidenceThreshold) {
          continue;
        }

        let x = point.x * width;
        let y = point.y * height;

        if (mirror) {
          x = width - x;
        }

        const isHighlighted = this.#highlightedLandmarks.has(i);
        const color = isHighlighted ? 
          this.#highlightedLandmarks.get(i) :
          (point.visibility < 0.7 ? this.#style.lowConfidenceColor : this.#style.pointColor);

        this.#ctx.beginPath();
        this.#ctx.arc(x, y, this.#style.pointRadius, 0, 2 * Math.PI);
        this.#ctx.fillStyle = color;
        this.#ctx.fill();
      }
    }
  }

  /**
   * 绘制背景图像（摄像头帧）
   * @param {HTMLVideoElement} video - 视频元素
   */
  drawBackground(video) {
    this.#ctx.save();
    
    if (this.#mirror) {
      this.#ctx.scale(-1, 1);
      this.#ctx.translate(-this.#canvas.width, 0);
    }
    
    this.#ctx.drawImage(video, 0, 0, this.#canvas.width, this.#canvas.height);
    this.#ctx.restore();
  }

  /**
   * 绘制覆盖层
   * @param {string} color - 颜色
   * @param {number} alpha - 透明度
   */
  drawOverlay(color = '#000000', alpha = 0.3) {
    this.#ctx.fillStyle = color;
    this.#ctx.globalAlpha = alpha;
    this.#ctx.fillRect(0, 0, this.#canvas.width, this.#canvas.height);
    this.#ctx.globalAlpha = 1;
  }

  /**
   * 绘制文字
   * @param {string} text - 文字内容
   * @param {number} x - X坐标
   * @param {number} y - Y坐标
   * @param {Object} options - 选项
   */
  drawText(text, x, y, options = {}) {
    const {
      font = '16px Arial',
      color = '#ffffff',
      align = 'left',
      baseline = 'top'
    } = options;

    this.#ctx.font = font;
    this.#ctx.fillStyle = color;
    this.#ctx.textAlign = align;
    this.#ctx.textBaseline = baseline;
    
    if (this.#mirror && align === 'left') {
      x = this.#canvas.width - x;
      this.#ctx.textAlign = 'right';
    }
    
    this.#ctx.fillText(text, x, y);
  }

  /**
   * 调整画布尺寸
   * @param {number} width - 宽度
   * @param {number} height - 高度
   */
  resize(width, height) {
    this.#canvas.width = width;
    this.#canvas.height = height;
  }
}

export default SkeletonRenderer;