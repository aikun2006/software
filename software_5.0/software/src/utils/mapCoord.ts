/**
 * 地图点击坐标换算工具
 *
 * 将 DOM 事件（鼠标/触摸）的 client 坐标换算为地图内部坐标系
 * （灵山地图为 1677 × 1920 像素）。渲染盒取自图片元素的 getBoundingClientRect，
 * 因 location.vue 用 aspect-ratio:1677/1920、navigation.vue 用 widthFix，
 * 渲染比例与内部坐标系一致，按比例缩放即可。
 */

import { getMapSize } from '@/engine/roadNetwork'

export interface MapCoord { x: number; y: number }

/**
 * 把客户端坐标换算为地图坐标
 * @param clientX 鼠标/触摸 clientX
 * @param clientY 鼠标/触摸 clientY
 * @param el      地图渲染元素（image 或其包裹容器）
 */
export function clientToMap(clientX: number, clientY: number, el: Element | null): MapCoord | null {
  if (!el) return null
  const rect = el.getBoundingClientRect()
  if (!rect.width || !rect.height) return null
  const { width, height } = getMapSize()
  return {
    x: (clientX - rect.left) / rect.width * width,
    y: (clientY - rect.top) / rect.height * height,
  }
}
