/**
 * TTS 语音合成引擎 — Edge TTS（微软晓晓）通过本地 Python 代理
 */
// 用相对路径，保证别人用 http://<你的IP>:8080 访问时，
// 浏览器会自动请求"同源"的 /api/tts，而不是他本机的 localhost。
const TTS_PROXY_URL = '/api/tts'

class TTSEngine {
  private audioContext: AudioContext | null = null
  private currentSource: AudioBufferSourceNode | null = null
  // 频谱分析器：连接在 source 与 destination 之间，供外部（数字人口型）实时读取频域数据
  private analyser: AnalyserNode | null = null
  private stopped = false
  // 播放代际计数器：防止旧音频的 onended 回调错误覆盖新音频的 isPlaying 状态
  private playGeneration = 0

  // ====== 队列顺序播放（不会互相打断） ======
  private queue: ArrayBuffer[] = []
  private isPlaying = false

  /**
   * 获取频谱分析器（用于驱动数字人口型）。
   * 调用方应在每帧 animate 循环中通过 analyser.getByteFrequencyData() 提取频域数据。
   * 返回 null 表示当前无可用分析器（首次播放前 / 不支持 Web Audio）。
   */
  getAnalyser(): AnalyserNode | null {
    return this.analyser
  }

  /** 当前是否正在播放音频（外部可据此判断口型是否应激活） */
  isAudioPlaying(): boolean {
    return this.isPlaying && !this.stopped
  }

  /** 确保 AudioContext 与 AnalyserNode 已初始化（懒创建） */
  private ensureContext(): void {
    if (!this.audioContext) {
      this.audioContext = new AudioContext()
    }
    if (!this.analyser && this.audioContext) {
      this.analyser = this.audioContext.createAnalyser()
      // fftSize=512 → 频率分箱数 256；覆盖 0~sampleRate/2，对语音频段足够
      this.analyser.fftSize = 512
      this.analyser.smoothingTimeConstant = 0.6
      // analyser 常驻连接到 destination，source 只连 analyser
      this.analyser.connect(this.audioContext.destination)
    }
  }

  /** 只合成不播放 */
  async synthesize(text: string): Promise<ArrayBuffer> {
    if (!text.trim()) return new ArrayBuffer(0)
    return this.fetchTTS(text)
  }

  /** 入队顺序播放（不会打断前面正在播的） */
  playQueued(audio: ArrayBuffer): void {
    if (!audio || audio.byteLength === 0) return
    this.stopped = false
    this.queue.push(audio)
    this.drainQueue()
  }

  private async drainQueue(): Promise<void> {
    if (this.isPlaying || this.stopped) return
    this.isPlaying = true
    while (this.queue.length > 0) {
      const audio = this.queue.shift()!
      if (this.stopped) break
      await this.playAudio(audio)
    }
    this.isPlaying = false
  }

  /** 直接播放（会打断当前播放） */
  play(audio: ArrayBuffer): void {
    if (!audio || audio.byteLength === 0) {
      return
    }
    this.stop()                 // 先停掉旧音频
    this.stopped = false        // 再重置标志
    this.queue = []
    const myGen = ++this.playGeneration  // 代际标记：仅当前播放的回调才能重置 isPlaying
    this.isPlaying = true       // 标记播放中（供 isAudioPlaying() 检测，驱动口型防提前收口）
    this.playAudio(audio)
      .then(() => { if (myGen === this.playGeneration) this.isPlaying = false })
      .catch(e => { console.error('[TTS] 播放失败:', e); if (myGen === this.playGeneration) this.isPlaying = false })
  }

  private async fetchTTS(text: string): Promise<ArrayBuffer> {
    const response = await fetch(TTS_PROXY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text })
    })
    if (!response.ok) {
      const ct = response.headers.get('content-type') || ''
      if (ct.includes('application/json')) {
        const err = await response.json()
        throw new Error(err.error || 'TTS代理请求失败')
      }
      throw new Error(`TTS代理: HTTP ${response.status}`)
    }
    const buf = await response.arrayBuffer()
    return buf
  }

  private async playAudio(arrayBuffer: ArrayBuffer): Promise<void> {
    if (this.stopped) { return }
    this.ensureContext()
    if (!this.audioContext || !this.analyser) {
      return
    }
    if (this.audioContext.state === 'suspended') {
      await this.audioContext.resume()
    }
    if (this.stopped) { return }
    const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer.slice(0))
    if (this.stopped) { return }
    const source = this.audioContext.createBufferSource()
    source.buffer = audioBuffer
    // 关键：source → analyser → destination，让外部能读取频谱驱动口型
    source.connect(this.analyser)
    this.currentSource = source
    if (this.stopped) { source.stop(); return }
    source.start(0)
    return new Promise(r => { source.onended = () => { r() } })
  }

  stop(): void {
    this.stopped = true
    this.playGeneration++  // 使任何待处理的 .then() 回调失效
    this.queue = []
    this.isPlaying = false
    if (this.currentSource) {
      try { this.currentSource.stop() } catch (_) {}
      this.currentSource = null
    }
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel()
    }
  }
}

export const ttsEngine = new TTSEngine()
