/**
 * TTS 语音合成引擎 — Edge TTS（微软晓晓）通过本地 Python 代理
 */
const TTS_PROXY_URL = 'http://localhost:8080/api/tts'

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
    if (!audio || audio.byteLength === 0) return
    this.stopped = false
    this.queue = []
    this.isPlaying = false
    this.stop()
    this.playAudio(audio).catch(e => console.warn('[TTS] 播放失败:', e))
  }

  private async fetchTTS(text: string): Promise<ArrayBuffer> {
    console.log('[TTS] 合成:', text.substring(0, 50) + '...')
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
    return response.arrayBuffer()
  }

  private async playAudio(arrayBuffer: ArrayBuffer): Promise<void> {
    if (!this.audioContext) { this.audioContext = new AudioContext() }
    if (this.audioContext.state === 'suspended') await this.audioContext.resume()
    const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer.slice(0))
    const source = this.audioContext.createBufferSource()
    source.buffer = audioBuffer
    source.connect(this.audioContext.destination)
    this.currentSource = source
    source.start(0)
    return new Promise(r => { source.onended = () => r() })
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
