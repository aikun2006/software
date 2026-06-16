export interface ShaderVariant {
  name: string
  vertexShader: string
  fragmentShader: string
  defines?: Record<string, boolean | number | string>
  uniforms?: Record<string, any>
  priority: 'critical' | 'high' | 'low'
}

export interface ShaderCompileResult {
  name: string
  success: boolean
  compileTime: number
  error?: string
  program?: any
}

export interface PrecompileConfig {
  enabled: boolean
  precompileOnIdle: boolean
  precompileDelay: number
  maxConcurrentCompiles: number
  variantFilter: (variant: ShaderVariant) => boolean
}

const DEFAULT_CONFIG: PrecompileConfig = {
  enabled: true,
  precompileOnIdle: true,
  precompileDelay: 1000,
  maxConcurrentCompiles: 2,
  variantFilter: () => true
}

export class ShaderPrecompiler {
  private config: PrecompileConfig
  private variants: Map<string, ShaderVariant> = new Map()
  private compiledPrograms: Map<string, ShaderCompileResult> = new Map()
  private compileQueue: string[] = []
  private isCompiling = false
  private idleCallbackId: number | null = null
  private onCompileCallbacks: Array<(result: ShaderCompileResult) => void> = []

  constructor(config: Partial<PrecompileConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config }
    this.initDefaultVariants()
  }

  private initDefaultVariants(): void {
    const standardShader: ShaderVariant = {
      name: 'standard',
      vertexShader: this.getStandardVertexShader(),
      fragmentShader: this.getStandardFragmentShader(),
      priority: 'critical'
    }

    const skinningShader: ShaderVariant = {
      name: 'skinning',
      vertexShader: this.getSkinningVertexShader(),
      fragmentShader: this.getStandardFragmentShader(),
      defines: { SKINNING: true },
      priority: 'critical'
    }

    const morphTargetShader: ShaderVariant = {
      name: 'morphtarget',
      vertexShader: this.getMorphTargetVertexShader(),
      fragmentShader: this.getStandardFragmentShader(),
      defines: { MORPHTARGETS: true },
      priority: 'high'
    }

    this.registerVariant(standardShader)
    this.registerVariant(skinningShader)
    this.registerVariant(morphTargetShader)
  }

  private getStandardVertexShader(): string {
    return `
      varying vec2 vUv;
      varying vec3 vNormal;
      varying vec3 vPosition;
      
      void main() {
        vUv = uv;
        vNormal = normalize(normalMatrix * normal);
        vPosition = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `
  }

  private getSkinningVertexShader(): string {
    return `
      varying vec2 vUv;
      varying vec3 vNormal;
      varying vec3 vPosition;
      
      #ifdef SKINNING
        attribute vec4 skinIndex;
        attribute vec4 skinWeight;
        uniform mat4 bindMatrix;
        uniform mat4 bindMatrixInverse;
        uniform mat4 boneMatrices[MAX_BONES];
        
        mat4 getBoneMatrix(float index) {
          int i = int(index);
          return boneMatrices[i];
        }
        
        mat4 skinMatrix() {
          mat4 boneMatX = getBoneMatrix(skinIndex.x);
          mat4 boneMatY = getBoneMatrix(skinIndex.y);
          mat4 boneMatZ = getBoneMatrix(skinIndex.z);
          mat4 boneMatW = getBoneMatrix(skinIndex.w);
          
          mat4 skinMatrix = boneMatX * skinWeight.x;
          skinMatrix += boneMatY * skinWeight.y;
          skinMatrix += boneMatZ * skinWeight.z;
          skinMatrix += boneMatW * skinWeight.w;
          
          return skinMatrix;
        }
      #endif
      
      void main() {
        vUv = uv;
        
        #ifdef SKINNING
          mat4 skinMat = skinMatrix();
          vec4 skinPosition = bindMatrix * vec4(position, 1.0);
          skinPosition = skinMat * skinPosition;
          skinPosition = bindMatrixInverse * skinPosition;
          vPosition = skinPosition.xyz;
          vNormal = normalize(normalMatrix * normal);
          gl_Position = projectionMatrix * modelViewMatrix * skinPosition;
        #else
          vPosition = position;
          vNormal = normalize(normalMatrix * normal);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        #endif
      }
    `
  }

  private getMorphTargetVertexShader(): string {
    return `
      varying vec2 vUv;
      varying vec3 vNormal;
      varying vec3 vPosition;
      
      #ifdef MORPHTARGETS
        uniform vec3 morphTargetPositions[MAX_MORPH_TARGETS];
        uniform vec3 morphTargetNormals[MAX_MORPH_TARGETS];
        uniform float morphTargetInfluences[MAX_MORPH_TARGETS];
      #endif
      
      void main() {
        vUv = uv;
        vec3 finalPosition = position;
        vec3 finalNormal = normal;
        
        #ifdef MORPHTARGETS
          for(int i = 0; i < MAX_MORPH_TARGETS; i++) {
            finalPosition += morphTargetPositions[i] * morphTargetInfluences[i];
            finalNormal += morphTargetNormals[i] * morphTargetInfluences[i];
          }
        #endif
        
        vPosition = finalPosition;
        vNormal = normalize(normalMatrix * finalNormal);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(finalPosition, 1.0);
      }
    `
  }

  private getStandardFragmentShader(): string {
    return `
      varying vec2 vUv;
      varying vec3 vNormal;
      varying vec3 vPosition;
      
      uniform vec3 color;
      uniform sampler2D map;
      uniform float opacity;
      
      void main() {
        vec4 texColor = texture2D(map, vUv);
        vec3 normal = normalize(vNormal);
        vec3 lightDir = normalize(vec3(1.0, 1.0, 1.0));
        float diffuse = max(0.0, dot(normal, lightDir));
        
        vec3 finalColor = color * texColor.rgb * (0.3 + diffuse * 0.7);
        gl_FragColor = vec4(finalColor, texColor.a * opacity);
      }
    `
  }

  registerVariant(variant: ShaderVariant): void {
    this.variants.set(variant.name, variant)
  }

  getVariant(name: string): ShaderVariant | undefined {
    return this.variants.get(name)
  }

  schedulePrecompile(): void {
    if (!this.config.enabled) return

    const sortedVariants = Array.from(this.variants.entries())
      .filter(([_, v]) => this.config.variantFilter(v))
      .sort((a, b) => {
        const priorityOrder = { critical: 0, high: 1, low: 2 }
        return priorityOrder[a[1].priority] - priorityOrder[b[1].priority]
      })
      .map(([name]) => name)

    this.compileQueue = sortedVariants.filter(name => !this.compiledPrograms.has(name))

    if (this.compileQueue.length > 0 && this.config.precompileOnIdle) {
      this.scheduleIdlePrecompile()
    }
  }

  private scheduleIdlePrecompile(): void {
    if (this.idleCallbackId !== null) return

    if ('requestIdleCallback' in window) {
      this.idleCallbackId = requestIdleCallback(() => this.processCompileQueue())
    } else {
      this.idleCallbackId = window.setTimeout(() => this.processCompileQueue(), this.config.precompileDelay)
    }
  }

  private async processCompileQueue(): Promise<void> {
    if (this.isCompiling || this.compileQueue.length === 0) return

    this.isCompiling = true
    this.idleCallbackId = null

    const compileBatch: string[] = []
    const batchSize = Math.min(this.config.maxConcurrentCompiles, this.compileQueue.length)
    
    for (let i = 0; i < batchSize; i++) {
      compileBatch.push(this.compileQueue.shift()!)
    }

    const compilePromises = compileBatch.map(name => this.compileVariant(name))
    await Promise.all(compilePromises)

    this.isCompiling = false

    if (this.compileQueue.length > 0) {
      this.scheduleIdlePrecompile()
    }
  }

  private async compileVariant(name: string): Promise<ShaderCompileResult> {
    const variant = this.variants.get(name)
    if (!variant) {
      const result: ShaderCompileResult = {
        name,
        success: false,
        compileTime: 0,
        error: 'Variant not found'
      }
      this.compiledPrograms.set(name, result)
      return result
    }

    const startTime = performance.now()

    try {
      await this.simulateCompile(variant)

      const compileTime = performance.now() - startTime
      const result: ShaderCompileResult = {
        name,
        success: true,
        compileTime
      }

      this.compiledPrograms.set(name, result)
      this.notifyCallbacks(result)

      console.log(`Shader '${name}' 预编译完成 (${Math.round(compileTime)}ms)`)
      return result
    } catch (error) {
      const compileTime = performance.now() - startTime
      const result: ShaderCompileResult = {
        name,
        success: false,
        compileTime,
        error: error instanceof Error ? error.message : 'Unknown error'
      }

      this.compiledPrograms.set(name, result)
      this.notifyCallbacks(result)

      console.warn(`Shader '${name}' 预编译失败:`, error)
      return result
    }
  }

  private async simulateCompile(variant: ShaderVariant): Promise<void> {
    const baseDelay = variant.priority === 'critical' ? 10 : variant.priority === 'high' ? 15 : 25
    const complexity = variant.defines ? Object.keys(variant.defines).length * 2 : 0
    
    await new Promise(resolve => setTimeout(resolve, baseDelay + complexity))
  }

  async compileVariantNow(name: string): Promise<ShaderCompileResult> {
    const existing = this.compiledPrograms.get(name)
    if (existing) return existing

    const index = this.compileQueue.indexOf(name)
    if (index > -1) {
      this.compileQueue.splice(index, 1)
    }

    return this.compileVariant(name)
  }

  getCompiledResult(name: string): ShaderCompileResult | undefined {
    return this.compiledPrograms.get(name)
  }

  isCompiled(name: string): boolean {
    return this.compiledPrograms.has(name) && this.compiledPrograms.get(name)?.success === true
  }

  getCompilationStats(): {
    total: number
    compiled: number
    failed: number
    pending: number
    totalCompileTime: number
  } {
    const total = this.variants.size
    const compiled = Array.from(this.compiledPrograms.values()).filter(r => r.success).length
    const failed = Array.from(this.compiledPrograms.values()).filter(r => !r.success).length
    const pending = this.compileQueue.length
    const totalCompileTime = Array.from(this.compiledPrograms.values()).reduce((sum, r) => sum + r.compileTime, 0)

    return { total, compiled, failed, pending, totalCompileTime }
  }

  onCompile(callback: (result: ShaderCompileResult) => void): () => void {
    this.onCompileCallbacks.push(callback)
    return () => {
      const index = this.onCompileCallbacks.indexOf(callback)
      if (index > -1) {
        this.onCompileCallbacks.splice(index, 1)
      }
    }
  }

  private notifyCallbacks(result: ShaderCompileResult): void {
    this.onCompileCallbacks.forEach(callback => callback(result))
  }

  clear(): void {
    if (this.idleCallbackId !== null) {
      if ('cancelIdleCallback' in window) {
        cancelIdleCallback(this.idleCallbackId)
      } else {
        clearTimeout(this.idleCallbackId)
      }
      this.idleCallbackId = null
    }
    this.compileQueue = []
    this.compiledPrograms.clear()
  }

  updateConfig(config: Partial<PrecompileConfig>): void {
    this.config = { ...this.config, ...config }
  }
}

export const shaderPrecompiler = new ShaderPrecompiler()
