# AI大模型与AR功能深度集成技术文档

> 版本：1.0.0  
> 日期：2026-07-14  
> 项目：灵山胜境AI数字人景区导览系统

---

## 目录

1. [系统架构设计](#1-系统架构设计)
2. [模块交互流程](#2-模块交互流程)
3. [关键技术实现方案](#3-关键技术实现方案)
4. [API调用完整流程和参数说明](#4-api调用完整流程和参数说明)
5. [安全措施实施细节](#5-安全措施实施细节)
6. [部署指南](#6-部署指南)
7. [使用操作说明](#7-使用操作说明)
8. [常见问题排查](#8-常见问题排查)

---

## 1. 系统架构设计

### 1.1 整体架构图

```
┌─────────────────────────────────────────────────────────────────────┐
│                         前端（UniApp H5）                            │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────────┐  │
│  │  AR摄像头层   │  │  AR叠加渲染层  │  │   AI增强交互层            │  │
│  │ ARCamera     │  │ AROverlay    │  │ ┌──────────────────────┐ │  │
│  │ Composer      │  │ Renderer     │  │ │ ARSmartRecognizer    │ │  │
│  │              │  │              │  │ │ (智能物体识别)        │ │  │
│  │ - getUserMedia│  │ - 卡片渲染    │  │ ├──────────────────────┤ │  │
│  │ - 截帧压缩    │  │ - 手势交互    │  │ │ ARSceneGenerator     │ │  │
│  │ - 亮度采样    │  │ - 光照匹配    │  │ │ (场景内容生成)        │ │  │
│  │              │  │              │  │ ├──────────────────────┤ │  │
│  └──────┬───────┘  └──────────────┘  │ │ ARIntentPredictor    │ │  │
│         │                            │ │ (用户意图预测)        │ │  │
│         │  captureFrame()            │ └──────────┬───────────┘ │  │
│         └────────────────────────────┴────────────┘             │  │
└──────────────────────────────────────────────┬──────────────────────┘
                                               │ fetch (HTTP)
                    ┌──────────────────────────┼──────────────────┐
                    │                          │                  │
                    ▼                          ▼                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    后端（Python http.server）                         │
│                                                                     │
│  ┌─────────────┐  ┌─────────────────┐  ┌─────────────────────────┐ │
│  │ 访问口令验证  │  │  限流+异常检测    │  │  审计日志（脱敏）        │ │
│  │ Cookie校验   │  │  30次/60秒       │  │  内存保留1000条         │ │
│  └──────┬──────┘  └────────┬────────┘  └───────────┬─────────────┘ │
│         │                  │                       │               │
│         ▼                  ▼                       ▼               │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │              AI增强AR API路由层                                │  │
│  │  /api/ar/ai/smart-recognize   →  智能物体识别                 │  │
│  │  /api/ar/ai/scene-understand  →  场景理解与内容生成           │  │
│  │  /api/ar/ai/intent-predict    →  用户意图预测                 │  │
│  │  /api/ar/ai/audit-log         →  审计日志查询（仅管理员）      │  │
│  └──────────────────────────┬───────────────────────────────────┘  │
│                             │                                       │
│                             ▼                                       │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │            密钥安全管理层                                      │  │
│  │  _load_dashscope_key():                                       │  │
│  │    1. 环境变量 DASHSCOPE_API_KEY（优先）                      │  │
│  │    2. CSV文件运行时读取（备用）                                │  │
│  │    3. 内存缓存（最小化暴露）                                   │  │
│  └──────────────────────────┬───────────────────────────────────┘  │
│                             │                                       │
│                             ▼                                       │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │            _call_dashscope() 大模型调用层                     │  │
│  │  urllib.request → 阿里云百炼 OpenAI兼容接口                   │  │
│  │  Authorization: Bearer {api_key}                              │  │
│  └──────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│              阿里云百炼大模型平台                                     │
│                                                                     │
│  ┌────────────────┐  ┌────────────────┐  ┌────────────────────┐   │
│  │ qwen-vl-max    │  │ qwen-plus      │  │  workspace管理     │   │
│  │ (视觉理解模型)  │  │ (文本模型)      │  │  (API Key管理)     │   │
│  │                │  │                │  │                    │   │
│  │ - 图像识别     │  │ - 文本生成      │  │  - 密钥轮换        │   │
│  │ - 场景分析     │  │ - 意图预测      │  │  - 用量监控        │   │
│  │ - 多模态输入   │  │ - JSON结构输出  │  │  - 权限控制        │   │
│  └────────────────┘  └────────────────┘  └────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
```

### 1.2 核心模块说明

| 层级 | 模块 | 文件 | 职责 |
|------|------|------|------|
| 前端-AR采集 | ARCameraComposer | `src/ar/ARCameraComposer.ts` | 摄像头流采集、帧压缩、亮度采样 |
| 前端-AI智能识别 | ARSmartRecognizer | `src/ar/ARSmartRecognizer.ts` | 发送画面到AI视觉模型，接收物体识别结果 |
| 前端-AI场景生成 | ARSceneGenerator | `src/ar/ARSceneGenerator.ts` | 基于场景语义生成AR虚拟内容 |
| 前端-AI意图预测 | ARIntentPredictor | `src/ar/ARIntentPredictor.ts` | 收集行为历史，预测用户意图并推荐交互 |
| 前端-AR主页面 | ar.vue | `src/pages/visitor/ar.vue` | 协调所有AR和AI模块，渲染UI |
| 后端-密钥管理 | _load_dashscope_key() | `server.py` L61-85 | 安全加载API密钥（环境变量优先） |
| 后端-审计日志 | _log_ai_audit() | `server.py` L110-125 | 记录脱敏审计日志，异常检测 |
| 后端-限流控制 | _is_rate_limited() | `server.py` L145-153 | 30次/60秒限流窗口 |
| 后端-API端点 | handle_ar_*() | `server.py` L3262-3465 | 4个RESTful API处理器 |
| 后端-大模型调用 | _call_dashscope() | `server.py` L3235-3260 | 调用阿里云百炼OpenAI兼容接口 |

### 1.3 技术审计：AI集成点识别

基于对现有AR功能体系的技术审计，识别出以下关键AI集成点：

| 集成点 | 现状痛点 | AI价值提升 | 技术可行性 |
|--------|---------|-----------|-----------|
| AR画面物体识别 | 仅能匹配预存参考图，无法识别新物体 | AI视觉模型可识别任意物体，提供分类、属性、文化知识 | ★★★★★ qwen-vl-max支持多模态输入 |
| 场景内容生成 | 解说文案固定，无法个性化 | AI基于场景语义动态生成解说、路线、互动建议 | ★★★★★ 文本模型+视觉模型组合 |
| 用户意图预测 | 无个性化推荐，用户需主动操作 | AI分析行为历史预测意图，主动推荐交互 | ★★★★☆ 需收集足够行为数据 |
| AR问答增强 | 现有ARQaBridge已有问答能力 | 与意图预测联动，提供更精准回答 | ★★★★★ 复用现有问答基础设施 |
| 安全与审计 | 无AI调用审计 | 全链路审计+限流+异常检测 | ★★★★★ 后端统一管控 |

---

## 2. 模块交互流程

### 2.1 智能物体识别流程

```
用户点击"智能识别"按钮
        │
        ▼
┌─────────────────┐
│ ar.vue          │
│ triggerSmartRecognize()
│                 │
│ 1.检查当前景点   │
│ 2.截取摄像头帧   │ ← ARCameraComposer.captureFrame()
│ 3.去除data:前缀  │
│ 4.设置loading状态│
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ ARSmartRecognizer│
│ recognize()     │
│                 │
│ POST /api/ar/ai/smart-recognize
│ body: {         │
│   image_base64, │
│   spot_id       │
│ }               │
└────────┬────────┘
         │
         ▼
┌─────────────────────────────────┐
│ 后端 handle_ar_smart_recognize()│
│                                 │
│ 1. _get_caller_id() 获取调用者  │
│ 2. _is_rate_limited() 限流检查  │
│ 3. _read_json_body() 读取请求   │
│ 4. 构造视觉理解提示词            │
│ 5. _call_dashscope(             │
│      model='qwen-vl-max')       │
│ 6. _log_ai_audit() 记录审计     │
│ 7. 返回JSON结果                 │
└────────┬────────────────────────┘
         │
         ▼
┌─────────────────────────────────┐
│ 阿里云百炼 qwen-vl-max          │
│                                 │
│ 输入：图片base64 + 文本提示      │
│ 输出：{                          │
│   objects: [...],               │
│   scene_summary: "...",         │
│   recommended_actions: [...]    │
│ }                               │
└────────┬────────────────────────┘
         │
         ▼
┌─────────────────┐
│ ar.vue          │
│                 │
│ smartRecognizeResult.value = result
│ aiEnhancePanel = 'smart'
│                 │
│ 渲染：           │
│ - 场景描述       │
│ - 物体列表       │
│ - 推荐动作标签   │
└─────────────────┘
```

### 2.2 场景理解与内容生成流程

```
用户点击"场景生成"按钮
        │
        ▼
┌─────────────────────┐
│ ar.vue              │
│ triggerSceneUnderstand()
│                     │
│ 1.获取当前景点信息   │
│ 2.截取画面（可选）   │
│ 3.设置loading状态   │
└────────┬────────────┘
         │
         ▼
┌─────────────────────┐
│ ARSceneGenerator    │
│ generate()          │
│                     │
│ POST /api/ar/ai/scene-understand
│ body: {             │
│   scene_description,│
│   spot_id,          │
│   user_preference,  │
│   image_base64      │
│ }                   │
└────────┬────────────┘
         │
         ▼
┌──────────────────────────────────┐
│ 后端 handle_ar_scene_understand()│
│                                  │
│ 1.限流检查                        │
│ 2.根据是否有图片选择模型：         │
│   - 有图片 → qwen-vl-max         │
│   - 无图片 → qwen-plus           │
│ 3.构造场景理解提示词              │
│ 4._call_dashscope()              │
│ 5.审计日志记录                    │
└────────┬─────────────────────────┘
         │
         ▼
┌─────────────────────┐
│ ar.vue              │
│                     │
│ sceneContent.value = result
│ aiEnhancePanel = 'scene'
│                     │
│ 渲染：               │
│ - 解说文案           │
│ - 文化背景           │
│ - 推荐路线           │
│ - 互动建议标签       │
└─────────────────────┘
```

### 2.3 用户意图预测流程

```
用户在AR页面操作（浏览景点/提问/导航）
        │
        ├──→ handleRecognition() ──→ recordBehavior('view', spotId)
        ├──→ sendQuestion() ──────→ recordBehavior('ask', spotId, question)
        │
        │   （行为历史保留最近50条）
        │
        ▼
用户点击"意图预测"按钮
        │
        ▼
┌─────────────────────┐
│ ar.vue              │
│ triggerIntentPredict()│
└────────┬────────────┘
         │
         ▼
┌─────────────────────┐
│ ARIntentPredictor   │
│ predict()           │
│                     │
│ 自动收集：           │
│ - behaviorHistory   │ (最近20条)
│ - currentSpot       │
│ - sessionDuration   │
│                     │
│ POST /api/ar/ai/intent-predict
└────────┬────────────┘
         │
         ▼
┌──────────────────────────────────┐
│ 后端 handle_ar_intent_predict()  │
│                                  │
│ 1.限流检查                        │
│ 2.构造意图预测提示词              │
│ 3._call_dashscope(               │
│      model='qwen-plus')          │
│ 4.审计日志记录                    │
└────────┬─────────────────────────┘
         │
         ▼
┌─────────────────────┐
│ ar.vue              │
│                     │
│ intentPrediction.value = result
│ aiEnhancePanel = 'intent'
│                     │
│ 渲染：               │
│ - 预测意图+置信度    │
│ - 个性化提示         │
│ - 建议列表（可点击） │
│ - 推荐下一景点       │
│                     │
│ 点击建议 →           │
│ executeSuggestion()  │
│ - guide → 导航到chat│
│ - navigate → 导航   │
│ - qa → 聚焦输入框   │
└─────────────────────┘
```

---

## 3. 关键技术实现方案

### 3.1 安全密钥管理机制

**实现位置**：`server.py` L49-85

**设计原则**：
- 密钥永不硬编码在源代码中
- 密钥永不记录在日志中
- 密钥文件永不纳入版本控制
- 内存中最小化暴露

**加载优先级**：

```
1. 环境变量 DASHSCOPE_API_KEY     ← 最高优先级（生产环境推荐）
        │ (未设置)
        ▼
2. CSV文件运行时读取                ← 备用方案（开发环境）
   路径：../AI_api_key/默认业务空间-apiKey-5819521.csv
        │ (读取失败)
        ▼
3. 返回空字符串                     ← 安全失败，拒绝AI调用
```

**关键代码逻辑**：

```python
_DASHSCOPE_KEY_CACHE = None  # 内存缓存（仅首次读取后缓存）

def _load_dashscope_key():
    global _DASHSCOPE_KEY_CACHE
    if _DASHSCOPE_KEY_CACHE:          # 命中缓存直接返回
        return _DASHSCOPE_KEY_CACHE
    key = os.environ.get('DASHSCOPE_API_KEY', '').strip()  # 环境变量优先
    if key:
        _DASHSCOPE_KEY_CACHE = key
        return key
    # CSV文件备用读取（utf-8-sig处理BOM）
    try:
        with open(_DASHSCOPE_CSV_PATH, 'r', encoding='utf-8-sig') as f:
            reader = csv.reader(f)
            for row in reader:
                if len(row) >= 2 and row[0] == 'apiKey':
                    _DASHSCOPE_KEY_CACHE = row[1].strip()
                    return _DASHSCOPE_KEY_CACHE
    except Exception:
        pass  # 静默失败，不暴露文件路径
    return ''
```

### 3.2 审计日志与脱敏机制

**实现位置**：`server.py` L88-153

**审计日志结构**：

```json
{
  "timestamp": "2026-07-14T10:30:00.123456",
  "endpoint": "/api/ar/ai/smart-recognize",
  "caller": "admin",
  "params": {
    "spot_id": "梵宫",
    "image_base64": "[REDACTED:len=102400]"  ← 脱敏处理
  },
  "success": true,
  "duration_ms": 2345.6,
  "error": null
}
```

**脱敏规则**（`_desensitize_params()`）：

| 字段名 | 脱敏方式 |
|--------|---------|
| image_base64 / image | `[REDACTED:len=N]` |
| api_key / token | `[REDACTED:len=N]` |
| 长文本(>200字符) | 前100字符 + `...[truncated]` |
| 其他字段 | 原样保留 |

**异常检测机制**（`_check_anomaly()`）：

- 滑动窗口：60秒
- 阈值：30次调用
- 触发条件：单caller+endpoint组合在60秒内调用超过30次
- 告警方式：控制台输出 `[安全告警] 高频调用检测`

### 3.3 限流控制

**实现位置**：`server.py` L145-153

```python
_RATE_LIMIT_WINDOW = 60      # 限流窗口（秒）
_RATE_LIMIT_MAX_CALLS = 30   # 每窗口最大调用次数

def _is_rate_limited(caller, endpoint):
    """检查是否触发限流"""
    now = time.time()
    key = f'{caller}:{endpoint}'
    if key not in _AI_CALL_COUNTER:
        return False
    recent = [t for t in _AI_CALL_COUNTER[key] if now - t < _RATE_LIMIT_WINDOW]
    _AI_CALL_COUNTER[key] = recent
    return len(recent) >= _RATE_LIMIT_MAX_CALLS
```

触发限流时返回 HTTP 429：

```json
{"error": "调用过于频繁，请稍后再试"}
```

### 3.4 大模型调用层

**实现位置**：`server.py` L3235-3260

**调用格式**：阿里云百炼 OpenAI 兼容接口

```python
def _call_dashscope(self, messages, model='qwen-plus', temperature=0.5, timeout=30):
    api_key = _load_dashscope_key()
    if not api_key:
        raise Exception('AI大模型密钥未配置')
    payload = {
        'model': model,
        'messages': messages,
        'stream': False,
        'temperature': temperature
    }
    req = urllib.request.Request(
        DASHSCOPE_API_URL,
        data=json.dumps(payload).encode('utf-8'),
        headers={
            'Content-Type': 'application/json',
            'Authorization': f'Bearer {api_key}'  # 密钥仅在此处使用
        }
    )
    resp = urllib.request.urlopen(req, timeout=timeout)
    return json.loads(resp.read())['choices'][0]['message']['content']
```

**模型选择策略**：

| 场景 | 模型 | temperature | 超时 | 说明 |
|------|------|------------|------|------|
| 智能物体识别 | qwen-vl-max | 0.2 | 30s | 视觉模型，低温度保证准确性 |
| 场景理解(有图) | qwen-vl-max | 0.6 | 30s | 视觉模型，中温度保证创造性 |
| 场景理解(无图) | qwen-plus | 0.6 | 30s | 文本模型，省成本 |
| 意图预测 | qwen-plus | 0.4 | 20s | 文本模型，低温度保证稳定 |

### 3.5 前端资源管理

所有AI增强模块通过 `ARExitManager` 统一管理资源生命周期：

```typescript
// 构造时注册资源句柄
const handle: ResourceHandle = {
  type: 'request',
  id: this.handleId,
  dispose: () => this.stop()  // 退出时自动中断请求
}
this.exitManager.register(handle)

// 页面卸载时统一销毁
onUnmounted(() => {
  smartRecognizer?.destroy()
  sceneGenerator?.destroy()
  intentPredictor?.destroy()
})
```

---

## 4. API调用完整流程和参数说明

### 4.1 智能物体识别 API

**端点**：`POST /api/ar/ai/smart-recognize`

**请求参数**：

```json
{
  "image_base64": "<JPEG base64字符串，不含data:image前缀>",
  "spot_id": "梵宫"  // 可选，提供景点上下文
}
```

**请求头**：
```
Content-Type: application/json
Cookie: lingshan_auth=<访问口令cookie>
```

**成功响应**（HTTP 200）：

```json
{
  "success": true,
  "result": {
    "objects": [
      {
        "name": "梵宫圣坛",
        "type": "建筑",
        "description": "华丽的佛教建筑，金色穹顶",
        "attributes": {
          "材质": "楠木",
          "风格": "唐代",
          "高度": "23米"
        },
        "knowledge": "梵宫是灵山胜境的核心建筑..."
      }
    ],
    "scene_summary": "画面展示灵山梵宫入口...",
    "recommended_actions": ["了解更多历史", "查看内部结构", "收听语音讲解"]
  },
  "raw": "<AI原始输出>",
  "duration_ms": 2345.6
}
```

**错误响应**：

| HTTP状态码 | 场景 | 响应体 |
|-----------|------|--------|
| 400 | 缺少image_base64 | `{"error": "缺少 image_base64"}` |
| 429 | 触发限流 | `{"error": "调用过于频繁，请稍后再试"}` |
| 500 | AI调用失败 | `{"error": "智能识别失败: <错误详情>"}` |

### 4.2 场景理解与内容生成 API

**端点**：`POST /api/ar/ai/scene-understand`

**请求参数**：

```json
{
  "scene_description": "灵山梵宫前广场，阳光明媚",  // 场景描述文本
  "spot_id": "梵宫",                                // 当前景点
  "user_preference": "历史文化",                      // 用户偏好
  "image_base64": "<可选，提供时使用视觉模型>"         // 可选图片
}
```

**成功响应**：

```json
{
  "success": true,
  "result": {
    "narration": "您现在看到的是灵山梵宫...",
    "highlight_points": [
      {
        "name": "穹顶壁画",
        "x": 400,
        "y": 200,
        "content": "展示佛教故事的大型壁画"
      }
    ],
    "recommended_route": "建议从正门进入，依次参观...",
    "interaction_suggestions": ["点击穹顶查看详情", "收听壁画讲解"],
    "cultural_context": "梵宫融合了汉传佛教建筑精髓..."
  },
  "duration_ms": 1890.3
}
```

### 4.3 用户意图预测 API

**端点**：`POST /api/ar/ai/intent-predict`

**请求参数**：

```json
{
  "behavior_history": [
    {"action": "view", "spotId": "梵宫", "timestamp": 1720934400000},
    {"action": "ask", "spotId": "梵宫", "detail": "梵宫的历史", "timestamp": 1720934500000}
  ],
  "current_spot": "梵宫",
  "session_duration": 600
}
```

**成功响应**：

```json
{
  "success": true,
  "result": {
    "predicted_intent": "想了解历史文化",
    "confidence": 0.85,
    "suggestions": [
      {
        "type": "guide",
        "title": "收听梵宫历史讲解",
        "action": "进入AI导览",
        "priority": 3
      },
      {
        "type": "navigate",
        "title": "前往五印坛城",
        "action": "查看路线",
        "priority": 2
      }
    ],
    "next_spot": "五印坛城",
    "personalized_tip": "您对历史感兴趣，推荐参观五印坛城了解更多佛教文化"
  },
  "duration_ms": 1234.5
}
```

### 4.4 审计日志查询 API

**端点**：`GET /api/ar/ai/audit-log`

**权限**：仅管理员（需admin cookie）

**成功响应**：

```json
{
  "logs": [
    {
      "timestamp": "2026-07-14T10:30:00",
      "endpoint": "/api/ar/ai/smart-recognize",
      "caller": "admin",
      "params": {"spot_id": "梵宫", "image_base64": "[REDACTED:len=102400]"},
      "success": true,
      "duration_ms": 2345.6,
      "error": null
    }
  ],
  "summary": {
    "total": 156,
    "showing": 100,
    "success_rate": 0.95,
    "avg_duration_ms": 1890.3,
    "endpoint_stats": {
      "/api/ar/ai/smart-recognize": {"count": 50, "success": 48, "avg_ms": 2100.5},
      "/api/ar/ai/scene-understand": {"count": 30, "success": 29, "avg_ms": 1800.2},
      "/api/ar/ai/intent-predict": {"count": 20, "success": 20, "avg_ms": 1200.1}
    }
  }
}
```

---

## 5. 安全措施实施细节

### 5.1 密钥安全管理合规性

| 安全要求 | 实施状态 | 实现方式 |
|---------|---------|---------|
| 严禁硬编码密钥 | ✅ 已实施 | 密钥从环境变量/CSV文件动态读取 |
| 严禁日志记录密钥 | ✅ 已实施 | `_desensitize_params()`脱敏处理 |
| 严禁版本控制提交 | ✅ 已实施 | CSV文件在项目根目录外，建议添加.gitignore |
| 内存最小化暴露 | ✅ 已实施 | `_DASHSCOPE_KEY_CACHE`单次缓存，不扩散 |
| 定期自动轮换 | ✅ 支持 | 环境变量方式支持轮换，CSV文件可替换 |

### 5.2 传输安全

**前端→后端**：
- 同源请求，通过Vite代理（开发）或Nginx反代（生产）
- 生产环境建议配置TLS 1.3证书

**后端→阿里云**：
- 使用HTTPS（`https://ws-uxheyoncoi6k2bsd.cn-beijing.maass.aliyuncs.com`）
- `urllib.request.urlopen`默认验证SSL证书

### 5.3 权限控制

| 接口 | 权限要求 |
|------|---------|
| /api/ar/ai/smart-recognize | 访问口令Cookie（lingshan_auth） |
| /api/ar/ai/scene-understand | 访问口令Cookie |
| /api/ar/ai/intent-predict | 访问口令Cookie |
| /api/ar/ai/audit-log | 管理员权限（admin/admin123） |

### 5.4 审计与异常检测

- **日志保留**：内存保留最近1000条，超出自动淘汰
- **脱敏处理**：image_base64/api_key/token字段自动脱敏
- **高频检测**：60秒内单用户调用超过30次触发告警
- **统计摘要**：成功率、平均耗时、端点分组统计

---

## 6. 部署指南

### 6.1 环境要求

- Node.js ≥ 18（推荐22 LTS）
- Python 3.8+（仅使用标准库）
- 阿里云百炼大模型API密钥

### 6.2 密钥配置

**方式一：环境变量（推荐生产环境）**

```bash
# Windows PowerShell
$env:DASHSCOPE_API_KEY = "sk-your-api-key-here"

# Linux/Mac
export DASHSCOPE_API_KEY="sk-your-api-key-here"
```

**方式二：CSV文件（开发环境）**

确保以下文件存在：
```
d:\2026比赛\26软件杯相关\software_5.0_new\AI_api_key\默认业务空间-apiKey-5819521.csv
```

文件格式：
```csv
apiKey,sk-your-api-key-here
apiHost,ws-xxx.maas.aliyuncs.com
openAiCompatible,https://ws-xxx/compatible-mode/v1
workspaceId,ws-xxx
```

### 6.3 前端构建

```bash
cd d:\2026比赛\26软件杯相关\software_5.0_new\software
npm install
npm run build:h5
```

构建产物输出到 `dist/build/h5/`。

### 6.4 启动服务

```bash
cd d:\2026比赛\26软件杯相关\software_5.0_new\software
python server.py
```

服务启动后监听 `http://localhost:8080`。

### 6.5 开发模式（可选）

```bash
# 终端1：启动后端服务
python server.py

# 终端2：启动Vite开发服务器（热重载）
npm run dev:h5
```

开发服务器监听 `http://localhost:5173`，自动代理 `/api` 到8080。

### 6.6 .gitignore 配置

确保以下条目在 `.gitignore` 中：

```
AI_api_key/
*.csv
.env
node_modules/
dist/
```

---

## 7. 使用操作说明

### 7.1 访问AR页面

1. 打开浏览器访问 `http://localhost:8080`
2. 输入访问口令 `lingshan2026`
3. 导航到 AR实景识别 页面

### 7.2 使用智能物体识别

1. 点击"开启AR"按钮，授权摄像头
2. 将摄像头对准景点物体
3. 点击底部 📸 按钮进行基础识别
4. 识别成功后，点击"智能识别"按钮（🔍）
5. 等待AI分析，查看识别结果：
   - 场景描述
   - 物体列表（名称、类型、描述、属性、知识）
   - 推荐动作

### 7.3 使用场景内容生成

1. 在已识别景点的状态下
2. 点击"场景生成"按钮（🎨）
3. AI将基于当前场景生成：
   - 解说文案
   - 文化背景
   - 推荐路线
   - 互动建议

### 7.4 使用意图预测

1. 在AR页面浏览景点、提问（系统自动记录行为）
2. 点击"意图预测"按钮（🧠）
3. AI分析行为历史后返回：
   - 预测意图（如"想了解历史"）
   - 置信度
   - 个性化提示
   - 建议列表（可点击执行）
   - 推荐下一景点

### 7.5 管理员查看审计日志

1. 使用管理员账号登录（admin/admin123）
2. 访问 `GET /api/ar/ai/audit-log`
3. 查看最近100条AI调用日志和统计摘要

---

## 8. 常见问题排查

### Q1: AI功能返回"AI大模型密钥未配置"

**原因**：环境变量和CSV文件均未配置API密钥

**解决方案**：
1. 检查环境变量：`echo $DASHSCOPE_API_KEY`（Linux）或 `echo %DASHSCOPE_API_KEY%`（Windows）
2. 检查CSV文件是否存在且格式正确
3. 确认CSV文件路径为 `../AI_api_key/默认业务空间-apiKey-5819521.csv`（相对于server.py）

### Q2: AI调用返回429"调用过于频繁"

**原因**：60秒内调用超过30次触发限流

**解决方案**：
1. 等待60秒后重试
2. 减少自动调用频率
3. 管理员可通过 `/api/ar/ai/audit-log` 查看调用频次

### Q3: 智能识别返回结果为空

**原因**：AI模型未返回有效JSON或识别失败

**解决方案**：
1. 检查图片是否清晰，光线是否充足
2. 查看响应中的 `raw` 字段获取AI原始输出
3. 检查网络连接是否正常
4. 查看后端控制台是否有异常日志

### Q4: 摄像头无法启动

**原因**：浏览器未授权摄像头权限或使用了HTTP非localhost

**解决方案**：
1. 确保使用 `https://` 或 `http://localhost`
2. 检查浏览器摄像头权限设置
3. 确认没有其他应用占用摄像头

### Q5: 意图预测结果不准确

**原因**：行为历史数据不足

**解决方案**：
1. 在AR页面多进行一些操作（浏览景点、提问）
2. 系统需要至少5条行为记录才能提供较准确的预测
3. 行为历史最多保留50条，最近20条用于预测

### Q6: 构建失败提示SCSS警告

**原因**：已知的SCSS deprecation警告，不影响功能

**解决方案**：
- 忽略警告，构建产物正常
- 如需消除，升级sass版本并迁移@import语法

### Q7: 审计日志接口返回403

**原因**：非管理员账号访问

**解决方案**：
1. 使用 admin/admin123 登录
2. 确保cookie中包含有效的管理员会话

### Q8: AI响应时间过长

**原因**：大模型推理耗时或网络延迟

**解决方案**：
1. 智能识别超时设置为30秒，请耐心等待
2. 检查网络连接
3. 避免在高峰期大量调用
4. 可通过性能监控面板查看识别延迟

---

## 附录A：文件清单

| 文件 | 类型 | 说明 |
|------|------|------|
| `software/server.py` | 修改 | 后端服务器，新增密钥管理+审计+4个API端点 |
| `software/src/ar/types.ts` | 修改 | 新增5个AI增强类型定义 |
| `software/src/ar/ARSmartRecognizer.ts` | 新建 | 智能物体识别前端模块 |
| `software/src/ar/ARSceneGenerator.ts` | 新建 | 场景内容生成前端模块 |
| `software/src/ar/ARIntentPredictor.ts` | 新建 | 用户意图预测前端模块 |
| `software/src/pages/visitor/ar.vue` | 修改 | AR主页面，集成AI增强功能 |
| `AI_api_key/默认业务空间-apiKey-5819521.csv` | 密钥文件 | API密钥来源（不纳入版本控制） |

## 附录B：模型参数对照表

| 参数 | 智能识别 | 场景理解(有图) | 场景理解(无图) | 意图预测 |
|------|---------|---------------|---------------|---------|
| 模型 | qwen-vl-max | qwen-vl-max | qwen-plus | qwen-plus |
| temperature | 0.2 | 0.6 | 0.6 | 0.4 |
| timeout | 30s | 30s | 30s | 20s |
| 输入类型 | 图片+文本 | 图片+文本 | 纯文本 | 纯文本 |
| 输出格式 | JSON | JSON | JSON | JSON |
