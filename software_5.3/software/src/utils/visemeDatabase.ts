/**
 * 视素（Viseme）数据库与面部微表情系统
 * -----------------------------------------------------------
 * 设计目标：
 * 1. 50+ 基础音素 → 视素映射（覆盖汉语拼音全部声母/韵母组合）
 * 2. 200+ 常用音节组合 → 视素时序序列
 * 3. 6 种情感的视素权重修饰器（emotional viseme modifiers）
 * 4. 12+ 面部微表情定义（基于 VRM 表情组合实现）
 * 5. 贝塞尔曲线过渡配置（用于口型插值）
 *
 * VRM 模型能力边界（不可变约束）：
 * - 固定表情 preset: neutral, happy, angry, sad, surprised, relaxed, blink, blink_l, blink_r
 * - 固定视素: aa, ih, ou, ee, oh（5 个元音）
 * - 无法新增 blend shapes，微表情通过组合现有表情权重 + 小幅度实现
 */

// ====== 视素类型定义 ======
export type Viseme = 'aa' | 'ih' | 'ou' | 'ee' | 'oh'
export const VISEMES: Viseme[] = ['aa', 'ih', 'ou', 'ee', 'oh']

// ====== 1. 50+ 基础音素 → 视素映射 ======
// 扩展自 INITIAL_TO_VOWEL，覆盖汉语拼音所有声母、韵母及组合
// 每个音素映射到主视素 + 次视素（用于更精细的唇形过渡）
export interface PhonemeMap {
  primary: Viseme      // 主视素（唇形主体）
  secondary: Viseme    // 次视素（过渡辅助，权重较低）
  secondaryWeight: number  // 次视素权重 (0~0.4)
}

export const PHONEME_TO_VISEME: Record<string, PhonemeMap> = {
  // === 韵母（元音）===
  // a 系（开口度大，唇形扁平）
  a:    { primary: 'aa', secondary: 'ee', secondaryWeight: 0.15 },
  ai:   { primary: 'aa', secondary: 'ih', secondaryWeight: 0.25 },
  an:   { primary: 'aa', secondary: 'ou', secondaryWeight: 0.20 },
  ang:  { primary: 'aa', secondary: 'oh', secondaryWeight: 0.30 },
  ao:   { primary: 'aa', secondary: 'oh', secondaryWeight: 0.40 },
  // o 系（圆唇）
  o:    { primary: 'oh', secondary: 'ou', secondaryWeight: 0.30 },
  ou:   { primary: 'ou', secondary: 'oh', secondaryWeight: 0.25 },
  // e 系（扁唇，嘴角微展）
  e:    { primary: 'ee', secondary: 'ih', secondaryWeight: 0.30 },
  ei:   { primary: 'ee', secondary: 'ih', secondaryWeight: 0.40 },
  en:   { primary: 'ee', secondary: 'ou', secondaryWeight: 0.20 },
  eng:  { primary: 'ee', secondary: 'oh', secondaryWeight: 0.25 },
  er:   { primary: 'ee', secondary: 'oh', secondaryWeight: 0.35 },
  // i 系（扁唇，嘴角展开）
  i:    { primary: 'ih', secondary: 'ee', secondaryWeight: 0.25 },
  in:   { primary: 'ih', secondary: 'ee', secondaryWeight: 0.20 },
  ing:  { primary: 'ih', secondary: 'oh', secondaryWeight: 0.25 },
  ia:   { primary: 'aa', secondary: 'ih', secondaryWeight: 0.30 },
  ie:   { primary: 'ee', secondary: 'ih', secondaryWeight: 0.35 },
  iao:  { primary: 'aa', secondary: 'oh', secondaryWeight: 0.30 },
  iou:  { primary: 'ou', secondary: 'ih', secondaryWeight: 0.25 },
  iu:   { primary: 'ou', secondary: 'ih', secondaryWeight: 0.25 },
  // u 系（圆唇收小）
  u:    { primary: 'ou', secondary: 'oh', secondaryWeight: 0.25 },
  ua:   { primary: 'aa', secondary: 'ou', secondaryWeight: 0.30 },
  uo:   { primary: 'oh', secondary: 'ou', secondaryWeight: 0.30 },
  ui:   { primary: 'ee', secondary: 'ou', secondaryWeight: 0.30 },
  uai:  { primary: 'aa', secondary: 'ee', secondaryWeight: 0.25 },
  uei:  { primary: 'ee', secondary: 'aa', secondaryWeight: 0.25 },
  uan:  { primary: 'aa', secondary: 'ou', secondaryWeight: 0.25 },
  uen:  { primary: 'ee', secondary: 'ou', secondaryWeight: 0.20 },
  uang: { primary: 'aa', secondary: 'oh', secondaryWeight: 0.25 },
  ueng: { primary: 'oh', secondary: 'aa', secondaryWeight: 0.20 },
  // ü 系（圆唇收小，归到 ih 视觉）
  v:    { primary: 'ih', secondary: 'ou', secondaryWeight: 0.30 },
  ve:   { primary: 'ee', secondary: 'ou', secondaryWeight: 0.30 },
  van:  { primary: 'aa', secondary: 'ih', secondaryWeight: 0.25 },
  vn:   { primary: 'ih', secondary: 'ou', secondaryWeight: 0.20 },

  // === 声母（辅音）===
  // b/p/m/f：双唇/唇齿，闭合或接近，过渡到 oh
  b: { primary: 'oh', secondary: 'ou', secondaryWeight: 0.20 },
  p: { primary: 'oh', secondary: 'ou', secondaryWeight: 0.25 },
  m: { primary: 'oh', secondary: 'aa', secondaryWeight: 0.30 },
  f: { primary: 'oh', secondary: 'ee', secondaryWeight: 0.25 },
  // d/t/n/l：舌尖中音，过渡到 ee
  d: { primary: 'ee', secondary: 'ih', secondaryWeight: 0.25 },
  t: { primary: 'ee', secondary: 'ih', secondaryWeight: 0.30 },
  n: { primary: 'ee', secondary: 'aa', secondaryWeight: 0.30 },
  l: { primary: 'ee', secondary: 'aa', secondaryWeight: 0.35 },
  // g/k/h：舌根音，过渡到 ee
  g: { primary: 'ee', secondary: 'oh', secondaryWeight: 0.20 },
  k: { primary: 'ee', secondary: 'oh', secondaryWeight: 0.25 },
  h: { primary: 'ee', secondary: 'oh', secondaryWeight: 0.30 },
  // j/q/x：舌面音，过渡到 ih
  j: { primary: 'ih', secondary: 'ee', secondaryWeight: 0.30 },
  q: { primary: 'ih', secondary: 'ee', secondaryWeight: 0.35 },
  x: { primary: 'ih', secondary: 'ee', secondaryWeight: 0.35 },
  // zh/ch/sh/r：翘舌音，过渡到 ih
  zh: { primary: 'ih', secondary: 'oh', secondaryWeight: 0.25 },
  ch: { primary: 'ih', secondary: 'oh', secondaryWeight: 0.30 },
  sh: { primary: 'ih', secondary: 'oh', secondaryWeight: 0.35 },
  r:  { primary: 'ih', secondary: 'oh', secondaryWeight: 0.30 },
  // z/c/s：平舌音，过渡到 ih
  z: { primary: 'ih', secondary: 'ee', secondaryWeight: 0.25 },
  c: { primary: 'ih', secondary: 'ee', secondaryWeight: 0.30 },
  s: { primary: 'ih', secondary: 'ee', secondaryWeight: 0.30 },
  // y/w：半元音
  y: { primary: 'ih', secondary: 'ee', secondaryWeight: 0.25 },
  w: { primary: 'ou', secondary: 'oh', secondaryWeight: 0.25 },

  // === 英文字母（基础覆盖）===
  // a/e/i/o/u 已在上方覆盖
}

// ====== 2. 200+ 常用音节组合 → 视素时序序列 ======
// 每个音节映射到 [起始视素, 持续视素, 收尾视素] 时序
// 用于实现多音节平滑过渡（如 "你好" → nihao 的完整视素序列）
export interface SyllableViseme {
  start: Viseme     // 音节起始（声母或首元音）
  sustain: Viseme   // 音节持续（主元音）
  end: Viseme       // 音节收尾（韵尾）
  duration: number  // 建议时长 (ms)
}

// 常用汉语音节 → 视素序列映射（覆盖高频 200+ 音节）
export const SYLLABLE_TO_VISEMES: Record<string, SyllableViseme> = {
  // === a 系音节 ===
  'a':    { start: 'aa', sustain: 'aa', end: 'aa', duration: 180 },
  'ai':   { start: 'aa', sustain: 'aa', end: 'ih', duration: 200 },
  'an':   { start: 'aa', sustain: 'aa', end: 'ou', duration: 200 },
  'ang':  { start: 'aa', sustain: 'aa', end: 'oh', duration: 220 },
  'ao':   { start: 'aa', sustain: 'aa', end: 'oh', duration: 220 },
  'ba':   { start: 'oh', sustain: 'aa', end: 'aa', duration: 180 },
  'pa':   { start: 'oh', sustain: 'aa', end: 'aa', duration: 180 },
  'ma':   { start: 'oh', sustain: 'aa', end: 'aa', duration: 180 },
  'fa':   { start: 'oh', sustain: 'aa', end: 'aa', duration: 180 },
  'da':   { start: 'ee', sustain: 'aa', end: 'aa', duration: 180 },
  'ta':   { start: 'ee', sustain: 'aa', end: 'aa', duration: 180 },
  'na':   { start: 'ee', sustain: 'aa', end: 'aa', duration: 180 },
  'la':   { start: 'ee', sustain: 'aa', end: 'aa', duration: 180 },
  'ga':   { start: 'ee', sustain: 'aa', end: 'aa', duration: 180 },
  'ka':   { start: 'ee', sustain: 'aa', end: 'aa', duration: 180 },
  'ha':   { start: 'ee', sustain: 'aa', end: 'aa', duration: 180 },
  'jia':  { start: 'ih', sustain: 'aa', end: 'aa', duration: 200 },
  'qia':  { start: 'ih', sustain: 'aa', end: 'aa', duration: 200 },
  'xia':  { start: 'ih', sustain: 'aa', end: 'aa', duration: 200 },
  'hua':  { start: 'ou', sustain: 'aa', end: 'aa', duration: 200 },
  'gua':  { start: 'ee', sustain: 'aa', end: 'aa', duration: 200 },
  'kua':  { start: 'ee', sustain: 'aa', end: 'aa', duration: 200 },

  // === o/e 系音节 ===
  'o':    { start: 'oh', sustain: 'oh', end: 'oh', duration: 180 },
  'ou':   { start: 'ou', sustain: 'ou', end: 'oh', duration: 200 },
  'bo':   { start: 'oh', sustain: 'oh', end: 'oh', duration: 180 },
  'po':   { start: 'oh', sustain: 'oh', end: 'oh', duration: 180 },
  'mo':   { start: 'oh', sustain: 'oh', end: 'oh', duration: 180 },
  'fo':   { start: 'oh', sustain: 'oh', end: 'oh', duration: 180 },
  'e':    { start: 'ee', sustain: 'ee', end: 'ee', duration: 180 },
  'ei':   { start: 'ee', sustain: 'ee', end: 'ih', duration: 200 },
  'en':   { start: 'ee', sustain: 'ee', end: 'ou', duration: 200 },
  'eng':  { start: 'ee', sustain: 'ee', end: 'oh', duration: 220 },
  'er':   { start: 'ee', sustain: 'ee', end: 'oh', duration: 220 },
  'de':   { start: 'ee', sustain: 'ee', end: 'ee', duration: 180 },
  'te':   { start: 'ee', sustain: 'ee', end: 'ee', duration: 180 },
  'ne':   { start: 'ee', sustain: 'ee', end: 'ee', duration: 180 },
  'le':   { start: 'ee', sustain: 'ee', end: 'ee', duration: 180 },
  'ge':   { start: 'ee', sustain: 'ee', end: 'ee', duration: 180 },
  'ke':   { start: 'ee', sustain: 'ee', end: 'ee', duration: 180 },
  'he':   { start: 'ee', sustain: 'ee', end: 'ee', duration: 180 },

  // === i 系音节 ===
  'i':    { start: 'ih', sustain: 'ih', end: 'ih', duration: 180 },
  'in':   { start: 'ih', sustain: 'ih', end: 'ee', duration: 200 },
  'ing':  { start: 'ih', sustain: 'ih', end: 'oh', duration: 220 },
  'bi':   { start: 'oh', sustain: 'ih', end: 'ih', duration: 180 },
  'pi':   { start: 'oh', sustain: 'ih', end: 'ih', duration: 180 },
  'mi':   { start: 'oh', sustain: 'ih', end: 'ih', duration: 180 },
  'di':   { start: 'ee', sustain: 'ih', end: 'ih', duration: 180 },
  'ti':   { start: 'ee', sustain: 'ih', end: 'ih', duration: 180 },
  'ni':   { start: 'ee', sustain: 'ih', end: 'ih', duration: 180 },
  'li':   { start: 'ee', sustain: 'ih', end: 'ih', duration: 180 },
  'ji':   { start: 'ih', sustain: 'ih', end: 'ih', duration: 180 },
  'qi':   { start: 'ih', sustain: 'ih', end: 'ih', duration: 180 },
  'xi':   { start: 'ih', sustain: 'ih', end: 'ih', duration: 180 },
  'yi':   { start: 'ih', sustain: 'ih', end: 'ih', duration: 180 },

  // === u 系音节 ===
  'u':    { start: 'ou', sustain: 'ou', end: 'ou', duration: 180 },
  'bu':   { start: 'oh', sustain: 'ou', end: 'ou', duration: 180 },
  'pu':   { start: 'oh', sustain: 'ou', end: 'ou', duration: 180 },
  'mu':   { start: 'oh', sustain: 'ou', end: 'ou', duration: 180 },
  'fu':   { start: 'oh', sustain: 'ou', end: 'ou', duration: 180 },
  'du':   { start: 'ee', sustain: 'ou', end: 'ou', duration: 180 },
  'tu':   { start: 'ee', sustain: 'ou', end: 'ou', duration: 180 },
  'nu':   { start: 'ee', sustain: 'ou', end: 'ou', duration: 180 },
  'lu':   { start: 'ee', sustain: 'ou', end: 'ou', duration: 180 },
  'gu':   { start: 'ee', sustain: 'ou', end: 'ou', duration: 180 },
  'ku':   { start: 'ee', sustain: 'ou', end: 'ou', duration: 180 },
  'hu':   { start: 'ee', sustain: 'ou', end: 'ou', duration: 180 },
  'wu':   { start: 'ou', sustain: 'ou', end: 'ou', duration: 180 },
  'zhu':  { start: 'ih', sustain: 'ou', end: 'ou', duration: 200 },
  'chu':  { start: 'ih', sustain: 'ou', end: 'ou', duration: 200 },
  'shu':  { start: 'ih', sustain: 'ou', end: 'ou', duration: 200 },
  'ru':   { start: 'ih', sustain: 'ou', end: 'ou', duration: 200 },

  // === ü 系音节 ===
  'nv':   { start: 'ee', sustain: 'ih', end: 'ou', duration: 200 },
  'lv':   { start: 'ee', sustain: 'ih', end: 'ou', duration: 200 },
  'ju':   { start: 'ih', sustain: 'ih', end: 'ou', duration: 200 },
  'qu':   { start: 'ih', sustain: 'ih', end: 'ou', duration: 200 },
  'xu':   { start: 'ih', sustain: 'ih', end: 'ou', duration: 200 },
  'yu':   { start: 'ih', sustain: 'ih', end: 'ou', duration: 200 },

  // === 复合韵母音节 ===
  'bao':  { start: 'oh', sustain: 'aa', end: 'oh', duration: 240 },
  'pao':  { start: 'oh', sustain: 'aa', end: 'oh', duration: 240 },
  'mao':  { start: 'oh', sustain: 'aa', end: 'oh', duration: 240 },
  'dao':  { start: 'ee', sustain: 'aa', end: 'oh', duration: 240 },
  'tao':  { start: 'ee', sustain: 'aa', end: 'oh', duration: 240 },
  'gao':  { start: 'ee', sustain: 'aa', end: 'oh', duration: 240 },
  'kao':  { start: 'ee', sustain: 'aa', end: 'oh', duration: 240 },
  'hao':  { start: 'ee', sustain: 'aa', end: 'oh', duration: 240 },
  'niao': { start: 'ih', sustain: 'aa', end: 'oh', duration: 260 },
  'liao': { start: 'ee', sustain: 'aa', end: 'oh', duration: 260 },
  'jiao': { start: 'ih', sustain: 'aa', end: 'oh', duration: 260 },
  'qiao': { start: 'ih', sustain: 'aa', end: 'oh', duration: 260 },
  'xiao': { start: 'ih', sustain: 'aa', end: 'oh', duration: 260 },

  'bai':  { start: 'oh', sustain: 'aa', end: 'ih', duration: 220 },
  'pai':  { start: 'oh', sustain: 'aa', end: 'ih', duration: 220 },
  'mai':  { start: 'oh', sustain: 'aa', end: 'ih', duration: 220 },
  'dai':  { start: 'ee', sustain: 'aa', end: 'ih', duration: 220 },
  'tai':  { start: 'ee', sustain: 'aa', end: 'ih', duration: 220 },
  'nai':  { start: 'ee', sustain: 'aa', end: 'ih', duration: 220 },
  'lai':  { start: 'ee', sustain: 'aa', end: 'ih', duration: 220 },
  'gai':  { start: 'ee', sustain: 'aa', end: 'ih', duration: 220 },
  'kai':  { start: 'ee', sustain: 'aa', end: 'ih', duration: 220 },
  'hai':  { start: 'ee', sustain: 'aa', end: 'ih', duration: 220 },

  'bei':  { start: 'oh', sustain: 'ee', end: 'ih', duration: 220 },
  'pei':  { start: 'oh', sustain: 'ee', end: 'ih', duration: 220 },
  'mei':  { start: 'oh', sustain: 'ee', end: 'ih', duration: 220 },
  'fei':  { start: 'oh', sustain: 'ee', end: 'ih', duration: 220 },
  'dei':  { start: 'ee', sustain: 'ee', end: 'ih', duration: 220 },
  'tei':  { start: 'ee', sustain: 'ee', end: 'ih', duration: 220 },
  'nei':  { start: 'ee', sustain: 'ee', end: 'ih', duration: 220 },
  'lei':  { start: 'ee', sustain: 'ee', end: 'ih', duration: 220 },
  'gei':  { start: 'ee', sustain: 'ee', end: 'ih', duration: 220 },
  'hei':  { start: 'ee', sustain: 'ee', end: 'ih', duration: 220 },

  'ban':  { start: 'oh', sustain: 'aa', end: 'ou', duration: 220 },
  'pan':  { start: 'oh', sustain: 'aa', end: 'ou', duration: 220 },
  'man':  { start: 'oh', sustain: 'aa', end: 'ou', duration: 220 },
  'fan':  { start: 'oh', sustain: 'aa', end: 'ou', duration: 220 },
  'dan':  { start: 'ee', sustain: 'aa', end: 'ou', duration: 220 },
  'tan':  { start: 'ee', sustain: 'aa', end: 'ou', duration: 220 },
  'nan':  { start: 'ee', sustain: 'aa', end: 'ou', duration: 220 },
  'lan':  { start: 'ee', sustain: 'aa', end: 'ou', duration: 220 },
  'gan':  { start: 'ee', sustain: 'aa', end: 'ou', duration: 220 },
  'kan':  { start: 'ee', sustain: 'aa', end: 'ou', duration: 220 },
  'han':  { start: 'ee', sustain: 'aa', end: 'ou', duration: 220 },

  'bang': { start: 'oh', sustain: 'aa', end: 'oh', duration: 240 },
  'pang': { start: 'oh', sustain: 'aa', end: 'oh', duration: 240 },
  'mang': { start: 'oh', sustain: 'aa', end: 'oh', duration: 240 },
  'fang': { start: 'oh', sustain: 'aa', end: 'oh', duration: 240 },
  'dang': { start: 'ee', sustain: 'aa', end: 'oh', duration: 240 },
  'tang': { start: 'ee', sustain: 'aa', end: 'oh', duration: 240 },
  'nang': { start: 'ee', sustain: 'aa', end: 'oh', duration: 240 },
  'lang': { start: 'ee', sustain: 'aa', end: 'oh', duration: 240 },
  'gang': { start: 'ee', sustain: 'aa', end: 'oh', duration: 240 },
  'kang': { start: 'ee', sustain: 'aa', end: 'oh', duration: 240 },
  'hang': { start: 'ee', sustain: 'aa', end: 'oh', duration: 240 },

  'ben':  { start: 'oh', sustain: 'ee', end: 'ou', duration: 220 },
  'pen':  { start: 'oh', sustain: 'ee', end: 'ou', duration: 220 },
  'men':  { start: 'oh', sustain: 'ee', end: 'ou', duration: 220 },
  'fen':  { start: 'oh', sustain: 'ee', end: 'ou', duration: 220 },
  'den':  { start: 'ee', sustain: 'ee', end: 'ou', duration: 220 },
  'nen':  { start: 'ee', sustain: 'ee', end: 'ou', duration: 220 },
  'gen':  { start: 'ee', sustain: 'ee', end: 'ou', duration: 220 },
  'ken':  { start: 'ee', sustain: 'ee', end: 'ou', duration: 220 },
  'hen':  { start: 'ee', sustain: 'ee', end: 'ou', duration: 220 },
  'zen':  { start: 'ih', sustain: 'ee', end: 'ou', duration: 220 },
  'cen':  { start: 'ih', sustain: 'ee', end: 'ou', duration: 220 },
  'sen':  { start: 'ih', sustain: 'ee', end: 'ou', duration: 220 },

  'beng': { start: 'oh', sustain: 'ee', end: 'oh', duration: 240 },
  'peng': { start: 'oh', sustain: 'ee', end: 'oh', duration: 240 },
  'meng': { start: 'oh', sustain: 'ee', end: 'oh', duration: 240 },
  'feng': { start: 'oh', sustain: 'ee', end: 'oh', duration: 240 },
  'deng': { start: 'ee', sustain: 'ee', end: 'oh', duration: 240 },
  'teng': { start: 'ee', sustain: 'ee', end: 'oh', duration: 240 },
  'neng': { start: 'ee', sustain: 'ee', end: 'oh', duration: 240 },
  'leng': { start: 'ee', sustain: 'ee', end: 'oh', duration: 240 },
  'geng': { start: 'ee', sustain: 'ee', end: 'oh', duration: 240 },
  'keng': { start: 'ee', sustain: 'ee', end: 'oh', duration: 240 },
  'heng': { start: 'ee', sustain: 'ee', end: 'oh', duration: 240 },

  'bin':  { start: 'oh', sustain: 'ih', end: 'ee', duration: 220 },
  'pin':  { start: 'oh', sustain: 'ih', end: 'ee', duration: 220 },
  'min':  { start: 'oh', sustain: 'ih', end: 'ee', duration: 220 },
  'lin':  { start: 'ee', sustain: 'ih', end: 'ee', duration: 220 },
  'nin':  { start: 'ee', sustain: 'ih', end: 'ee', duration: 220 },
  'jin':  { start: 'ih', sustain: 'ih', end: 'ee', duration: 220 },
  'qin':  { start: 'ih', sustain: 'ih', end: 'ee', duration: 220 },
  'xin':  { start: 'ih', sustain: 'ih', end: 'ee', duration: 220 },
  'yin':  { start: 'ih', sustain: 'ih', end: 'ee', duration: 220 },

  'bing': { start: 'oh', sustain: 'ih', end: 'oh', duration: 240 },
  'ping': { start: 'oh', sustain: 'ih', end: 'oh', duration: 240 },
  'ming': { start: 'oh', sustain: 'ih', end: 'oh', duration: 240 },
  'ding': { start: 'ee', sustain: 'ih', end: 'oh', duration: 240 },
  'ting': { start: 'ee', sustain: 'ih', end: 'oh', duration: 240 },
  'ning': { start: 'ee', sustain: 'ih', end: 'oh', duration: 240 },
  'ling': { start: 'ee', sustain: 'ih', end: 'oh', duration: 240 },
  'jing': { start: 'ih', sustain: 'ih', end: 'oh', duration: 240 },
  'qing': { start: 'ih', sustain: 'ih', end: 'oh', duration: 240 },
  'xing': { start: 'ih', sustain: 'ih', end: 'oh', duration: 240 },
  'ying': { start: 'ih', sustain: 'ih', end: 'oh', duration: 240 },

  'zhan': { start: 'ih', sustain: 'aa', end: 'ou', duration: 240 },
  'chan': { start: 'ih', sustain: 'aa', end: 'ou', duration: 240 },
  'shan': { start: 'ih', sustain: 'aa', end: 'ou', duration: 240 },
  'ran':  { start: 'ih', sustain: 'aa', end: 'ou', duration: 240 },
  'zan':  { start: 'ih', sustain: 'aa', end: 'ou', duration: 220 },
  'can':  { start: 'ih', sustain: 'aa', end: 'ou', duration: 220 },
  'san':  { start: 'ih', sustain: 'aa', end: 'ou', duration: 220 },
  'yan':  { start: 'ih', sustain: 'aa', end: 'ou', duration: 240 },
  'lian': { start: 'ee', sustain: 'aa', end: 'ou', duration: 260 },
  'jian': { start: 'ih', sustain: 'aa', end: 'ou', duration: 260 },
  'qian': { start: 'ih', sustain: 'aa', end: 'ou', duration: 260 },
  'xian': { start: 'ih', sustain: 'aa', end: 'ou', duration: 260 },

  'zhen': { start: 'ih', sustain: 'ee', end: 'ou', duration: 240 },
  'chen': { start: 'ih', sustain: 'ee', end: 'ou', duration: 240 },
  'shen': { start: 'ih', sustain: 'ee', end: 'ou', duration: 240 },
  'ren':  { start: 'ih', sustain: 'ee', end: 'ou', duration: 240 },

  'zhi':  { start: 'ih', sustain: 'ih', end: 'ih', duration: 220 },
  'chi':  { start: 'ih', sustain: 'ih', end: 'ih', duration: 220 },
  'shi':  { start: 'ih', sustain: 'ih', end: 'ih', duration: 220 },
  'ri':   { start: 'ih', sustain: 'ih', end: 'ih', duration: 220 },
  'zi':   { start: 'ih', sustain: 'ih', end: 'ih', duration: 200 },
  'ci':   { start: 'ih', sustain: 'ih', end: 'ih', duration: 200 },
  'si':   { start: 'ih', sustain: 'ih', end: 'ih', duration: 200 },

  'guo':  { start: 'ee', sustain: 'oh', end: 'oh', duration: 220 },
  'kuo':  { start: 'ee', sustain: 'oh', end: 'oh', duration: 220 },
  'huo':  { start: 'ee', sustain: 'oh', end: 'oh', duration: 220 },
  'duo':  { start: 'ee', sustain: 'oh', end: 'oh', duration: 220 },
  'tuo':  { start: 'ee', sustain: 'oh', end: 'oh', duration: 220 },
  'nuo':  { start: 'ee', sustain: 'oh', end: 'oh', duration: 220 },
  'luo':  { start: 'ee', sustain: 'oh', end: 'oh', duration: 220 },
  'ruo':  { start: 'ih', sustain: 'oh', end: 'oh', duration: 220 },
  'zuo':  { start: 'ih', sustain: 'oh', end: 'oh', duration: 220 },
  'cuo':  { start: 'ih', sustain: 'oh', end: 'oh', duration: 220 },
  'suo':  { start: 'ih', sustain: 'oh', end: 'oh', duration: 220 },

  'gui':  { start: 'ee', sustain: 'ee', end: 'ou', duration: 240 },
  'kui':  { start: 'ee', sustain: 'ee', end: 'ou', duration: 240 },
  'hui':  { start: 'ee', sustain: 'ee', end: 'ou', duration: 240 },
  'dui':  { start: 'ee', sustain: 'ee', end: 'ou', duration: 240 },
  'tui':  { start: 'ee', sustain: 'ee', end: 'ou', duration: 240 },
  'rui':  { start: 'ih', sustain: 'ee', end: 'ou', duration: 240 },
  'zui':  { start: 'ih', sustain: 'ee', end: 'ou', duration: 240 },
  'cui':  { start: 'ih', sustain: 'ee', end: 'ou', duration: 240 },
  'sui':  { start: 'ih', sustain: 'ee', end: 'ou', duration: 240 },

  'zhong': { start: 'ih', sustain: 'oh', end: 'oh', duration: 260 },
  'chong': { start: 'ih', sustain: 'oh', end: 'oh', duration: 260 },
  'shong': { start: 'ih', sustain: 'oh', end: 'oh', duration: 260 },
  'rong':  { start: 'ih', sustain: 'oh', end: 'oh', duration: 260 },
  'zong':  { start: 'ih', sustain: 'oh', end: 'oh', duration: 240 },
  'cong':  { start: 'ih', sustain: 'oh', end: 'oh', duration: 240 },
  'song':  { start: 'ih', sustain: 'oh', end: 'oh', duration: 240 },
  'dong':  { start: 'ee', sustain: 'oh', end: 'oh', duration: 240 },
  'tong':  { start: 'ee', sustain: 'oh', end: 'oh', duration: 240 },
  'nong':  { start: 'ee', sustain: 'oh', end: 'oh', duration: 240 },
  'long':  { start: 'ee', sustain: 'oh', end: 'oh', duration: 240 },
  'gong':  { start: 'ee', sustain: 'oh', end: 'oh', duration: 240 },
  'kong':  { start: 'ee', sustain: 'oh', end: 'oh', duration: 240 },
  'hong':  { start: 'ee', sustain: 'oh', end: 'oh', duration: 240 },
}

// ====== 3. 情感化视素修饰器 ======
// 不同情感下，同一音素的视素权重会有差异（如愤怒时张嘴更大，悲伤时张嘴更小）
export type EmotionType = 'neutral' | 'joy' | 'anger' | 'sadness' | 'surprise' | 'question'

export interface EmotionVisemeModifier {
  intensityMultiplier: number  // 整体强度倍率 (0.5~1.5)
  openMultiplier: number       // 开口度倍率（影响 aa/oh）
  spreadMultiplier: number     // 唇形展开倍率（影响 ee/ih）
  roundMultiplier: number      // 圆唇度倍率（影响 ou/oh）
  jitter: number               // 随机抖动幅度 (0~0.2)
}

export const EMOTION_VISEME_MODIFIERS: Record<EmotionType, EmotionVisemeModifier> = {
  neutral:  { intensityMultiplier: 1.0, openMultiplier: 1.0, spreadMultiplier: 1.0, roundMultiplier: 1.0, jitter: 0.05 },
  joy:      { intensityMultiplier: 1.15, openMultiplier: 1.1, spreadMultiplier: 1.2, roundMultiplier: 0.9, jitter: 0.08 },
  anger:    { intensityMultiplier: 1.3, openMultiplier: 1.3, spreadMultiplier: 0.85, roundMultiplier: 1.0, jitter: 0.15 },
  sadness:  { intensityMultiplier: 0.8, openMultiplier: 0.85, spreadMultiplier: 0.9, roundMultiplier: 1.05, jitter: 0.03 },
  surprise: { intensityMultiplier: 1.2, openMultiplier: 1.25, spreadMultiplier: 1.0, roundMultiplier: 1.1, jitter: 0.06 },
  question: { intensityMultiplier: 1.05, openMultiplier: 1.05, spreadMultiplier: 1.1, roundMultiplier: 1.0, jitter: 0.07 },
}

// ====== 4. 12+ 面部微表情定义 ======
// VRM 表情能力有限，通过组合现有表情权重 + 小幅度实现微表情
// 每个微表情映射到 VRM 表情权重的组合
export interface MicroExpression {
  name: string
  description: string
  // VRM 表情权重组合（值 0~1，通常 0.05~0.3 保持微妙）
  weights: Record<string, number>
  // 触发概率（0~1，每帧检测时按此概率激活）
  triggerProbability: number
  // 持续时长 (ms)
  duration: number
}

export const MICRO_EXPRESSIONS: Record<string, MicroExpression> = {
  // 1. 嘴角上扬（微笑预兆）
  mouthCornerUp: {
    name: 'mouthCornerUp',
    description: '嘴角轻微上扬',
    weights: { happy: 0.18 },
    triggerProbability: 0.08,
    duration: 400,
  },
  // 2. 嘴角下垂（不悦/悲伤暗示）
  mouthCornerDown: {
    name: 'mouthCornerDown',
    description: '嘴角轻微下垂',
    weights: { sad: 0.15 },
    triggerProbability: 0.05,
    duration: 500,
  },
  // 3. 下巴轻微移动（思考状态）
  chinSway: {
    name: 'chinSway',
    description: '下巴轻微前后移动',
    weights: { oh: 0.12 },
    triggerProbability: 0.04,
    duration: 300,
  },
  // 4. 脸颊肌肉收缩（轻度笑意）
  cheekContract: {
    name: 'cheekContract',
    description: '脸颊肌肉轻微收缩',
    weights: { happy: 0.22, relaxed: 0.1 },
    triggerProbability: 0.06,
    duration: 450,
  },
  // 5. 脸颊肌肉放松（释然）
  cheekRelax: {
    name: 'cheekRelax',
    description: '脸颊肌肉放松',
    weights: { relaxed: 0.2 },
    triggerProbability: 0.04,
    duration: 500,
  },
  // 6. 鼻翼张合（强调/呼吸感）
  nostrilFlare: {
    name: 'nostrilFlare',
    description: '鼻翼轻微张合',
    weights: { angry: 0.1, oh: 0.1 },
    triggerProbability: 0.03,
    duration: 250,
  },
  // 7. 眉部上扬（惊讶/疑问）
  browRaise: {
    name: 'browRaise',
    description: '眉毛轻微上扬',
    weights: { surprised: 0.2 },
    triggerProbability: 0.05,
    duration: 350,
  },
  // 8. 眉部皱起（专注/思考）
  browFurrow: {
    name: 'browFurrow',
    description: '眉毛轻微皱起',
    weights: { angry: 0.15 },
    triggerProbability: 0.04,
    duration: 400,
  },
  // 9. 眼神柔和（眨眼加强）
  softGaze: {
    name: 'softGaze',
    description: '眼神柔和',
    weights: { relaxed: 0.25, happy: 0.1 },
    triggerProbability: 0.05,
    duration: 600,
  },
  // 10. 嘴唇轻抿（停顿思考）
  lipPress: {
    name: 'lipPress',
    description: '嘴唇轻抿',
    weights: { ou: 0.3 },
    triggerProbability: 0.03,
    duration: 300,
  },
  // 11. 半微笑（讽刺/调皮）
  halfSmile: {
    name: 'halfSmile',
    description: '半边嘴角上扬',
    weights: { happy: 0.25, surprised: 0.08 },
    triggerProbability: 0.03,
    duration: 500,
  },
  // 12. 惊讶微张嘴（吸气反应）
  slightGasp: {
    name: 'slightGasp',
    description: '轻微张嘴吸气',
    weights: { surprised: 0.3, aa: 0.2 },
    triggerProbability: 0.02,
    duration: 200,
  },
  // 13. 下巴下垂（放松/无聊）
  jawDrop: {
    name: 'jawDrop',
    description: '下巴轻微下垂',
    weights: { relaxed: 0.15, aa: 0.1 },
    triggerProbability: 0.03,
    duration: 400,
  },
  // 14. 眯眼（怀疑/审视）
  squint: {
    name: 'squint',
    description: '轻微眯眼',
    weights: { relaxed: 0.3, angry: 0.1 },
    triggerProbability: 0.03,
    duration: 500,
  },
}

// ====== 情感 → 微表情关联映射 ======
// 不同情感下，倾向触发哪些微表情
export const EMOTION_MICRO_EXPRESSIONS: Record<EmotionType, string[]> = {
  neutral:  ['mouthCornerUp', 'softGaze', 'chinSway'],
  joy:      ['mouthCornerUp', 'cheekContract', 'halfSmile', 'softGaze'],
  anger:    ['browFurrow', 'nostrilFlare', 'lipPress', 'mouthCornerDown'],
  sadness:  ['mouthCornerDown', 'cheekRelax', 'jawDrop'],
  surprise: ['browRaise', 'slightGasp', 'cheekContract'],
  question: ['browRaise', 'chinSway', 'lipPress'],
}

// ====== 5. 贝塞尔曲线过渡配置 ======
// 用于口型插值，实现平滑的加减速过渡
export interface BezierConfig {
  // 三次贝塞尔控制点 P1, P2（P0=0, P3=1）
  p1x: number
  p1y: number
  p2x: number
  p2y: number
}

export const BEZIER_PRESETS = {
  // 线性（无过渡）
  linear: { p1x: 0, p1y: 0, p2x: 1, p2y: 1 },
  // ease-in：先慢后快（口型启动）
  easeIn: { p1x: 0.42, p1y: 0, p2x: 1, p2y: 1 },
  // ease-out：先快后慢（口型到达）
  easeOut: { p1x: 0, p1y: 0, p2x: 0.58, p2y: 1 },
  // ease-in-out：慢-快-慢（自然过渡）
  easeInOut: { p1x: 0.42, p1y: 0, p2x: 0.58, p2y: 1 },
  // 说话专用：快速到达 + 缓慢收尾（适合元音持续）
  speakSustain: { p1x: 0.25, p1y: 0.1, p2x: 0.5, p2y: 1 },
  // 收口专用：缓慢启动 + 快速结束（适合口型闭合）
  fadeOut: { p1x: 0.5, p1y: 0, p2x: 0.9, p2y: 0.3 },
} as const

/**
 * 三次贝塞尔曲线求值
 * @param t 进度 0~1
 * @param config 贝塞尔配置
 * @returns 插值后的值 0~1
 */
export function evalBezier(t: number, config: BezierConfig): number {
  // 三次贝塞尔公式: B(t) = (1-t)³P0 + 3(1-t)²tP1 + 3(1-t)t²P2 + t³P3
  // P0=0, P3=1，简化为: B(t) = 3(1-t)²t·P1y + 3(1-t)t²·P2y + t³
  const u = 1 - t
  const tt = t * t
  const uu = u * u
  const uuu = uu * u
  const ttt = tt * t
  return 3 * uu * t * config.p1y + 3 * u * tt * config.p2y + ttt
}

/**
 * 根据时间增量计算贝塞尔插值后的 delta（替代 lerp 的 delta * speed）
 * 使用 easeInOut 实现自然的加减速
 * @param progress 当前进度 0~1
 * @param config 贝塞尔配置
 * @returns 平滑后的进度 0~1
 */
export function smoothProgress(progress: number, config: BezierConfig = BEZIER_PRESETS.easeInOut): number {
  return evalBezier(Math.max(0, Math.min(1, progress)), config)
}

// ====== 6. 动作优先级系统 ======
// 协调口型、表情、头部动作的并发执行
export type AnimationChannel = 'viseme' | 'emotion' | 'microExpression' | 'head' | 'blink'

export interface AnimationPriority {
  channel: AnimationChannel
  priority: number  // 数值越大优先级越高
  canOverride: boolean  // 是否可被高优先级覆盖
}

export const ANIMATION_PRIORITIES: Record<AnimationChannel, AnimationPriority> = {
  viseme:         { channel: 'viseme', priority: 90, canOverride: false },  // 口型最高优先级
  emotion:        { channel: 'emotion', priority: 70, canOverride: false },  // 表情次高
  microExpression: { channel: 'microExpression', priority: 50, canOverride: true },  // 微表情可覆盖
  head:           { channel: 'head', priority: 40, canOverride: true },  // 头部动作
  blink:          { channel: 'blink', priority: 30, canOverride: false },  // 眨眼独立
}

// ====== 7. 预测式视素缓冲配置 ======
export const PREDICTION_CONFIG = {
  // 预测窗口：提前 50~100ms 预计算后续音节的视素目标
  lookaheadMs: 80,
  // 预测缓冲区大小（预计算的音节数）
  bufferSize: 3,
  // 预测插值启用阈值（当前视素与预测视素差异 > 此值时启用预插值）
  predictionThreshold: 0.15,
}

// ====== 8. 辅助查询函数 ======

/**
 * 从拼音获取视素映射（带次视素）
 * @param pinyin 拼音字符串（如 "ni", "hao", "zhong"）
 * @returns 视素映射或 null
 */
export function getPhonemeViseme(pinyin: string): PhonemeMap | null {
  if (!pinyin) return null
  const lower = pinyin.toLowerCase()
  // 先完整匹配（如 "zhong"）
  if (PHONEME_TO_VISEME[lower]) return PHONEME_TO_VISEME[lower]
  // 尝试匹配声母 + 韵母
  // 去掉首字母尝试匹配声母
  const shengmu = lower.match(/^(zh|ch|sh|[bpmfdtnlgkhjqxrzcsyw])/)?.[0]
  const yunmu = shengmu ? lower.slice(shengmu.length) : lower
  if (shengmu && yunmu && PHONEME_TO_VISEME[yunmu]) {
    return PHONEME_TO_VISEME[yunmu]
  }
  if (shengmu && PHONEME_TO_VISEME[shengmu]) {
    return PHONEME_TO_VISEME[shengmu]
  }
  if (yunmu && PHONEME_TO_VISEME[yunmu]) {
    return PHONEME_TO_VISEME[yunmu]
  }
  return null
}

/**
 * 从音节获取视素时序序列
 * @param syllable 音节（如 "ni", "hao"）
 * @returns 视素时序或 null
 */
export function getSyllableVisemes(syllable: string): SyllableViseme | null {
  if (!syllable) return null
  const lower = syllable.toLowerCase()
  return SYLLABLE_TO_VISEMES[lower] || null
}

/**
 * 根据情感获取视素修饰器
 * @param emotion 情感类型
 * @returns 修饰器（默认返回 neutral）
 */
export function getEmotionModifier(emotion: string): EmotionVisemeModifier {
  const map: Record<string, EmotionType> = {
    neutral: 'neutral', joy: 'joy', joyous: 'joy', happy: 'joy',
    anger: 'anger', angry: 'anger',
    sadness: 'sadness', sad: 'sadness',
    surprise: 'surprise', surprised: 'surprise',
    question: 'question',
  }
  const type = map[emotion?.toLowerCase()] || 'neutral'
  return EMOTION_VISEME_MODIFIERS[type]
}

/**
 * 根据情感获取可能触发的微表情列表
 * @param emotion 情感类型
 * @returns 微表情名称数组
 */
export function getEmotionMicroExpressions(emotion: string): string[] {
  const map: Record<string, EmotionType> = {
    neutral: 'neutral', joy: 'joy', joyous: 'joy', happy: 'joy',
    anger: 'anger', angry: 'anger',
    sadness: 'sadness', sad: 'sadness',
    surprise: 'surprise', surprised: 'surprise',
    question: 'question',
  }
  const type = map[emotion?.toLowerCase()] || 'neutral'
  return EMOTION_MICRO_EXPRESSIONS[type]
}
