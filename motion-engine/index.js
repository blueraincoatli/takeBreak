/**
 * 运动检测引擎 - 主入口
 * @module motion-engine
 * 
 * 基于 MediaPipe Pose 的本地动作检测引擎
 * 支持深蹲、喝水、转体等动作识别
 * 
 * @example
 * // 基本使用
 * import { MotionDetector, SquatAnalyzer, SkeletonRenderer } from './motion-engine';
 * 
 * const detector = new MotionDetector({ videoElement: document.getElementById('camera') });
 * const analyzer = new SquatAnalyzer({ targetCount: 10 });
 * const renderer = new SkeletonRenderer(document.getElementById('canvas'));
 * 
 * await detector.initialize();
 * await detector.start();
 * 
 * detector.addEventListener('pose', (e) => {
 *   const state = analyzer.analyze(e.detail);
 *   renderer.render(e.detail);
 *   updateUI(state);
 * });
 * 
 * analyzer.addEventListener('count', (e) => {
 *   console.log('完成', e.detail, '个');
 * });
 * 
 * analyzer.addEventListener('complete', () => {
 *   console.log('全部完成！');
 * });
 */

// 核心
export { MotionDetector, POSE_LANDMARKS, POSE_CONNECTIONS } from './core/index.js';

// 动作分析器
export { ActionAnalyzer, SquatAnalyzer, DrinkAnalyzer } from './actions/index.js';

// 渲染器
export { SkeletonRenderer } from './renderer/index.js';

// 工具函数
export * from './utils/index.js';

// 版本
export const VERSION = '1.0.0';
