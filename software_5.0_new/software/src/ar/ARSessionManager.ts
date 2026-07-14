/**
 * ARSessionManager —— AR 会话管理器
 *
 * 职责：
 *   1. 管理 AR 会话生命周期：created → active → paused → resumed → destroyed
 *   2. 异常恢复：捕获 AR 运行时异常，自动尝试恢复（最多 maxRecoveryAttempts 次）
 *   3. 状态自动恢复：页面从后台切回前台时自动恢复 AR 会话
 *   4. 监听 visibilitychange 事件：页面隐藏时暂停 AR，显示时恢复
 *   5. 崩溃防护：全局错误捕获，防止 AR 功能崩溃影响整个应用
 *   6. 会话日志：记录关键事件和错误，用于排查问题
 *
 * 优化目的：
 *   - AR 功能涉及摄像头、AI 请求、渲染等多个易错环节，
 *     会话管理器统一处理异常恢复，避免页面白屏或功能失效。
 *   - 页面切后台时摄像头流会被系统暂停，切回前台需自动恢复，
 *     否则用户会看到黑屏。
 *
 * 可选注入 ARExitManager：destroy 时注销所有监听与定时器。
 */

import { ARExitManager } from './ARExitManager'

/** 会话状态 */
export type SessionState =
  | 'created'
  | 'active'
  | 'paused'
  | 'resumed'
  | 'destroyed'
  | 'error'

/** 会话日志条目 */
export interface SessionLogEntry {
  /** 时间戳 */
  timestamp: number
  /** 日志级别 */
  level: 'info' | 'warn' | 'error'
  /** 事件名称 */
  event: string
  /** 详情（可选） */
  detail?: string
}

/** 会话配置 */
export interface SessionConfig {
  /** 最大恢复尝试次数（默认 3） */
  maxRecoveryAttempts: number
  /** 页面隐藏时自动暂停（默认 true） */
  autoPauseOnHidden: boolean
  /** 启用全局错误边界（默认 true） */
  errorBoundary: boolean
}

/** 默认会话配置 */
const DEFAULT_CONFIG: SessionConfig = {
  maxRecoveryAttempts: 3,
  autoPauseOnHidden: true,
  errorBoundary: true
}

/** 会话日志最大条数（超出后移除最早的） */
const MAX_LOG_ENTRIES = 100

/** 恢复重试间隔（毫秒） */
const RECOVERY_RETRY_INTERVAL = 1000

export class ARSessionManager {
  /** 当前会话状态 */
  private state: SessionState = 'created'
  /** 会话配置 */
  private config: SessionConfig
  /** 外部资源回收管理器（可选） */
  private exitManager: ARExitManager | null = null
  /** 已注册的资源句柄 ID */
  private handleId: string | null = null

  /** 会话日志 */
  private logs: SessionLogEntry[] = []

  /** 已恢复次数 */
  private recoveryCount = 0
  /** 恢复重试定时器 */
  private recoveryTimer: ReturnType<typeof setTimeout> | null = null

  /** 状态变化回调列表 */
  private stateCallbacks: Array<(state: SessionState) => void> = []
  /** 错误回调列表 */
  private errorCallbacks: Array<(error: Error) => void> = []

  /** visibilitychange 事件处理函数引用（用于解绑） */
  private boundVisibilityChange: () => void
  /** 全局 error 事件处理函数引用（用于解绑） */
  private boundGlobalError: (e: ErrorEvent) => void
  /** 全局 unhandledrejection 事件处理函数引用（用于解绑） */
  private boundUnhandledRejection: (e: PromiseRejectionEvent) => void

  /** 会话启动回调（由外部提供，在 start/resume 时调用） */
  private startHandler: (() => void | Promise<void>) | null = null
  /** 会话暂停回调（由外部提供，在 pause 时调用） */
  private pauseHandler: (() => void | Promise<void>) | null = null

  constructor(
    exitManager?: ARExitManager,
    config?: Partial<SessionConfig>,
    handlers?: {
      onStart?: () => void | Promise<void>
      onPause?: () => void | Promise<void>
    }
  ) {
    this.exitManager = exitManager ?? null
    this.config = { ...DEFAULT_CONFIG, ...config }
    this.startHandler = handlers?.onStart ?? null
    this.pauseHandler = handlers?.onPause ?? null

    // 绑定事件处理函数 this
    this.boundVisibilityChange = this.onVisibilityChange.bind(this)
    this.boundGlobalError = this.onGlobalError.bind(this)
    this.boundUnhandledRejection = this.onUnhandledRejection.bind(this)
  }

  /**
   * 启动会话。
   * 状态流转：created → active
   * 注册全局事件监听并调用外部启动回调。
   */
  async start(): Promise<void> {
    if (this.state === 'destroyed') {
      this.log('warn', 'startBlocked', '会话已销毁，无法重新启动')
      return
    }
    if (this.state === 'active') {
      return
    }

    this.registerListeners()
    this.registerResource()

    try {
      if (this.startHandler) {
        await this.startHandler()
      }
      this.setState('active')
      this.log('info', 'sessionStarted', 'AR 会话已启动')
    } catch (err) {
      this.handleError(err as Error, 'start')
    }
  }

  /**
   * 暂停会话。
   * 状态流转：active → paused
   * 由外部 pauseHandler 执行具体暂停逻辑（如停止识别循环）。
   */
  async pause(): Promise<void> {
    if (this.state !== 'active' && this.state !== 'resumed') {
      return
    }
    try {
      if (this.pauseHandler) {
        await this.pauseHandler()
      }
      this.setState('paused')
      this.log('info', 'sessionPaused', 'AR 会话已暂停')
    } catch (err) {
      this.handleError(err as Error, 'pause')
    }
  }

  /**
   * 恢复会话。
   * 状态流转：paused → resumed → active
   * 调用外部启动回调重新激活 AR 功能。
   */
  async resume(): Promise<void> {
    if (this.state !== 'paused' && this.state !== 'error') {
      return
    }
    try {
      this.setState('resumed')
      if (this.startHandler) {
        await this.startHandler()
      }
      this.setState('active')
      this.log('info', 'sessionResumed', 'AR 会话已恢复')
    } catch (err) {
      this.handleError(err as Error, 'resume')
    }
  }

  /**
   * 销毁会话。
   * 状态流转：任意 → destroyed
   * 移除所有监听、清理定时器、注销资源。
   */
  destroy(): void {
    if (this.state === 'destroyed') return

    this.removeListeners()
    this.clearRecoveryTimer()

    if (this.exitManager && this.handleId) {
      this.exitManager.unregister(this.handleId)
    }
    this.handleId = null

    this.setState('destroyed')
    this.log('info', 'sessionDestroyed', 'AR 会话已销毁')
  }

  /**
   * 注册状态变化回调。
   * @returns 取消注册的函数
   */
  onStateChange(callback: (state: SessionState) => void): () => void {
    this.stateCallbacks.push(callback)
    return () => {
      const idx = this.stateCallbacks.indexOf(callback)
      if (idx >= 0) {
        this.stateCallbacks.splice(idx, 1)
      }
    }
  }

  /**
   * 注册错误回调。
   * @returns 取消注册的函数
   */
  onError(callback: (error: Error) => void): () => void {
    this.errorCallbacks.push(callback)
    return () => {
      const idx = this.errorCallbacks.indexOf(callback)
      if (idx >= 0) {
        this.errorCallbacks.splice(idx, 1)
      }
    }
  }

  /**
   * 获取会话日志。
   */
  getSessionLog(): SessionLogEntry[] {
    return [...this.logs]
  }

  /**
   * 获取已恢复次数。
   */
  getRecoveryCount(): number {
    return this.recoveryCount
  }

  /** 获取当前会话状态 */
  getState(): SessionState {
    return this.state
  }

  /**
   * 页面可见性变化处理。
   *
   * 当 autoPauseOnHidden 启用时：
   *   - 页面隐藏 → 暂停会话（摄像头流会被系统暂停）
   *   - 页面显示 → 恢复会话（重新激活摄像头与识别）
   */
  private onVisibilityChange(): void {
    if (!this.config.autoPauseOnHidden) return

    if (document.hidden) {
      // 页面隐藏：暂停
      if (this.state === 'active' || this.state === 'resumed') {
        this.log('info', 'visibilityHidden', '页面隐藏，自动暂停会话')
        this.pause()
      }
    } else {
      // 页面显示：恢复
      if (this.state === 'paused') {
        this.log('info', 'visibilityVisible', '页面显示，自动恢复会话')
        this.resume()
      }
    }
  }

  /**
   * 全局错误捕获。
   * 防止 AR 运行时异常导致整个应用崩溃。
   */
  private onGlobalError(e: ErrorEvent): void {
    if (!this.config.errorBoundary) return
    // 仅捕获与 AR 相关的错误（通过 message 前缀判断）
    const msg = e.message || ''
    if (msg.includes('[AR') || msg.includes('AR')) {
      this.log('error', 'globalError', `${msg} @ ${e.filename}:${e.lineno}`)
      this.handleError(new Error(msg), 'runtime')
      // 阻止错误冒泡，避免影响整个应用
      e.preventDefault?.()
    }
  }

  /**
   * 全局 Promise rejection 捕获。
   */
  private onUnhandledRejection(e: PromiseRejectionEvent): void {
    if (!this.config.errorBoundary) return
    const reason = e.reason
    const msg = reason instanceof Error ? reason.message : String(reason)
    if (msg.includes('[AR') || msg.includes('AR')) {
      this.log('error', 'unhandledRejection', msg)
      this.handleError(reason instanceof Error ? reason : new Error(msg), 'promise')
    }
  }

  /**
   * 统一错误处理：尝试自动恢复。
   *
   * 恢复策略：
   *   1. 记录错误日志
   *   2. 若恢复次数未超上限，延迟 RECOVERY_RETRY_INTERVAL 后尝试 resume
   *   3. 超过上限则进入 error 状态，不再自动恢复
   *
   * @param err 错误对象
   * @param source 错误来源（start / pause / resume / runtime / promise）
   */
  private handleError(err: Error, source: string): void {
    this.log('error', `${source}Error`, err.message)

    // 通知错误回调
    for (const cb of this.errorCallbacks) {
      try {
        cb(err)
      } catch (e) {
        console.warn('[ARSessionManager] 错误回调异常:', e)
      }
    }

    // 尝试自动恢复
    if (this.recoveryCount < this.config.maxRecoveryAttempts) {
      this.recoveryCount++
      this.log('info', 'recoveryAttempt', `第 ${this.recoveryCount} 次尝试恢复`)
      this.setState('error')

      this.clearRecoveryTimer()
      this.recoveryTimer = setTimeout(() => {
        // 恢复前先确保处于 error 或 paused 状态
        if (this.state === 'error' || this.state === 'paused') {
          this.resume().catch(recoveryErr => {
            this.log('error', 'recoveryFailed', recoveryErr.message)
          })
        }
      }, RECOVERY_RETRY_INTERVAL)
    } else {
      this.log('error', 'recoveryExhausted',
        `已达到最大恢复次数 ${this.config.maxRecoveryAttempts}，停止自动恢复`)
      this.setState('error')
    }
  }

  /**
   * 更新会话状态并通知回调。
   */
  private setState(newState: SessionState): void {
    const oldState = this.state
    this.state = newState
    if (oldState !== newState) {
      this.log('info', 'stateChange', `${oldState} → ${newState}`)
      for (const cb of this.stateCallbacks) {
        try {
          cb(newState)
        } catch (e) {
          console.warn('[ARSessionManager] 状态回调异常:', e)
        }
      }
    }
  }

  /**
   * 记录会话日志。
   * 超过 MAX_LOG_ENTRIES 时移除最早的条目。
   */
  private log(level: SessionLogEntry['level'], event: string, detail?: string): void {
    const entry: SessionLogEntry = {
      timestamp: Date.now(),
      level,
      event,
      detail
    }
    this.logs.push(entry)
    // 同时输出到控制台，便于开发调试
    const prefix = '[ARSessionManager]'
    if (level === 'error') {
      console.error(prefix, event, detail ?? '')
    } else if (level === 'warn') {
      console.warn(prefix, event, detail ?? '')
    } else {
      console.log(prefix, event, detail ?? '')
    }
    // 超限移除最早条目
    while (this.logs.length > MAX_LOG_ENTRIES) {
      this.logs.shift()
    }
  }

  /** 注册全局事件监听 */
  private registerListeners(): void {
    document.addEventListener('visibilitychange', this.boundVisibilityChange)
    if (this.config.errorBoundary) {
      window.addEventListener('error', this.boundGlobalError)
      window.addEventListener('unhandledrejection', this.boundUnhandledRejection)
    }
  }

  /** 移除全局事件监听 */
  private removeListeners(): void {
    document.removeEventListener('visibilitychange', this.boundVisibilityChange)
    window.removeEventListener('error', this.boundGlobalError)
    window.removeEventListener('unhandledrejection', this.boundUnhandledRejection)
  }

  /** 清理恢复定时器 */
  private clearRecoveryTimer(): void {
    if (this.recoveryTimer !== null) {
      clearTimeout(this.recoveryTimer)
      this.recoveryTimer = null
    }
  }

  /** 向 ARExitManager 注册资源句柄 */
  private registerResource(): void {
    if (!this.exitManager || this.handleId) return
    this.handleId = `ar-session-${Date.now()}`
    this.exitManager.register({
      type: 'cache',
      id: this.handleId,
      dispose: () => {
        this.removeListeners()
        this.clearRecoveryTimer()
      }
    })
  }
}
