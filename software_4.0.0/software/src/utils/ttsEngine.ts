/**
 * TTS 语音合成引擎 — Edge TTS（微软晓晓）通过本地 Python 代理
 */
// 用相对路径，保证别人用 http://<你的IP>:8080 访问时，
// 浏览器会自动请求"同源"的 /api/tts，而不是他本机的 localhost。
const TTS_PROXY_URL = '/api/tts'

class TTSEngine {
  private audioContext: AudioContext | null = null
  private currentSource: AudioBufferSourceNode | null = null
  private stopped = false

  // ====== 队列顺序播放（不会互相打断） ======
  private queue: ArrayBuffer[] = []
  private isPlaying = false

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
      console.warn('[TTS] play() 被调用但 audio 为空')
      return
    }
    this.stop()                 // 先停掉旧音频
    this.stopped = false        // 再重置标志
    this.queue = []
    this.isPlaying = false
    console.log('[TTS] play() 开始播放, size=', audio.byteLength)
    this.playAudio(audio).catch(e => console.error('[TTS] 播放失败:', e))
  }

  private async fetchTTS(text: string): Promise<ArrayBuffer> {
    console.log('[TTS] 合成请求:', text.substring(0, 50) + '...')
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
    console.log('[TTS] 合成完成, size=', buf.byteLength)
    return buf
  }

  private async playAudio(arrayBuffer: ArrayBuffer): Promise<void> {
    console.log('[TTS] playAudio 开始, stopped=', this.stopped)
    if (this.stopped) { console.warn('[TTS] playAudio: stopped=true, 退出'); return }
    if (!this.audioContext) { this.audioContext = new AudioContext() }
    console.log('[TTS] AudioContext state:', this.audioContext.state)
    if (this.audioContext.state === 'suspended') {
      console.log('[TTS] 尝试 resume AudioContext...')
      await this.audioContext.resume()
      console.log('[TTS] resume 后 state:', this.audioContext.state)
    }
    if (this.stopped) { console.warn('[TTS] playAudio: resume 后 stopped=true, 退出'); return }
    console.log('[TTS] 开始 decodeAudioData...')
    const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer.slice(0))
    console.log('[TTS] decode 完成, duration=', audioBuffer.duration)
    if (this.stopped) { console.warn('[TTS] playAudio: decode 后 stopped=true, 退出'); return }
    const source = this.audioContext.createBufferSource()
    source.buffer = audioBuffer
    source.connect(this.audioContext.destination)
    this.currentSource = source
    if (this.stopped) { console.warn('[TTS] playAudio: start 前 stopped=true, 停止'); source.stop(); return }
    console.log('[TTS] source.start(0) 播放!')
    source.start(0)
    return new Promise(r => { source.onended = () => { console.log('[TTS] 播放结束'); r() } })
  }

  stop(): void {
    this.stopped = true
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
