/**
 * GPS ↔ 手绘地图像素坐标 转换模块
 *
 * 使用简化的线性变换（已知参考点 + 南北对齐），数值稳定。
 *
 * 参考数据：
 *   灵山大佛 OSM: 31.43205°N, 120.09151°E → 像素 (600, 420)
 *   检票口估算:   31.42380°N, 120.09220°E → 像素 (700, 1790)
 *
 * 手绘地图尺寸：1677 × 1920 像素
 *
 * 变换原理：
 *   px = (lng - lng0) * scaleX
 *   py = (lat - lat0) * scaleY
 *   其中 scaleY 为负值（纬度增加 → Y坐标减小，地图上方）
 */

import { getMapSize } from './roadNetwork'

// ==================== 锚点 ====================

const REF = {
  // 灵山大佛（顶部）
  buddhaPx:  { x: 600,  y: 420  },
  buddhaGps: { lat: 31.43205, lng: 120.09151 },
  // 检票口（底部）
  gatePx:    { x: 700,  y: 1790 },
  gateGps:   { lat: 31.42380, lng: 120.09220 },
}

// 计算缩放系数
const scaleY = (REF.gatePx.y - REF.buddhaPx.y) / (REF.gateGps.lat - REF.buddhaGps.lat)
const scaleX = (REF.gatePx.x - REF.buddhaPx.x) / (REF.gateGps.lng - REF.buddhaGps.lng)

// scaleY ≈ (1790-420)/(31.42380-31.43205) = 1370/-0.00825 = -166061 px/deg
// scaleX ≈ (700-600)/(120.09220-120.09151) = 100/0.00069 = 144928 px/deg

// 原点偏移（使 Buddha 处恰好匹配）
const offsetX = REF.buddhaPx.x - REF.buddhaGps.lng * scaleX
const offsetY = REF.buddhaPx.y - REF.buddhaGps.lat * scaleY

// ==================== 公开API ====================

export interface GpsCoord {
  lat: number
  lng: number
}

export interface PixelCoord {
  x: number
  y: number
}

/**
 * GPS坐标 → 像素坐标
 *
 * 注意：坐标超出地图范围时仍返回结果（可能为负值或超过地图尺寸），
 * 由调用方决定是否显示。
 */
export function gpsToPixel(gps: GpsCoord): PixelCoord {
  return {
    x: Math.round(gps.lng * scaleX + offsetX),
    y: Math.round(gps.lat * scaleY + offsetY),
  }
}

/**
 * 像素坐标 → GPS坐标
 */
export function pixelToGps(px: PixelCoord): GpsCoord {
  return {
    lng: (px.x - offsetX) / scaleX,
    lat: (px.y - offsetY) / scaleY,
  }
}

// ==================== 自检 ====================

/** 验证参考点误差（米） */
export function validateTransform(): string {
  const check = (label: string, gps: GpsCoord, expectPx: PixelCoord) => {
    const px = gpsToPixel(gps)
    const errPx = Math.sqrt((px.x - expectPx.x) ** 2 + (px.y - expectPx.y) ** 2)
    // 像素 → 米（约 0.6 m/px）
    const errM = (errPx * 0.6).toFixed(1)
    return `${label}: 期望(${expectPx.x},${expectPx.y}) 实际(${px.x},${px.y}) 误差≈${errM}m`
  }

  // 额外验证点
  const extraChecks = [
    { gps: { lat: 31.42750, lng: 120.09520 }, px: { x: 1050, y: 1225 }, name: '五印坛城' },
    { gps: { lat: 31.42450, lng: 120.09580 }, px: { x: 1220, y: 1495 }, name: '景区出口' },
    { gps: { lat: 31.42950, lng: 120.09450 }, px: { x: 1170, y: 928  }, name: '灵山梵宫' },
  ]

  const lines = [
    check('灵山大佛', REF.buddhaGps, REF.buddhaPx),
    check('检票口',   REF.gateGps,   REF.gatePx),
    ...extraChecks.map(c => check(c.name, c.gps, c.px)),
  ]
  return lines.join('\n')
}

// 启动时打印验证
console.log('[gpsTransform] scaleX=%d px/deg, scaleY=%d px/deg', scaleX.toFixed(0), scaleY.toFixed(0))
console.log('[gpsTransform]\n' + validateTransform())
