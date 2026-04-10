/**
 * 几何计算工具函数
 * @module motion-engine/utils/geometry
 */

/**
 * 计算两点之间的距离（2D）
 * @param {{x: number, y: number}} a - 点A
 * @param {{x: number, y: number}} b - 点B
 * @returns {number} 距离
 */
export function distance(a, b) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * 计算两点之间的距离（3D）
 * @param {{x: number, y: number, z: number}} a - 点A
 * @param {{x: number, y: number, z: number}} b - 点B
 * @returns {number} 距离
 */
export function distance3D(a, b) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const dz = (b.z || 0) - (a.z || 0);
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

/**
 * 计算两个向量的夹角（度数）
 * @param {{x: number, y: number}} v1 - 向量1
 * @param {{x: number, y: number}} v2 - 向量2
 * @returns {number} 角度（0-180）
 */
export function angle(v1, v2) {
  const dot = v1.x * v2.x + v1.y * v2.y;
  const mag1 = Math.sqrt(v1.x * v1.x + v1.y * v1.y);
  const mag2 = Math.sqrt(v2.x * v2.x + v2.y * v2.y);
  
  if (mag1 === 0 || mag2 === 0) return 0;
  
  const cos = Math.max(-1, Math.min(1, dot / (mag1 * mag2)));
  return Math.acos(cos) * 180 / Math.PI;
}

/**
 * 计算三点形成的角度（中间点为顶点）
 * @param {{x: number, y: number}} a - 点A
 * @param {{x: number, y: number}} b - 顶点B
 * @param {{x: number, y: number}} c - 点C
 * @returns {number} 角度（0-180）
 */
export function threePointAngle(a, b, c) {
  const v1 = { x: a.x - b.x, y: a.y - b.y };
  const v2 = { x: c.x - b.x, y: c.y - b.y };
  return angle(v1, v2);
}

/**
 * 计算点到直线的距离
 * @param {{x: number, y: number}} point - 点
 * @param {{x: number, y: number}} lineStart - 直线起点
 * @param {{x: number, y: number}} lineEnd - 直线终点
 * @returns {number} 距离
 */
export function pointToLineDistance(point, lineStart, lineEnd) {
  const A = point.x - lineStart.x;
  const B = point.y - lineStart.y;
  const C = lineEnd.x - lineStart.x;
  const D = lineEnd.y - lineStart.y;

  const dot = A * C + B * D;
  const lenSq = C * C + D * D;
  
  if (lenSq === 0) return distance(point, lineStart);
  
  let param = dot / lenSq;
  param = Math.max(0, Math.min(1, param));

  const xx = lineStart.x + param * C;
  const yy = lineStart.y + param * D;

  return distance(point, { x: xx, y: yy });
}

/**
 * 判断点是否在椭圆区域内
 * @param {{x: number, y: number}} point - 点
 * @param {{x: number, y: number}} center - 椭圆中心
 * @param {number} radiusX - X方向半径
 * @param {number} radiusY - Y方向半径
 * @returns {boolean} 是否在区域内
 */
export function pointInEllipse(point, center, radiusX, radiusY) {
  const dx = point.x - center.x;
  const dy = point.y - center.y;
  const normalizedDist = Math.sqrt(
    (dx / radiusX) ** 2 + 
    (dy / radiusY) ** 2
  );
  return normalizedDist <= 1;
}

/**
 * 判断点是否在圆形区域内
 * @param {{x: number, y: number}} point - 点
 * @param {{x: number, y: number}} center - 圆心
 * @param {number} radius - 半径
 * @returns {boolean} 是否在区域内
 */
export function pointInCircle(point, center, radius) {
  return distance(point, center) <= radius;
}

/**
 * 计算向量的模
 * @param {{x: number, y: number}} v - 向量
 * @returns {number} 模
 */
export function magnitude(v) {
  return Math.sqrt(v.x * v.x + v.y * v.y);
}

/**
 * 归一化向量
 * @param {{x: number, y: number}} v - 向量
 * @returns {{x: number, y: number}} 单位向量
 */
export function normalize(v) {
  const mag = magnitude(v);
  if (mag === 0) return { x: 0, y: 0 };
  return { x: v.x / mag, y: v.y / mag };
}

/**
 * 计算平均值
 * @param {number[]} values - 数值数组
 * @returns {number} 平均值
 */
export function average(values) {
  if (values.length === 0) return 0;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

/**
 * 限制数值在范围内
 * @param {number} value - 数值
 * @param {number} min - 最小值
 * @param {number} max - 最大值
 * @returns {number} 限制后的值
 */
export function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}
