/**
 * ARWebGLRenderer —— WebGL 3D 叠加层渲染器
 *
 * P2.1+P2.2优化：在摄像头画面上叠加3D虚拟物体
 *   1. 创建透明WebGL Canvas层（Three.js渲染）
 *   2. 3D锚点标记（发光柱体+Billboard标签）标识识别到的景点位置
 *   3. DeviceOrientation API跟踪设备旋转，驱动3D相机
 *   4. 光照估计同步：色温+方向光调整虚拟物体光照
 *   5. 支持放置3D虚拟物体（发光球体、粒子效果）
 *
 * 渲染层级（从底到顶）：
 *   video层(z:1) → WebGL Canvas层(z:5) → DOM标签/卡片层(z:10+)
 */
import * as THREE from 'three'
import type { ARLightEstimate, ARRecognitionResult } from './types'

/** 3D锚点标记数据 */
export interface ARAnchor3D {
  spotId: string
  spotName: string
  /** 在3D空间中的位置（世界坐标） */
  position: THREE.Vector3
  /** 锚点创建时间 */
  createdAt: number
}

export class ARWebGLRenderer {
  /** Three.js渲染器 */
  private renderer: THREE.WebGLRenderer | null = null
  /** 3D场景 */
  private scene: THREE.Scene | null = null
  /** 3D相机（跟随设备方向旋转） */
  private camera: THREE.PerspectiveCamera | null = null
  /** 渲染循环ID */
  private animFrameId: number | null = null
  /** 挂载容器ID */
  private containerId: string = ''
  /** WebGL Canvas元素 */
  private canvasEl: HTMLCanvasElement | null = null

  /** 当前3D锚点列表 */
  private anchors: Map<string, THREE.Group> = new Map()
  /** 锚点数据 */
  private anchorData: Map<string, ARAnchor3D> = new Map()

  /** 设备方向传感器数据 */
  private deviceOrientation: { alpha: number; beta: number; gamma: number } = { alpha: 0, beta: 0, gamma: 0 }
  /** 设备方向监听句柄 */
  private orientationHandler: ((e: DeviceOrientationEvent) => void) | null = null

  /** 场景光源 */
  private ambientLight: THREE.AmbientLight | null = null
  private directionalLight: THREE.DirectionalLight | null = null
  /** 当前光照估计 */
  private currentLightEstimate: ARLightEstimate | null = null

  /** 渲染尺寸 */
  private width: number = 0
  private height: number = 0

  /** 粒子系统（环境氛围） */
  private particleSystem: THREE.Points | null = null
  /** 粒子动画时间 */
  private particleTime: number = 0

  /**
   * 挂载到指定DOM容器，创建WebGL渲染层。
   * @param containerId 容器元素ID（与摄像头容器相同）
   */
  mount(containerId: string): void {
    this.containerId = containerId
    const container = document.getElementById(containerId)
    if (!container) {
      throw new Error(`[ARWebGLRenderer] 容器元素不存在: ${containerId}`)
    }

    this.unmount()

    this.width = container.clientWidth || window.innerWidth
    this.height = container.clientHeight || window.innerHeight

    // 创建透明WebGL Canvas
    this.canvasEl = document.createElement('canvas')
    this.canvasEl.style.cssText =
      'position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:5;'
    container.appendChild(this.canvasEl)

    // 初始化Three.js渲染器
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvasEl,
      alpha: true,           // 透明背景
      antialias: true,       // 抗锯齿
      powerPreference: 'high-performance'
    })
    this.renderer.setSize(this.width, this.height)
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))

    // 创建场景
    this.scene = new THREE.Scene()

    // 创建相机（FOV~75°，近似手机摄像头）
    this.camera = new THREE.PerspectiveCamera(75, this.width / this.height, 0.1, 1000)
    this.camera.position.set(0, 0, 0)

    // 创建光照
    this.ambientLight = new THREE.AmbientLight(0xffffff, 0.6)
    this.scene.add(this.ambientLight)

    this.directionalLight = new THREE.DirectionalLight(0xffffff, 0.8)
    this.directionalLight.position.set(1, -1, 1)
    this.scene.add(this.directionalLight)

    // 创建环境粒子（增加AR沉浸感）
    this.createParticleSystem()

    // 监听设备方向
    this.startOrientationTracking()

    // 监听窗口尺寸变化
    window.addEventListener('resize', this.handleResize)

    // 启动渲染循环
    this.startRenderLoop()
  }

  /**
   * 创建3D锚点标记
   * 在识别到的景点位置放置发光柱体+旋转光环
   */
  addAnchor(result: ARRecognitionResult, screenX: number, screenY: number): void {
    if (!this.scene) return

    // 移除旧锚点
    this.removeAnchor(result.spotId)

    // 将屏幕坐标转换为3D空间位置
    // 锚点放置在相机前方3米处，根据屏幕位置偏移
    const ndcX = (screenX / this.width) * 2 - 1
    const ndcY = -((screenY / this.height) * 2 - 1)
    const distance = 3.0
    const fovRad = (this.camera!.fov * Math.PI) / 180
    const worldHeight = 2 * Math.tan(fovRad / 2) * distance
    const worldWidth = worldHeight * this.camera!.aspect
    const pos = new THREE.Vector3(
      ndcX * worldWidth / 2,
      ndcY * worldHeight / 2,
      -distance
    )

    // 创建锚点Group
    const anchorGroup = new THREE.Group()
    anchorGroup.position.copy(pos)

    // 1. 发光柱体（竖直光柱标记景点位置）
    const pillarGeo = new THREE.CylinderGeometry(0.04, 0.04, 1.5, 8)
    const pillarMat = new THREE.MeshBasicMaterial({
      color: 0xff8c42,
      transparent: true,
      opacity: 0.7
    })
    const pillar = new THREE.Mesh(pillarGeo, pillarMat)
    pillar.position.y = 0.75
    anchorGroup.add(pillar)

    // 2. 旋转光环（地面光圈）
    const ringGeo = new THREE.RingGeometry(0.3, 0.4, 32)
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0xff6b35,
      transparent: true,
      opacity: 0.6,
      side: THREE.DoubleSide
    })
    const ring = new THREE.Mesh(ringGeo, ringMat)
    ring.rotation.x = -Math.PI / 2
    ring.position.y = 0.01
    anchorGroup.add(ring)

    // 3. 顶部光球
    const sphereGeo = new THREE.SphereGeometry(0.12, 16, 16)
    const sphereMat = new THREE.MeshBasicMaterial({
      color: 0xffd700,
      transparent: true,
      opacity: 0.9
    })
    const sphere = new THREE.Mesh(sphereGeo, sphereMat)
    sphere.position.y = 1.6
    anchorGroup.add(sphere)

    // 保存引用并添加到场景
    this.anchors.set(result.spotId, anchorGroup)
    this.anchorData.set(result.spotId, {
      spotId: result.spotId,
      spotName: result.spotName,
      position: pos.clone(),
      createdAt: Date.now()
    })
    this.scene.add(anchorGroup)
  }

  /** 移除指定景点的3D锚点 */
  removeAnchor(spotId: string): void {
    const anchor = this.anchors.get(spotId)
    if (anchor && this.scene) {
      this.scene.remove(anchor)
      // 释放几何体和材质
      anchor.traverse(obj => {
        if (obj instanceof THREE.Mesh) {
          obj.geometry?.dispose()
          if (Array.isArray(obj.material)) {
            obj.material.forEach(m => m.dispose())
          } else {
            obj.material?.dispose()
          }
        }
      })
      this.anchors.delete(spotId)
      this.anchorData.delete(spotId)
    }
  }

  /** 清除所有3D锚点 */
  clearAnchors(): void {
    for (const spotId of Array.from(this.anchors.keys())) {
      this.removeAnchor(spotId)
    }
  }

  /**
   * P2.3：更新场景光照
   * 根据ARCameraComposer的光照估计调整虚拟物体光照
   */
  updateLighting(estimate: ARLightEstimate): void {
    this.currentLightEstimate = estimate
    if (!this.ambientLight || !this.directionalLight) return

    // 亮度→环境光强度
    const brightnessFactor = Math.max(0.2, Math.min(1.5, estimate.brightness / 128))
    this.ambientLight.intensity = 0.6 * brightnessFactor

    // 色温→光源颜色
    const color = this.colorTemperatureToRGB(estimate.colorTemperature)
    this.directionalLight.color.setRGB(color.r, color.g, color.b)
    this.directionalLight.intensity = 0.8 * brightnessFactor

    // 方向光位置
    this.directionalLight.position.set(
      estimate.lightDirectionX * 5,
      estimate.lightDirectionY * 5,
      3
    )
  }

  /**
   * 色温（开尔文）→ RGB颜色
   * 简化模型：暖光偏橙，冷光偏蓝
   */
  private colorTemperatureToRGB(kelvin: number): { r: number; g: number; b: number } {
    const temp = kelvin / 100
    let r: number, g: number, b: number

    if (temp <= 66) {
      r = 255
      g = 99.4708025861 * Math.log(temp) - 161.1195681661
      b = temp <= 19 ? 0 : 138.5177312231 * Math.log(temp - 10) - 305.0447927307
    } else {
      r = 329.698727446 * Math.pow(temp - 60, -0.1332047592)
      g = 288.1221695283 * Math.pow(temp - 60, -0.0755148492)
      b = 255
    }

    return {
      r: Math.max(0, Math.min(1, r / 255)),
      g: Math.max(0, Math.min(1, g / 255)),
      b: Math.max(0, Math.min(1, b / 255))
    }
  }

  /**
   * 创建环境粒子系统
   * 漂浮的光点粒子，增加AR沉浸感
   */
  private createParticleSystem(): void {
    if (!this.scene) return

    const particleCount = 80
    const positions = new Float32Array(particleCount * 3)
    const sizes = new Float32Array(particleCount)

    for (let i = 0; i < particleCount; i++) {
      // 粒子分布在相机前方2-8米的半球空间
      const radius = 2 + Math.random() * 6
      const theta = Math.random() * Math.PI * 2
      const phi = Math.random() * Math.PI * 0.6  // 上半球
      positions[i * 3] = radius * Math.sin(phi) * Math.cos(theta)
      positions[i * 3 + 1] = radius * Math.cos(phi) - 1
      positions[i * 3 + 2] = -radius * Math.sin(phi) * Math.sin(theta)
      sizes[i] = 0.02 + Math.random() * 0.03
    }

    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1))

    const material = new THREE.PointsMaterial({
      color: 0xffd700,
      size: 0.05,
      transparent: true,
      opacity: 0.4,
      sizeAttenuation: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    })

    this.particleSystem = new THREE.Points(geometry, material)
    this.scene.add(this.particleSystem)
  }

  /**
   * P2.2：启动设备方向跟踪
   * DeviceOrientation API → 3D相机旋转
   */
  private startOrientationTracking(): void {
    if (typeof window === 'undefined' || !('DeviceOrientationEvent' in window)) return

    this.orientationHandler = (e: DeviceOrientationEvent) => {
      // alpha: Z轴旋转（0-360），beta: X轴旋转（-180~180），gamma: Y轴旋转（-90~90）
      this.deviceOrientation.alpha = e.alpha || 0
      this.deviceOrientation.beta = e.beta || 0
      this.deviceOrientation.gamma = e.gamma || 0
    }

    // iOS 13+需要请求权限
    const DOE = DeviceOrientationEvent as any
    if (DOE && typeof DOE.requestPermission === 'function') {
      DOE.requestPermission().then((state: string) => {
        if (state === 'granted') {
          window.addEventListener('deviceorientation', this.orientationHandler!)
        }
      }).catch(() => {
        // 权限被拒，使用默认视角
      })
    } else {
      window.addEventListener('deviceorientation', this.orientationHandler!)
    }
  }

  /**
   * 将设备方向数据应用到3D相机
   * 使用欧拉角转换，匹配设备物理旋转
   */
  private updateCameraFromOrientation(): void {
    if (!this.camera) return

    const { alpha, beta, gamma } = this.deviceOrientation
    // 欧拉角顺序：YXZ（偏航→俯仰→横滚）
    const euler = new THREE.Euler(
      THREE.MathUtils.degToRad(beta),
      THREE.MathUtils.degToRad(alpha),
      THREE.MathUtils.degToRad(gamma),
      'YXZ'
    )
    this.camera.quaternion.setFromEuler(euler)
  }

  /** 启动渲染循环 */
  private startRenderLoop(): void {
    const animate = () => {
      this.animFrameId = requestAnimationFrame(animate)
      if (!this.renderer || !this.scene || !this.camera) return

      // 更新相机方向
      this.updateCameraFromOrientation()

      // 锚点动画（光环旋转+光球浮动）
      const time = Date.now() * 0.001
      for (const [, anchor] of this.anchors) {
        // 光环旋转
        const ring = anchor.children[1]
        if (ring) ring.rotation.z = time * 0.5
        // 光球上下浮动
        const sphere = anchor.children[2]
        if (sphere) sphere.position.y = 1.6 + Math.sin(time * 2) * 0.08
        // 柱体透明度脉动
        const pillar = anchor.children[0]
        if (pillar && pillar instanceof THREE.Mesh) {
          (pillar.material as THREE.Material & { opacity: number }).opacity = 0.5 + Math.sin(time * 3) * 0.2
        }
      }

      // 粒子动画
      if (this.particleSystem) {
        this.particleTime += 0.005
        this.particleSystem.rotation.y = this.particleTime
        const positions = this.particleSystem.geometry.attributes.position
        for (let i = 0; i < positions.count; i++) {
          const y = positions.getY(i)
          positions.setY(i, y + Math.sin(this.particleTime * 2 + i) * 0.002)
        }
        positions.needsUpdate = true
      }

      this.renderer.render(this.scene, this.camera)
    }
    animate()
  }

  /** 处理窗口尺寸变化 */
  private handleResize = (): void => {
    const container = document.getElementById(this.containerId)
    if (!container || !this.renderer || !this.camera) return

    this.width = container.clientWidth || window.innerWidth
    this.height = container.clientHeight || window.innerHeight
    this.renderer.setSize(this.width, this.height)
    this.camera.aspect = this.width / this.height
    this.camera.updateProjectionMatrix()
  }

  /** 卸载WebGL渲染器，释放所有资源 */
  unmount(): void {
    // 停止渲染循环
    if (this.animFrameId !== null) {
      cancelAnimationFrame(this.animFrameId)
      this.animFrameId = null
    }

    // 移除设备方向监听
    if (this.orientationHandler) {
      window.removeEventListener('deviceorientation', this.orientationHandler)
      this.orientationHandler = null
    }
    window.removeEventListener('resize', this.handleResize)

    // 清除所有锚点（释放几何体和材质）
    this.clearAnchors()

    // 释放粒子系统
    if (this.particleSystem) {
      this.particleSystem.geometry.dispose()
      ;(this.particleSystem.material as THREE.Material).dispose()
      this.particleSystem = null
    }

    // 释放渲染器
    if (this.renderer) {
      this.renderer.dispose()
      this.renderer = null
    }

    // 移除Canvas元素
    if (this.canvasEl && this.canvasEl.parentNode) {
      this.canvasEl.parentNode.removeChild(this.canvasEl)
    }
    this.canvasEl = null
    this.scene = null
    this.camera = null
    this.ambientLight = null
    this.directionalLight = null
  }

  /** 获取当前锚点数据列表 */
  getAnchors(): ARAnchor3D[] {
    return Array.from(this.anchorData.values())
  }
}
