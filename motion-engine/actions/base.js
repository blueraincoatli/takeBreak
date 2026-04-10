/**
 * 动作分析器基类
 * @module motion-engine/actions/base
 */

/**
 * 动作状态
 * @typedef {'idle' | 'preparing' | 'active' | 'completed'} ActionPhase
 */

/**
 * 反馈级别
 * @typedef {'info' | 'warning' | 'success' | 'error'} FeedbackLevel
 */

/**
 * 动作状态
 * @typedef {Object} ActionState
 * @property {ActionPhase} phase - 当前阶段
 * @property {number} count - 完成次数
 * @property {number} progress - 当前进度 (0-1)
 * @property {number} quality - 动作质量 (0-1)
 * @property {string} feedback - 反馈信息
 * @property {Object} [details] - 额外详情
 */

/**
 * 动作分析器基类
 */
export class ActionAnalyzer extends EventTarget {
  /** @type {string} 动作名称 */
  name = 'base';
  
  /** @type {number} 目标次数 */
  targetCount = 10;
  
  /** @type {ActionPhase} 当前阶段 */
  phase = 'idle';
  
  /** @type {number} 当前计数 */
  count = 0;
  
  /** @type {Object} 阈值配置 */
  thresholds = {};
  
  /** @type {Object} 当前状态 */
  currentState = null;
  
  /** @type {number[]} 质量历史 */
  qualityHistory = [];

  /**
   * @param {Object} config - 配置
   * @param {string} config.name - 动作名称
   * @param {number} config.targetCount - 目标次数
   * @param {Object} config.thresholds - 阈值配置
   */
  constructor(config = {}) {
    super();
    
    if (config.name) this.name = config.name;
    if (config.targetCount) this.targetCount = config.targetCount;
    if (config.thresholds) this.thresholds = { ...this.thresholds, ...config.thresholds };
    
    this.currentState = this.getInitialState();
  }

  /**
   * 获取初始状态
   * @returns {ActionState}
   */
  getInitialState() {
    return {
      phase: 'idle',
      count: 0,
      progress: 0,
      quality: 1,
      feedback: '准备开始...'
    };
  }

  /**
   * 分析检测结果
   * @param {Object} poseResult - 检测结果
   * @returns {ActionState} 动作状态
   */
  analyze(poseResult) {
    // 子类实现
    throw new Error('analyze() must be implemented by subclass');
  }

  /**
   * 重置状态
   */
  reset() {
    this.phase = 'idle';
    this.count = 0;
    this.currentState = this.getInitialState();
    this.qualityHistory = [];
  }

  /**
   * 获取当前状态
   * @returns {ActionState}
   */
  get state() {
    return this.currentState;
  }

  /**
   * 是否完成
   * @returns {boolean}
   */
  get isCompleted() {
    return this.count >= this.targetCount;
  }

  /**
   * 获取当前进度
   * @returns {number}
   */
  get progress() {
    return Math.min(1, this.count / this.targetCount);
  }

  /**
   * 获取平均质量
   * @returns {number}
   */
  get averageQuality() {
    if (this.qualityHistory.length === 0) return 1;
    return this.qualityHistory.reduce((a, b) => a + b, 0) / this.qualityHistory.length;
  }

  /**
   * 触发计数事件
   * @param {number} count - 当前计数
   */
  emitCount(count) {
    this.dispatchEvent(new CustomEvent('count', { detail: count }));
  }

  /**
   * 触发完成事件
   */
  emitComplete() {
    const result = {
      count: this.count,
      targetCount: this.targetCount,
      quality: this.averageQuality
    };
    this.dispatchEvent(new CustomEvent('complete', { detail: result }));
  }

  /**
   * 触发反馈事件
   * @param {string} message - 反馈信息
   * @param {FeedbackLevel} level - 反馈级别
   */
  emitFeedback(message, level = 'info') {
    this.dispatchEvent(new CustomEvent('feedback', { 
      detail: { message, level } 
    }));
  }

  /**
   * 触发状态变化事件
   * @param {ActionPhase} from - 原状态
   * @param {ActionPhase} to - 新状态
   */
  emitStateChange(from, to) {
    this.dispatchEvent(new CustomEvent('stateChange', { 
      detail: { from, to } 
    }));
  }

  /**
   * 更新状态
   * @param {Partial<ActionState>} updates - 更新内容
   */
  updateState(updates) {
    const oldPhase = this.currentState.phase;
    this.currentState = { ...this.currentState, ...updates };
    
    if (updates.phase && updates.phase !== oldPhase) {
      this.phase = updates.phase;
      this.emitStateChange(oldPhase, updates.phase);
    }
  }

  /**
   * 增加计数
   * @param {number} quality - 本次质量
   */
  incrementCount(quality = 1) {
    this.count++;
    this.qualityHistory.push(quality);
    this.emitCount(this.count);
    
    if (this.isCompleted) {
      this.updateState({ phase: 'completed' });
      this.emitComplete();
    }
  }
}

export default ActionAnalyzer;