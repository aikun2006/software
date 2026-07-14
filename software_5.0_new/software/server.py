"""灵山导览本地服务器 —— 静态文件 + Edge TTS + 双模型AI代理
文本对话 → 智谱 GLM-4-Flash | 多模态 → 智谱 GLM-4V-Flash
+ 访问口令（Cookie 会话）：公网网址下未登录者无法调用收费 AI 接口
+ 游客用户体系（注册/登录/景点评价）"""
import http.server
import socketserver
import json
import asyncio
import edge_tts
import urllib.request
import urllib.error
import os
import sys
import threading
import time
import secrets
import sqlite3
import hashlib
import re
import datetime
import mimetypes
from http.cookies import SimpleCookie

# 注册 VRM/glTF MIME 类型，确保静态文件服务正确返回 Content-Type
mimetypes.add_type('model/gltf-binary', '.vrm')
mimetypes.add_type('model/gltf-binary', '.glb')
mimetypes.add_type('model/gltf+json', '.gltf')

try:
    # Windows 控制台默认 GBK 编码，遇到非常规字节（如 TLS 握手/扫描器乱码）的日志会抛
    # UnicodeEncodeError 并打崩请求线程。改用 utf-8 + replace，永不抛错。
    sys.stdout.reconfigure(line_buffering=True, encoding='utf-8', errors='replace')
    sys.stderr.reconfigure(encoding='utf-8', errors='replace')
except Exception:
    pass

PORT = 8080
STATIC_DIR = os.path.join(os.path.dirname(__file__), 'dist', 'build', 'h5')

# 硅基流动 — 文本对话
SILICONFLOW_URL = 'https://api.siliconflow.cn/v1/chat/completions'
SILICONFLOW_KEY = 'sk-xhzhynikpmwxpkfmwfndjvakhayakoqifbpmhjvjzcwgvwfj'

# 智谱AI — 多模态（图片理解）
ZHIPU_URL = 'https://open.bigmodel.cn/api/paas/v4/chat/completions'
ZHIPU_KEY = 'bad425e316494a08a8970fbfd95299f3.FsSKR1nX0IdZoZjs'


# ===== 阿里云百炼大模型 — AI增强AR功能（安全密钥管理） =====
# 安全规范：
#   1. 严禁在源代码中硬编码密钥
#   2. 优先从环境变量 DASHSCOPE_API_KEY 读取
#   3. 环境变量未设置时从CSV文件运行时读取（仅读取一次，内存缓存）
#   4. 严禁在日志、响应中暴露密钥
#   5. 密钥相关文件不纳入版本控制
_DASHSCOPE_KEY_CACHE = None  # 内存缓存（最小化暴露）
_DASHSCOPE_CSV_PATH = os.path.join(os.path.dirname(__file__), '..', 'AI_api_key', '默认业务空间-apiKey-5819521.csv')
DASHSCOPE_API_URL = 'https://ws-uxheyoncoi6k2bsd.cn-beijing.maas.aliyuncs.com/compatible-mode/v1/chat/completions'


def _load_dashscope_key():
    """安全加载阿里云百炼API密钥：环境变量优先，CSV文件备用。密钥仅在内存中缓存，不记录日志。"""
    global _DASHSCOPE_KEY_CACHE
    if _DASHSCOPE_KEY_CACHE:
        return _DASHSCOPE_KEY_CACHE
    # 优先从环境变量读取
    key = os.environ.get('DASHSCOPE_API_KEY', '').strip()
    if key:
        _DASHSCOPE_KEY_CACHE = key
        return key
    # 环境变量未设置，从CSV文件读取
    try:
        import csv as _csv
        if os.path.exists(_DASHSCOPE_CSV_PATH):
            with open(_DASHSCOPE_CSV_PATH, 'r', encoding='utf-8-sig') as f:
                reader = _csv.reader(f)
                for row in reader:
                    if len(row) >= 2 and row[0] == 'apiKey':
                        key = row[1].strip()
                        if key:
                            _DASHSCOPE_KEY_CACHE = key
                            return key
    except Exception:
        pass  # 静默失败，不暴露文件路径或错误细节
    return ''


# ===== AI调用审计日志（脱敏处理 + 异常检测） =====
_AI_AUDIT_LOG = []           # 内存审计日志（保留最近1000条）
_AI_CALL_COUNTER = {}        # 调用频次计数器 {session_key: {endpoint: count}}
_RATE_LIMIT_WINDOW = 60      # 限流窗口（秒）
_RATE_LIMIT_MAX_CALLS = 30   # 每窗口最大调用次数

# ===== AI结果缓存（LRU，减少重复调用成本） =====
_AI_RESULT_CACHE = {}          # 缓存字典 {cache_key: {result, expire_at}}
_AI_CACHE_MAX_SIZE = 50        # 最大缓存条目数
_AI_CACHE_TTL = 300            # 缓存有效期（秒），5分钟

# ===== AI熔断机制（连续失败时自动降级） =====
_AI_CIRCUIT_BREAKER = {}       # {endpoint: {fail_count, last_fail_time, tripped}}
_AI_CB_FAIL_THRESHOLD = 5      # 连续失败阈值
_AI_CB_RECOVERY_TIME = 120     # 熔断恢复时间（秒），2分钟

# ===== 请求体大小限制（防止DoS） =====
_MAX_REQUEST_BODY_SIZE = 2 * 1024 * 1024  # 2MB，超过拒绝


def _get_cache_key(endpoint, params):
    """生成缓存键（基于端点+参数哈希，不含图片数据）。"""
    import hashlib as _hl
    # 只用非图片参数生成缓存键
    safe_params = {k: v for k, v in (params or {}).items() if k != 'image_base64'}
    if 'image_base64' in (params or {}):
        # 图片用其长度的哈希作为指纹（避免存储完整base64）
        safe_params['_img_len'] = len(str(params.get('image_base64', '')))
    raw = endpoint + json.dumps(safe_params, sort_keys=True, ensure_ascii=False)
    return _hl.md5(raw.encode('utf-8')).hexdigest()


def _get_cached_result(cache_key):
    """获取缓存结果，过期或不存在返回None。"""
    entry = _AI_RESULT_CACHE.get(cache_key)
    if not entry:
        return None
    if time.time() > entry['expire_at']:
        _AI_RESULT_CACHE.pop(cache_key, None)
        return None
    return entry['result']


def _set_cached_result(cache_key, result):
    """设置缓存结果，超过上限时淘汰最旧条目。"""
    if len(_AI_RESULT_CACHE) >= _AI_CACHE_MAX_SIZE:
        # 淘汰最旧的缓存条目
        oldest_key = min(_AI_RESULT_CACHE, key=lambda k: _AI_RESULT_CACHE[k]['expire_at'])
        _AI_RESULT_CACHE.pop(oldest_key, None)
    _AI_RESULT_CACHE[cache_key] = {
        'result': result,
        'expire_at': time.time() + _AI_CACHE_TTL
    }


def _is_circuit_tripped(endpoint):
    """检查端点是否熔断。"""
    cb = _AI_CIRCUIT_BREAKER.get(endpoint)
    if not cb or not cb.get('tripped'):
        return False
    # 检查是否已过恢复时间
    if time.time() - cb['last_fail_time'] > _AI_CB_RECOVERY_TIME:
        cb['tripped'] = False
        cb['fail_count'] = 0
        return False
    return True


def _record_ai_failure(endpoint):
    """记录AI调用失败，达到阈值时触发熔断。"""
    if endpoint not in _AI_CIRCUIT_BREAKER:
        _AI_CIRCUIT_BREAKER[endpoint] = {'fail_count': 0, 'last_fail_time': 0, 'tripped': False}
    cb = _AI_CIRCUIT_BREAKER[endpoint]
    cb['fail_count'] += 1
    cb['last_fail_time'] = time.time()
    if cb['fail_count'] >= _AI_CB_FAIL_THRESHOLD:
        cb['tripped'] = True
        print(f'[熔断告警] {endpoint} 连续失败{cb["fail_count"]}次，已触发熔断')


def _record_ai_success(endpoint):
    """记录AI调用成功，重置失败计数。"""
    if endpoint in _AI_CIRCUIT_BREAKER:
        _AI_CIRCUIT_BREAKER[endpoint]['fail_count'] = 0
        _AI_CIRCUIT_BREAKER[endpoint]['tripped'] = False


def _desensitize_params(params):
    """脱敏处理参数：移除图片base64、截断长文本、掩码敏感字段。"""
    if not params:
        return {}
    safe = {}
    for k, v in params.items():
        if k in ('image_base64', 'image', 'api_key', 'token'):
            safe[k] = f'[REDACTED:len={len(str(v)) if v else 0}]'
        elif isinstance(v, str) and len(v) > 200:
            safe[k] = v[:100] + '...[truncated]'
        else:
            safe[k] = v
    return safe


def _log_ai_audit(endpoint, caller, params, success, duration_ms, error=None):
    """记录AI调用审计日志（脱敏），并执行异常调用检测。"""
    entry = {
        'timestamp': datetime.datetime.now().isoformat(),
        'endpoint': endpoint,
        'caller': caller[:50] if caller else 'unknown',
        'params': _desensitize_params(params),
        'success': success,
        'duration_ms': round(duration_ms, 1),
        'error': str(error)[:200] if error else None
    }
    _AI_AUDIT_LOG.append(entry)
    if len(_AI_AUDIT_LOG) > 1000:
        _AI_AUDIT_LOG.pop(0)
    # 异常调用检测：高频调用告警
    _check_anomaly(endpoint, caller)


def _check_anomaly(endpoint, caller):
    """异常调用检测：检测高频调用并告警。"""
    now = time.time()
    key = f'{caller}:{endpoint}'
    if key not in _AI_CALL_COUNTER:
        _AI_CALL_COUNTER[key] = []
    _AI_CALL_COUNTER[key].append(now)
    # 清理过期记录
    _AI_CALL_COUNTER[key] = [t for t in _AI_CALL_COUNTER[key] if now - t < _RATE_LIMIT_WINDOW]
    # 高频告警
    if len(_AI_CALL_COUNTER[key]) > _RATE_LIMIT_MAX_CALLS:
        print(f'[安全告警] 高频调用检测: {caller} -> {endpoint}, '
              f'{len(_AI_CALL_COUNTER[key])}次/{_RATE_LIMIT_WINDOW}秒')
        return True
    return False


def _is_rate_limited(caller, endpoint):
    """检查是否触发限流。"""
    now = time.time()
    key = f'{caller}:{endpoint}'
    if key not in _AI_CALL_COUNTER:
        return False
    recent = [t for t in _AI_CALL_COUNTER[key] if now - t < _RATE_LIMIT_WINDOW]
    _AI_CALL_COUNTER[key] = recent
    return len(recent) >= _RATE_LIMIT_MAX_CALLS


# ===== 访问口令（防止公网网址被陌生人盗刷 AI 接口） =====
# 用环境变量 LINGSHAN_PASS 覆盖默认值；启动时会在控制台打印当前口令。
ACCESS_PASS = os.environ.get('LINGSHAN_PASS', 'lingshan2026')
COOKIE_NAME = 'lingshan_auth'
COOKIE_MAX_AGE = 7 * 24 * 3600  # 7 天
SESSIONS = set()                 # 已签发的会话 token（进程内）
SESSIONS_LOCK = threading.Lock()


# ===== 游客用户体系（注册/登录，独立于访问口令） =====
DB_PATH = os.path.join(os.path.dirname(__file__), 'lingshan_users.db')
DB_LOCK = threading.Lock()
USER_TOKEN_TTL = 7 * 24 * 3600   # 游客登录 token 有效期 7 天
REGISTER_TIMES = {}              # 注册频率限制：ip -> [时间戳]
REGISTER_LOCK = threading.Lock()
PHONE_RE = re.compile(r'^1[3-9]\d{9}$')
RESET_CODE_TTL = 5 * 60              # 密码重置验证码有效期 5 分钟
RESET_CODE_RESEND_INTERVAL = 60      # 同一手机号重新发送验证码的最小间隔（秒）
RESET_CODE_MAX_ATTEMPTS = 5          # 验证码最大尝试次数


def _db():
    """每线程独立连接，避免跨线程共享问题"""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    with DB_LOCK:
        conn = _db()
        conn.executescript('''
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                phone TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                age INTEGER,
                nickname TEXT,
                gender TEXT,
                created_at TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS user_sessions (
                token TEXT PRIMARY KEY,
                user_id INTEGER NOT NULL,
                expires_at REAL NOT NULL
            );
            CREATE TABLE IF NOT EXISTS spot_reviews (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                spot_id TEXT NOT NULL,
                user_id INTEGER NOT NULL,
                nickname TEXT NOT NULL,
                rating INTEGER NOT NULL,
                content TEXT NOT NULL,
                created_at TEXT NOT NULL
            );
            CREATE INDEX IF NOT EXISTS idx_spot_reviews_spot ON spot_reviews(spot_id);
            -- AI模型配置表
            CREATE TABLE IF NOT EXISTS ai_models (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,                    -- 模型显示名称
                provider_type TEXT NOT NULL,           -- glm/deepseek/qwen/minimax/edge_tts/custom
                role TEXT NOT NULL,                    -- recognition/qa/tts
                api_url TEXT NOT NULL,                 -- API地址
                api_key TEXT NOT NULL,                 -- API密钥
                model_name TEXT NOT NULL,              -- 模型名称（如 glm-4v-flash）
                context_limit INTEGER DEFAULT 4096,    -- 上下文长度限制
                status TEXT DEFAULT 'enabled',         -- enabled/disabled
                created_at TEXT NOT NULL
            );
            -- AI全局配置表
            CREATE TABLE IF NOT EXISTS ai_global_config (
                id INTEGER PRIMARY KEY CHECK (id = 1),
                default_recognition_model_id INTEGER,
                default_qa_model_id INTEGER,
                default_tts_model_id INTEGER,
                timeout_seconds INTEGER DEFAULT 30
            );
            -- 管理员Token表（JWT式）
            CREATE TABLE IF NOT EXISTS admin_sessions (
                token TEXT PRIMARY KEY,
                created_at REAL NOT NULL,
                expires_at REAL NOT NULL
            );
            -- 对话日志表（存储AI对话记录和情感标签，供管理端情感分析报告使用）
            CREATE TABLE IF NOT EXISTS chat_logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_question TEXT NOT NULL,
                ai_answer TEXT NOT NULL,
                emotion TEXT DEFAULT 'neutral',
                category TEXT DEFAULT '',
                created_at TEXT NOT NULL
            );
            -- 数字人形象管理表
            CREATE TABLE IF NOT EXISTS avatars (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,                          -- 形象名称
                vrm_path TEXT NOT NULL,                      -- VRM 文件 URL 路径
                voice_type TEXT DEFAULT 'zh-CN-XiaoxiaoNeural', -- edge-tts 音色
                model_scale REAL DEFAULT 2.6,                -- 模型缩放
                position_x REAL DEFAULT 0,                   -- 水平偏移
                position_y REAL DEFAULT 0,                   -- 垂直偏移
                rotation_y REAL DEFAULT 0,                   -- 朝向角度（弧度）
                is_active INTEGER DEFAULT 0,                 -- 是否当前启用
                file_size INTEGER DEFAULT 0,                 -- VRM 文件大小（字节）
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );
            -- 知识库管理表（管理员可增删改查知识条目）
            CREATE TABLE IF NOT EXISTS knowledge (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT NOT NULL,                         -- 标题
                category TEXT DEFAULT '景区概况',              -- 分类
                content TEXT NOT NULL,                       -- 内容
                tags TEXT DEFAULT '',                        -- 标签（逗号分隔）
                source TEXT DEFAULT 'manual',                -- 来源：manual=手动, upload=文档上传
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );
            -- 音色管理表（管理员可添加自定义音色，需上传音频样本）
            CREATE TABLE IF NOT EXISTS voices (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,                          -- 音色显示名称
                edge_voice TEXT NOT NULL,                    -- 对应的 edge-tts 音色值
                audio_path TEXT DEFAULT '',                  -- 音频样本文件路径（上传的 mp3/wav）
                description TEXT DEFAULT '',                 -- 音色描述
                is_builtin INTEGER DEFAULT 0,                -- 是否内置音色（内置不可删除）
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );
            -- 应用设置表（键值对，用于一次性迁移标记等）
            CREATE TABLE IF NOT EXISTS app_settings (
                key TEXT PRIMARY KEY,
                value TEXT
            );
            -- 密码重置验证码表（手机号、验证码、过期时间）
            CREATE TABLE IF NOT EXISTS reset_codes (
                phone TEXT PRIMARY KEY,
                code TEXT NOT NULL,
                created_at REAL NOT NULL,
                expires_at REAL NOT NULL,
                attempts INTEGER DEFAULT 0
            );
        ''')
        conn.commit()
        conn.close()
    _seed_reviews()
    _init_ai_global_config()
    _init_avatars()
    _init_knowledge()
    _init_voices()


def hash_password(password: str) -> str:
    salt = secrets.token_hex(16)
    h = hashlib.pbkdf2_hmac('sha256', password.encode('utf-8'),
                            salt.encode('utf-8'), 100000).hex()
    return f'{salt}${h}'


def verify_password(password: str, stored: str) -> bool:
    try:
        salt, h = stored.split('$', 1)
        calc = hashlib.pbkdf2_hmac('sha256', password.encode('utf-8'),
                                   salt.encode('utf-8'), 100000).hex()
        return secrets.compare_digest(calc, h)
    except Exception:
        return False


def _check_register_rate(ip: str) -> bool:
    now = time.time()
    with REGISTER_LOCK:
        times = [t for t in REGISTER_TIMES.get(ip, []) if now - t < 60]
        if len(times) >= 3:
            REGISTER_TIMES[ip] = times
            return False
        times.append(now)
        REGISTER_TIMES[ip] = times
        return True


def _user_public(row) -> dict:
    return {
        'id': row['id'],
        'phone': row['phone'],
        'age': row['age'],
        'nickname': row['nickname'] or ('游客' + row['phone'][-4:]),
        'gender': row['gender']
    }


def _create_session(conn, user_id: int) -> str:
    """在已打开的连接上插入会话（由调用方 commit）"""
    token = secrets.token_hex(32)
    conn.execute('INSERT INTO user_sessions (token, user_id, expires_at) VALUES (?,?,?)',
                 (token, user_id, time.time() + USER_TOKEN_TTL))
    return token


def _issue_token(user_id: int) -> str:
    """独立连接创建会话并 commit"""
    with DB_LOCK:
        conn = _db()
        try:
            token = _create_session(conn, user_id)
            conn.commit()
        finally:
            conn.close()
    return token


def _get_user_by_token(token: str):
    if not token:
        return None
    conn = _db()
    try:
        return conn.execute(
            'SELECT u.* FROM users u JOIN user_sessions s ON s.user_id=u.id '
            'WHERE s.token=? AND s.expires_at>?',
            (token, time.time())
        ).fetchone()
    finally:
        conn.close()


# ===== 景点评价种子数据（首次启动时写入，便于预览效果） =====
REVIEW_SEEDS = {
    'buddha': [
        {'nickname': '静心行者', 'rating': 5, 'content': '仰视88米大佛真的很震撼，建议上午去人少，抱佛脚祈福很有仪式感。'},
        {'nickname': '阿明', 'rating': 5, 'content': '不愧是灵山地标，远远就能看到，走到脚下抬头那一刻心生敬畏。'},
        {'nickname': '小桥流水', 'rating': 4, 'content': '壮观是真壮观，就是旺季人比较多，拍照要排队，建议早到。'},
    ],
    'jile-lifo': [
        {'nickname': '沐恩', 'rating': 5, 'content': '在大佛脚下仰望，距离很近，能感受到那种慈悲的气场，值得驻足。'},
        {'nickname': '清风明月', 'rating': 4, 'content': '拍大佛合影的最佳机位，记得脱帽致敬，保持肃穆。'},
    ],
    'palm': [
        {'nickname': '好运来', 'rating': 5, 'content': '抱了抱佛手，图个平安吉祥，11.7米的佛手比想象中大很多。'},
        {'nickname': '路过的旅人', 'rating': 4, 'content': '热门打卡点，佛手做工很精细，跟大佛同比例复制，值得一看。'},
    ],
    'ayuwang': [
        {'nickname': '历史爱好者', 'rating': 4, 'content': '仿印度阿育王柱建造，柱身有经文，了解佛法东传历史的好地方。'},
        {'nickname': '阿哲', 'rating': 4, 'content': '文化底蕴很深，建议配着讲解看，不然容易错过背后的故事。'},
    ],
    'wujinyi': [
        {'nickname': '墨缘', 'rating': 5, 'content': '佛教艺术展馆，里面高僧墨宝和造像都很珍贵，喜欢文化的别错过。'},
        {'nickname': '云游僧', 'rating': 4, 'content': '展品精致，环境清幽，比外面喧闹的广场适合静下心来慢慢看。'},
    ],
    'xiangfu': [
        {'nickname': '香客老李', 'rating': 5, 'content': '千年古刹，唐贞观年间始建，进去参拜氛围肃穆，梵音阵阵很治愈。'},
        {'nickname': '江南客', 'rating': 4, 'content': '大雄宝殿庄严，藏经楼值得看，注意保持安静。'},
    ],
    'fangsheng': [
        {'nickname': '莲心', 'rating': 5, 'content': '莲花水池很美，环境清幽雅致，适合静心漫步，体味慈悲护生的理念。'},
        {'nickname': '阿芳', 'rating': 4, 'content': '池中雕塑精美，记得别往池里扔东西，文明游览。'},
    ],
    'jiulong': [
        {'nickname': '亲子游达人', 'rating': 5, 'content': '整点表演太震撼了！莲花绽放太子佛升起，九龙喷水，必看！提前5分钟占位。'},
        {'nickname': '光影捕手', 'rating': 5, 'content': '国内最大音乐喷泉铜雕名不虚传，每场8分钟，场面壮观。'},
        {'nickname': '匆匆过客', 'rating': 4, 'content': '表演很精彩，就是人挤人，建议掐准整点时间，10点到16点每整点一场。'},
    ],
    'baizi': [
        {'nickname': '宝妈小林', 'rating': 5, 'content': '一百个孩童嬉戏弥勒，神态各异，孩子看得停不下来，亲子拍照首选。'},
        {'nickname': '笑口常开', 'rating': 4, 'content': '童趣十足，寓意也好"笑口常开福气自来"，每个小童都值得细品。'},
    ],
    'wuyin': [
        {'nickname': '藏风迷', 'rating': 5, 'content': '藏式建筑宏伟，内部唐卡壁画色彩斑斓，宛如艺术殿堂，禁止触摸壁画要留意。'},
        {'nickname': '行者无疆', 'rating': 5, 'content': '五方佛五种手印，内部装修极其精美，推荐留足40分钟慢慢看。'},
        {'nickname': '高原客', 'rating': 4, 'content': '不用去西藏也能感受藏传佛教艺术，很惊艳，就是旺季有点挤。'},
    ],
    'qifu': [
        {'nickname': '许愿少女', 'rating': 5, 'content': '挂了祈福牌系了红丝带，红丝带随风飘扬很壮观，愿望留在灵山圣地。'},
        {'nickname': '福来', 'rating': 4, 'content': '仪式感满满，祈福牌在旁边服务台买的，价格不贵，图个好兆头。'},
    ],
    'fangong': [
        {'nickname': '艺术控', 'rating': 5, 'content': '世界佛教论坛会址，内部金碧辉煌！琉璃浮雕华藏世界、东阳木雕震撼，不输顶级博物馆。'},
        {'nickname': '深度游玩家', 'rating': 5, 'content': '必看！留意《灵山吉祥颂》演出时间，建议留1小时以上，禁止闪光灯。'},
        {'nickname': '小资旅行家', 'rating': 5, 'content': '建筑与艺术的完美结合，每一处细节都值得驻足，灵山最值的景点。'},
    ],
    'manfeilong': [
        {'nickname': '建筑学徒', 'rating': 4, 'content': '傣族群塔造型优美，主塔居中八小塔环绕，和梵宫形成汉藏傣三族对比，有意思。'},
        {'nickname': '南国来客', 'rating': 4, 'content': '原型来自西双版纳，在江南看到南传佛塔挺新鲜，塔身洁白很上镜。'},
    ],
    'talong': [
        {'nickname': '登高望远', 'rating': 4, 'content': '九层琉璃塔飞檐翘角很壮观，登塔可俯瞰整个灵山全貌，值得一爬。'},
        {'nickname': '古建迷', 'rating': 4, 'content': '仿木结构楼阁式塔，层层收分工艺讲究，可惜有时不开放登塔。'},
    ],
}


def _seed_reviews():
    """首次启动且评价表为空时，写入种子假评价供预览"""
    with DB_LOCK:
        conn = _db()
        try:
            count = conn.execute('SELECT COUNT(*) AS c FROM spot_reviews').fetchone()['c']
            if count > 0:
                return
            base = time.time() - 3 * 86400
            seq = 0
            for spot_id, items in REVIEW_SEEDS.items():
                for it in items:
                    seq += 1
                    conn.execute(
                        'INSERT INTO spot_reviews (spot_id, user_id, nickname, rating, content, created_at) '
                        'VALUES (?,?,?,?,?,?)',
                        (spot_id, 0, it['nickname'], it['rating'], it['content'],
                         time.strftime('%Y-%m-%d %H:%M:%S', time.localtime(base + seq * 7200)))
                    )
            conn.commit()
            print(f'已写入 {seq} 条景点种子评价。')
        finally:
            conn.close()


# ===== 管理员（AI模型管理）鉴权 =====
ADMIN_USERNAME = 'admin'
ADMIN_PASSWORD = 'admin123'
ADMIN_TOKEN_TTL = 24 * 3600  # 管理员 token 有效期 1 天


def _create_admin_session():
    """创建管理员会话，返回 (token, expires_at)"""
    token = secrets.token_hex(32)
    now = time.time()
    expires_at = now + ADMIN_TOKEN_TTL
    with DB_LOCK:
        conn = _db()
        try:
            conn.execute(
                'INSERT INTO admin_sessions (token, created_at, expires_at) VALUES (?,?,?)',
                (token, now, expires_at)
            )
            conn.commit()
        finally:
            conn.close()
    return token, int(expires_at)


def _verify_admin_token(token):
    """验证管理员 token 是否有效"""
    if not token:
        return False
    conn = _db()
    try:
        row = conn.execute(
            'SELECT 1 FROM admin_sessions WHERE token=? AND expires_at>?',
            (token, time.time())
        ).fetchone()
        return row is not None
    finally:
        conn.close()


def _init_ai_global_config():
    """确保 ai_global_config 表存在一条默认记录（id=1）"""
    with DB_LOCK:
        conn = _db()
        try:
            row = conn.execute('SELECT id FROM ai_global_config WHERE id=1').fetchone()
            if not row:
                conn.execute(
                    'INSERT INTO ai_global_config (id, default_recognition_model_id, default_qa_model_id, default_tts_model_id, timeout_seconds) '
                    'VALUES (1, NULL, NULL, NULL, 30)'
                )
                conn.commit()
        finally:
            conn.close()


def _init_avatars():
    """初始化默认数字人形象（3个内置VRM模型）+ 一次性清空上传数字人"""
    with DB_LOCK:
        conn = _db()
        try:
            now = datetime.datetime.now().isoformat()
            # 3个内置数字人形象
            builtin_avatars = [
                {
                    'name': '小乐（默认）',
                    'vrm_path': '/static/avatars/use_for_app1.vrm',
                    'voice_type': 'zh-CN-XiaoxiaoNeural',
                    'model_scale': 3.25,
                    'is_active': 1,  # 默认启用第一个
                },
                {
                    'name': '小雅',
                    'vrm_path': '/static/avatars/use_for_app2.vrm',
                    'voice_type': 'zh-CN-XiaoyiNeural',
                    'model_scale': 3.25,
                    'is_active': 0,
                },
                {
                    'name': '小慧',
                    'vrm_path': '/static/avatars/use_for_app3.vrm',
                    'voice_type': 'zh-CN-XiaohanNeural',
                    'model_scale': 3.25,
                    'is_active': 0,
                },
            ]
            # 一次性清空上传数字人（通过 app_settings 标记确保只执行一次）
            reset_flag = conn.execute(
                'SELECT value FROM app_settings WHERE key=?', ('avatars_v2_reset',)
            ).fetchone()
            if not reset_flag:
                deleted = conn.execute(
                    "DELETE FROM avatars WHERE vrm_path LIKE '%/uploaded/%'"
                ).rowcount
                if deleted > 0:
                    print(f'[Avatar] 已清空 {deleted} 个上传数字人')
                conn.execute(
                    'INSERT OR IGNORE INTO app_settings (key, value) VALUES (?, ?)',
                    ('avatars_v2_reset', '1')
                )
            # 确保内置数字人存在（按 vrm_path upsert）
            for av in builtin_avatars:
                vrm_full = os.path.join(STATIC_DIR, av['vrm_path'].lstrip('/'))
                file_size = os.path.getsize(vrm_full) if os.path.exists(vrm_full) else 0
                existing = conn.execute(
                    'SELECT id, is_active FROM avatars WHERE vrm_path=?', (av['vrm_path'],)
                ).fetchone()
                if existing:
                    # 已存在，更新名称/音色/缩放/文件大小（保留 is_active 状态）
                    conn.execute(
                        'UPDATE avatars SET name=?, voice_type=?, model_scale=?, file_size=?, updated_at=? WHERE id=?',
                        (av['name'], av['voice_type'], av['model_scale'], file_size, now, existing['id'])
                    )
                else:
                    conn.execute(
                        'INSERT INTO avatars (name, vrm_path, voice_type, model_scale, position_x, position_y, rotation_y, is_active, file_size, created_at, updated_at) '
                        'VALUES (?, ?, ?, ?, 0, 0, 0, ?, ?, ?, ?)',
                        (av['name'], av['vrm_path'], av['voice_type'], av['model_scale'],
                         av['is_active'], file_size, now, now)
                    )
            # 如果没有任何启用的数字人，启用第一个
            active_count = conn.execute(
                'SELECT COUNT(*) FROM avatars WHERE is_active=1'
            ).fetchone()[0]
            if active_count == 0:
                first = conn.execute(
                    'SELECT id FROM avatars WHERE vrm_path=?',
                    (builtin_avatars[0]['vrm_path'],)
                ).fetchone()
                if first:
                    conn.execute('UPDATE avatars SET is_active=1 WHERE id=?', (first['id'],))
            conn.commit()
            print(f'[Avatar] 内置数字人已就绪（3个）')
        finally:
            conn.close()


def _init_voices():
    """初始化内置音色（从 EDGE_TTS_VOICES 导入为内置音色）"""
    with DB_LOCK:
        conn = _db()
        try:
            count = conn.execute('SELECT COUNT(*) FROM voices').fetchone()[0]
            if count > 0:
                return
            now = datetime.datetime.now().isoformat()
            for v in EDGE_TTS_VOICES:
                conn.execute(
                    'INSERT INTO voices (name, edge_voice, audio_path, description, is_builtin, created_at, updated_at) '
                    'VALUES (?, ?, ?, ?, 1, ?, ?)',
                    (v['label'], v['value'], '', 'Edge-TTS 内置音色', now, now)
                )
            conn.commit()
            print(f'[Voice] 已初始化 {len(EDGE_TTS_VOICES)} 个内置音色')
        finally:
            conn.close()


def _init_knowledge():
    """初始化知识库默认条目（从景点和问答数据中提取）"""
    with DB_LOCK:
        conn = _db()
        try:
            count = conn.execute('SELECT COUNT(*) FROM knowledge').fetchone()[0]
            if count == 0:
                now = datetime.datetime.now().isoformat()
                default_knowledge = [
                    ('灵山胜境景区概况', '景区概况', '灵山胜境位于江苏省无锡市滨湖区，是国家AAAAA级旅游景区。景区占地面积约30公顷，以佛教文化为主题，集自然风光、历史文化、艺术观赏于一体。主要景点包括灵山大佛、九龙灌浴、梵宫、五印坛城、祥符禅寺等。', '灵山,概况,简介,AAAAA', 'manual'),
                    ('灵山大佛', '景点介绍', '灵山大佛位于灵山胜境景区内，通高88米，佛体79米，莲花瓣9米。由725吨铜铸造而成，是迄今为止世界上最高的露天青铜释迦牟尼立像。大佛右手指天，称为"施无畏印"，寓意为众生解除痛苦；左手点地，称为"与愿印"，寓意保佑众生平安快乐。', '大佛,释迦牟尼,青铜,88米', 'manual'),
                    ('九龙灌浴', '景点介绍', '九龙灌浴是灵山胜境的标志性景观之一。根据《本行经》记载：佛祖释迦牟尼诞生时，九龙吐水为其沐浴。每天定时表演，巨大的莲花瓣缓缓绽开，露出金身太子像，九龙喷水为太子沐浴。表演时间：每日10:00、11:30、14:00、15:30。', '九龙灌浴,表演,时间,莲花', 'manual'),
                    ('梵宫', '景点介绍', '灵山梵宫是灵山胜境的核心建筑之一，建筑面宽150米，进深180米，最高点68米。梵宫内部装饰华丽，有大型组雕、油画、木雕、石雕等艺术珍品。华塔大堂可容纳2000余人，是举办大型佛教活动的场所。', '梵宫,建筑,艺术,华塔', 'manual'),
                    ('五印坛城', '景点介绍', '五印坛城是灵山胜境内的藏传佛教艺术殿堂，融合了藏式建筑风格和佛教文化。内部供奉各类佛像和唐卡，展示藏传佛教的深厚底蕴。', '五印坛城,藏传佛教,唐卡', 'manual'),
                    ('祥符禅寺', '景点介绍', '祥符禅寺是灵山胜境内的古刹，始建于唐代，历史悠久。寺内有大雄宝殿、天王殿等建筑，是游客礼佛祈福的重要场所。', '祥符禅寺,古刹,唐代', 'manual'),
                    ('景区开放时间', '服务信息', '灵山胜境景区开放时间：7:30-17:30（夏季）；8:00-17:00（冬季）。建议游玩时间4-6小时。九龙灌浴表演时间：10:00、11:30、14:00、15:30。', '开放时间,营业,时间表', 'manual'),
                    ('门票价格', '服务信息', '灵山胜境门票：成人票210元/人；学生票105元/人（凭学生证）；1.4米以下儿童免票；70岁以上老人免票（凭身份证）。门票包含景区内所有景点，不含餐饮和纪念品。', '门票,价格,学生票,免费', 'manual'),
                    ('交通指南', '服务信息', '公交：无锡火车站乘88路公交车至灵山胜境站；地铁：2号线至梅园开原寺站转88路；自驾：沪宁高速无锡北出口下，沿太湖大道西行至环太湖公路。景区设有大型停车场，停车费10元/次。', '交通,公交,地铁,自驾,停车', 'manual'),
                    ('佛教文化知识', '文化历史', '佛教起源于古印度，由释迦牟尼创立。基本教义包括四谛、八正道、十二因缘等。灵山胜境以佛教文化为主题，通过建筑、雕塑、表演等形式展示佛教文化的精髓。游客在参观时请保持安静，尊重宗教信仰。', '佛教,文化,历史,释迦牟尼', 'manual'),
                ]
                for title, category, content, tags, source in default_knowledge:
                    conn.execute(
                        'INSERT INTO knowledge (title, category, content, tags, source, created_at, updated_at) '
                        'VALUES (?, ?, ?, ?, ?, ?, ?)',
                        (title, category, content, tags, source, now, now)
                    )
                conn.commit()
                print(f'[Knowledge] 已初始化 {len(default_knowledge)} 条知识库数据')
        finally:
            conn.close()


# Edge-TTS 可选音色列表
EDGE_TTS_VOICES = [
    {'value': 'zh-CN-XiaoxiaoNeural', 'label': '晓晓（温柔女声）'},
    {'value': 'zh-CN-XiaoyiNeural', 'label': '晓伊（活泼女声）'},
    {'value': 'zh-CN-YunxiNeural', 'label': '云希（亲切男声）'},
    {'value': 'zh-CN-YunyangNeural', 'label': '云扬（沉稳男声）'},
    {'value': 'zh-CN-XiaochenNeural', 'label': '晓辰（清新女声）'},
    {'value': 'zh-CN-XiaohanNeural', 'label': '晓涵（温暖女声）'},
    {'value': 'zh-CN-XiaomengNeural', 'label': '晓梦（甜美女声）'},
    {'value': 'zh-CN-XiaomoNeural', 'label': '晓墨（知性女声）'},
    {'value': 'zh-CN-XiaoqiuNeural', 'label': '晓秋（成熟女声）'},
    {'value': 'zh-CN-XiaoruiNeural', 'label': '晓睿（干练女声）'},
    {'value': 'zh-CN-XiaoshuangNeural', 'label': '晓双（童声女声）'},
    {'value': 'zh-CN-XiaoxuanNeural', 'label': '晓萱（活力女声）'},
    {'value': 'zh-CN-XiaoyanNeural', 'label': '晓颜（标准女声）'},
    {'value': 'zh-CN-XiaozhenNeural', 'label': '晓甄（优雅女声）'},
    {'value': 'zh-CN-YunjianNeural', 'label': '云健（运动男声）'},
    {'value': 'zh-CN-YunfengNeural', 'label': '云枫（磁性男声）'},
    {'value': 'zh-CN-YunhaoNeural', 'label': '云皓（爽朗男声）'},
    {'value': 'zh-CN-YunxiaNeural', 'label': '云夏（少年男声）'},
    {'value': 'zh-CN-YunyeNeural', 'label': '云野（儒雅男声）'},
]


# 灵山景点ID映射（用于识别提示词）
LINGSHAN_SPOT_IDS = {
    'buddha': '灵山大佛', 'palm': '灵山佛手', 'ayuwang': '阿育王柱',
    'wujinyi': '无尽意斋', 'xiangfu': '祥符禅寺', 'fangsheng': '放生池',
    'jiulong': '九龙灌浴', 'baizi': '百子戏弥勒', 'wuyin': '五印坛城',
    'qifu': '祈福殿', 'fangong': '梵宫', 'manfeilong': '曼飞龙塔', 'talong': '塔龙',
}


def _build_recognition_prompt():
    """构造景区识别提示词"""
    spots_desc = '、'.join([f'{sid}({name})' for sid, name in LINGSHAN_SPOT_IDS.items()])
    return (f'请识别图片中的景区景点，返回JSON格式：'
            f'{{"spot_id":"","spot_name":"","confidence":0.0,"description":""}}。'
            f'如果是灵山胜境的景点，spot_id请使用：{spots_desc}。')


def _get_model_by_id(model_id):
    """根据 id 获取模型配置"""
    if not model_id:
        return None
    conn = _db()
    try:
        return conn.execute('SELECT * FROM ai_models WHERE id=?', (model_id,)).fetchone()
    finally:
        conn.close()


def _get_default_model_by_role(role):
    """获取指定角色的默认启用模型；默认失效时回退到该角色任意启用模型"""
    if role not in ('recognition', 'qa', 'tts'):
        return None
    conn = _db()
    try:
        col = f'default_{role}_model_id'
        row = conn.execute(f'SELECT {col} AS mid FROM ai_global_config WHERE id=1').fetchone()
        mid = row['mid'] if row else None
        if mid:
            m = conn.execute(
                'SELECT * FROM ai_models WHERE id=? AND status=?',
                (mid, 'enabled')
            ).fetchone()
            if m:
                return m
        # 默认失效，回退到该角色任意启用模型
        return conn.execute(
            'SELECT * FROM ai_models WHERE role=? AND status=? ORDER BY id LIMIT 1',
            (role, 'enabled')
        ).fetchone()
    finally:
        conn.close()


def _get_timeout_seconds():
    """获取全局超时秒数"""
    conn = _db()
    try:
        row = conn.execute('SELECT timeout_seconds FROM ai_global_config WHERE id=1').fetchone()
        return row['timeout_seconds'] if row else 30
    finally:
        conn.close()


def _parse_recognition_result(content):
    """从模型返回内容中解析JSON识别结果，返回 (spot_id, spot_name, confidence, description)"""
    spot_id = ''
    spot_name = ''
    confidence = 0.0
    description = ''
    try:
        # 优先提取 ```json ... ``` 块
        m = re.search(r'```json\s*([\s\S]*?)```', content)
        if m:
            content_json = m.group(1).strip()
        else:
            # 退而求其次，提取 { ... }
            m = re.search(r'\{[\s\S]*\}', content)
            if m:
                content_json = m.group(0).strip()
            else:
                content_json = content.strip()
        result = json.loads(content_json)
        spot_id = str(result.get('spot_id', '')).strip()
        spot_name = str(result.get('spot_name', '')).strip()
        try:
            confidence = float(result.get('confidence', 0))
        except (ValueError, TypeError):
            confidence = 0.0
        description = str(result.get('description', '')).strip()
    except Exception:
        # 解析失败时把整段作为描述，标记为未知
        description = content.strip()
        spot_name = '未知'
    return spot_id, spot_name, confidence, description


# 登录页（自包含，无外部依赖；未登录访问任何地址都返回此页）
LOGIN_HTML = """<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
<title>灵山导览 · 访问验证</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    min-height: 100vh; display: flex; align-items: center; justify-content: center;
    font-family: -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif;
    background: linear-gradient(135deg, #2b3a67 0%, #b8860b 100%);
    padding: 24px;
  }
  .card {
    width: 100%; max-width: 360px; background: #fff; border-radius: 18px;
    padding: 36px 28px 30px; box-shadow: 0 20px 60px rgba(0,0,0,.25);
  }
  .logo { width: 64px; height: 64px; margin: 0 auto 14px; border-radius: 50%;
    background: linear-gradient(135deg, #d4a017, #8b6914);
    display: flex; align-items: center; justify-content: center;
    color: #fff; font-size: 30px; box-shadow: 0 6px 16px rgba(184,134,11,.45); }
  h1 { text-align: center; font-size: 20px; color: #2b3a67; margin-bottom: 6px; }
  p.tip { text-align: center; font-size: 13px; color: #9aa0a6; margin-bottom: 22px; }
  input { width: 100%; padding: 13px 15px; border: 1px solid #e0e3e8; border-radius: 10px;
    font-size: 16px; outline: none; transition: border-color .2s; }
  input:focus { border-color: #b8860b; }
  button { width: 100%; margin-top: 14px; padding: 13px; border: none; border-radius: 10px;
    background: linear-gradient(135deg, #d4a017, #8b6914); color: #fff; font-size: 16px;
    font-weight: 600; cursor: pointer; transition: transform .1s; }
  button:active { transform: scale(.98); }
  button:disabled { opacity: .6; cursor: default; }
  .err { color: #e74c3c; font-size: 13px; text-align: center; min-height: 18px; margin-top: 12px; }
</style>
</head>
<body>
  <div class="card">
    <div class="logo">🛕</div>
    <h1>灵山导览</h1>
    <p class="tip">请输入访问口令</p>
    <form id="f">
      <input id="pass" type="password" placeholder="访问口令" autocomplete="current-password" autofocus>
      <button id="btn" type="submit">进入</button>
    </form>
    <div class="err" id="err"></div>
  </div>
<script>
document.getElementById('f').addEventListener('submit', async (e) => {
  e.preventDefault();
  const btn = document.getElementById('btn');
  const errEl = document.getElementById('err');
  const pass = document.getElementById('pass').value;
  errEl.textContent = ''; btn.disabled = true; btn.textContent = '验证中...';
  try {
    const r = await fetch('/api/login', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pass }),
      credentials: 'include'
    });
    if (r.ok) { location.reload(); return; }
    const d = await r.json().catch(() => ({}));
    errEl.textContent = d.error || '口令错误';
  } catch (ex) { errEl.textContent = '网络异常，请重试'; }
  btn.disabled = false; btn.textContent = '进入';
});
</script>
</body>
</html>"""


async def synthesize_tts(text: str, voice: str = None) -> bytes:
    """合成 TTS 音频。voice 为 None 时使用默认音色，否则使用指定音色。"""
    if not voice:
        # 从数据库读取当前启用数字人的音色配置
        try:
            with DB_LOCK:
                conn = _db()
                try:
                    row = conn.execute('SELECT voice_type FROM avatars WHERE is_active=1 LIMIT 1').fetchone()
                    if row and row[0]:
                        voice = row[0]
                finally:
                    conn.close()
        except Exception:
            pass
    if not voice:
        voice = 'zh-CN-XiaoxiaoNeural'
    mp3 = b''
    tts = edge_tts.Communicate(text, voice, rate='+10%')
    async for chunk in tts.stream():
        if chunk['type'] == 'audio':
            mp3 += chunk['data']
    return mp3


class ProxyHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=STATIC_DIR, **kwargs)

    def end_headers(self):
        self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0, private')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        super().end_headers()

    def log_message(self, format, *args):
        # 防御：日志绝不能抛异常打崩请求线程（参见 stdout 的 utf-8 重配置）
        try:
            print(f'[{self.log_date_time_string()}] {format % args}')
        except Exception:
            pass

    # ===== 访问口令：校验会话 cookie =====
    def _is_authed(self):
        cookie_header = self.headers.get('Cookie', '')
        if not cookie_header:
            return False
        try:
            cookie = SimpleCookie()
            cookie.load(cookie_header)
            token = cookie.get(COOKIE_NAME)
            if not token:
                return False
            with SESSIONS_LOCK:
                return token.value in SESSIONS
        except Exception:
            return False

    def _serve_login_page(self):
        body = LOGIN_HTML.encode('utf-8')
        self.send_response(200)
        self.send_header('Content-Type', 'text/html; charset=utf-8')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        if self.command != 'HEAD':
            self.wfile.write(body)

    def do_GET(self):
        # ===== AI管理接口（独立于访问口令，需管理员 token） =====
        if self.path == '/api/admin/ai/models':
            if not self._require_admin():
                return
            self.handle_admin_ai_models_list()
            return
        if self.path == '/api/admin/ai/config':
            if not self._require_admin():
                return
            self.handle_admin_ai_config_get()
            return
        if self.path == '/api/admin/sentiment-report':
            if not self._require_admin():
                return
            self.handle_sentiment_report()
            return
        if self.path == '/api/admin/avatars':
            if not self._require_admin():
                return
            self.handle_admin_avatars_list()
            return
        if self.path == '/api/admin/avatars/voices':
            if not self._require_admin():
                return
            self.handle_admin_voices_list()
            return
        # ===== 知识库/数据大屏/报告接口（管理员，GET，支持查询参数） =====
        path_only = self.path.split('?')[0]
        # 音色音频样本
        if path_only == '/api/admin/voices/audio':
            if not self._require_admin():
                return
            self.handle_admin_voice_audio()
            return
        # ===== 知识库管理接口（管理员，GET） =====
        if path_only == '/api/admin/knowledge':
            if not self._require_admin():
                return
            self.handle_admin_knowledge_list()
            return
        if path_only == '/api/admin/knowledge/coverage':
            if not self._require_admin():
                return
            self.handle_admin_knowledge_coverage()
            return
        # ===== 数据大屏接口（管理员，GET） =====
        if path_only == '/api/admin/dashboard':
            if not self._require_admin():
                return
            self.handle_admin_dashboard()
            return
        # ===== 游客感受度报告增强接口（管理员，GET） =====
        if path_only == '/api/admin/report/full':
            if not self._require_admin():
                return
            self.handle_admin_report_full()
            return
        # ===== AI公开接口（需访问口令 Cookie，不返回 api_key） =====
        if self.path == '/api/ai/models':
            if not self._is_authed():
                self.send_json(401, {'error': 'unauthorized', 'needLogin': True})
                return
            self.handle_ai_models_public()
            return
        if self.path == '/api/ai/config':
            if not self._is_authed():
                self.send_json(401, {'error': 'unauthorized', 'needLogin': True})
                return
            self.handle_ai_config_public()
            return
        # ===== 数字人公开接口：获取当前启用的形象（需访问口令） =====
        if self.path == '/api/avatars/active':
            if not self._is_authed():
                self.send_json(401, {'error': 'unauthorized', 'needLogin': True})
                return
            self.handle_avatars_active()
            return
        # 静态资源路径跳过认证，防止前端JS/CSS加载失败
        if self.path.startswith('/assets/') or self.path.startswith('/static/'):
            super().do_GET()
            return
        # 未登录：返回登录页
        if not self._is_authed():
            self._serve_login_page()
            return
        super().do_GET()

    def do_HEAD(self):
        if not self._is_authed():
            self.send_response(403)
            self.end_headers()
            return
        super().do_HEAD()

    def do_POST(self):
        # 登录接口：任何人可访问
        if self.path == '/api/login':
            self.handle_login()
            return
        # 关闭接口：仅允许本机调用（停止服务器.vbs 走 localhost），拒绝公网
        if self.path == '/api/shutdown':
            if self.client_address[0] in ('127.0.0.1', '::1'):
                self.handle_shutdown()
            else:
                self.send_json(403, {'error': 'forbidden'})
            return
        # ===== AI管理员登录接口（公开） =====
        if self.path == '/api/admin/ai/login':
            self.handle_admin_ai_login()
            return
        # ===== 对话日志接口（需访问口令） =====
        if self.path == '/api/chat/log':
            if not self._is_authed():
                self.send_json(401, {'error': 'unauthorized'})
                return
            self.handle_chat_log()
            return
        # ===== AI管理员接口：需管理员 token（独立于访问口令） =====
        if self.path.startswith('/api/admin/ai/'):
            if not self._require_admin():
                return
            if self.path == '/api/admin/ai/models':
                self.handle_admin_ai_models_create()
                return
            if self.path == '/api/admin/ai/models/toggle':
                self.handle_admin_ai_models_toggle()
                return
            # 兼容前端用 POST 调用编辑/删除/更新配置（标准做法走 PUT/DELETE）
            if self.path == '/api/admin/ai/models/update':
                self.handle_admin_ai_models_update()
                return
            if self.path == '/api/admin/ai/models/delete':
                self.handle_admin_ai_models_delete()
                return
            if self.path == '/api/admin/ai/config':
                self.handle_admin_ai_config_update()
                return
            self.send_error(404)
            return
        # ===== 数字人管理接口：需管理员 token =====
        if self.path.startswith('/api/admin/avatars'):
            if not self._require_admin():
                return
            if self.path == '/api/admin/avatars/upload':
                self.handle_admin_avatar_upload()
                return
            if self.path == '/api/admin/avatars/create':
                self.handle_admin_avatar_create()
                return
            if self.path == '/api/admin/avatars/update':
                self.handle_admin_avatar_update()
                return
            if self.path == '/api/admin/avatars/delete':
                self.handle_admin_avatar_delete()
                return
            if self.path == '/api/admin/avatars/activate':
                self.handle_admin_avatar_activate()
                return
            if self.path == '/api/admin/avatars/reset':
                self.handle_admin_avatar_reset()
                return
            self.send_error(404)
            return
        # ===== 知识库管理接口（管理员，POST） =====
        if self.path.startswith('/api/admin/knowledge/'):
            if not self._require_admin():
                return
            if self.path == '/api/admin/knowledge/create':
                self.handle_admin_knowledge_create()
                return
            if self.path == '/api/admin/knowledge/update':
                self.handle_admin_knowledge_update()
                return
            if self.path == '/api/admin/knowledge/delete':
                self.handle_admin_knowledge_delete()
                return
            if self.path == '/api/admin/knowledge/upload':
                self.handle_admin_knowledge_upload()
                return
            self.send_error(404)
            return
        # ===== 音色管理接口（管理员，POST） =====
        if self.path.startswith('/api/admin/voices/'):
            if not self._require_admin():
                return
            if self.path == '/api/admin/voices/create':
                self.handle_admin_voice_create()
                return
            if self.path == '/api/admin/voices/update':
                self.handle_admin_voice_update()
                return
            if self.path == '/api/admin/voices/delete':
                self.handle_admin_voice_delete()
                return
            self.send_error(404)
            return
        # ===== TTS 试听接口：需管理员 token =====
        if self.path == '/api/admin/tts/preview':
            if not self._require_admin():
                return
            self.handle_admin_tts_preview()
            return
        # ===== 游客用户接口：独立于访问口令，用游客 token 鉴权 =====
        if self.path == '/api/user/register':
            self.handle_user_register()
            return
        if self.path == '/api/user/login':
            self.handle_user_login()
            return
        if self.path == '/api/user/logout':
            self.handle_user_logout()
            return
        if self.path == '/api/user/info':
            self.handle_user_info()
            return
        if self.path == '/api/user/send_code':
            self.handle_user_send_code()
            return
        if self.path == '/api/user/reset_password':
            self.handle_user_reset_password()
            return
        # ===== 景点评价接口：列表公开 / 发表需游客 token（独立于访问口令） =====
        if self.path == '/api/reviews/list':
            self.handle_reviews_list()
            return
        if self.path == '/api/reviews/create':
            self.handle_reviews_create()
            return
        if self.path == '/api/reviews/delete':
            self.handle_reviews_delete()
            return
        # 以下接口需要访问口令登录，否则返回 401
        if not self._is_authed():
            self.send_json(401, {'error': 'unauthorized', 'needLogin': True})
            return
        # ===== AI代理接口（需访问口令 Cookie，防止公网盗刷） =====
        if self.path == '/api/ai/proxy/recognize':
            self.handle_ai_proxy_recognize()
            return
        if self.path == '/api/ai/proxy/qa':
            self.handle_ai_proxy_qa()
            return
        if self.path == '/api/ai/proxy/tts':
            self.handle_ai_proxy_tts()
            return
        # ===== AI增强AR功能接口（需访问口令 Cookie） =====
        if self.path == '/api/ar/ai/smart-recognize':
            self.handle_ar_smart_recognize()
            return
        if self.path == '/api/ar/ai/scene-understand':
            self.handle_ar_scene_understand()
            return
        if self.path == '/api/ar/ai/intent-predict':
            self.handle_ar_intent_predict()
            return
        if self.path == '/api/ar/ai/audit-log':
            self.handle_ar_audit_log()
            return
        # 原有 AI 接口
        if self.path == '/api/tts':
            self.handle_tts()
        elif self.path == '/api/chat':
            self.handle_chat()
        elif self.path == '/api/chat-vision':
            self.handle_chat_vision()
        else:
            self.send_error(404)

    def handle_login(self):
        """校验口令，通过则签发会话 cookie"""
        try:
            length = int(self.headers.get('Content-Length', 0))
            body = json.loads(self.rfile.read(length) or '{}')
            pass_ = body.get('pass', '')
        except Exception:
            pass_ = ''
        if not pass_ or pass_ != ACCESS_PASS:
            self.send_json(401, {'error': '口令错误'})
            return
        token = secrets.token_hex(16)
        with SESSIONS_LOCK:
            SESSIONS.add(token)
        body = json.dumps({'ok': True}).encode('utf-8')
        self.send_response(200)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Set-Cookie',
                         f'{COOKIE_NAME}={token}; HttpOnly; SameSite=Lax; Path=/; Max-Age={COOKIE_MAX_AGE}')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)
        print('登录成功，已签发会话。')

    # ===== 游客用户接口实现 =====
    def _read_json_body(self):
        try:
            length = int(self.headers.get('Content-Length', 0))
            if length > _MAX_REQUEST_BODY_SIZE:
                # 超过大小限制，返回空字典（调用方应检查必需字段）
                return {}
            return json.loads(self.rfile.read(length) or '{}')
        except Exception:
            return {}

    def _bearer_token(self):
        auth = self.headers.get('Authorization', '')
        return auth[7:] if auth.startswith('Bearer ') else ''

    def handle_user_register(self):
        if not _check_register_rate(self.client_address[0]):
            self.send_json(429, {'error': '操作过于频繁，请稍后再试'})
            return
        body = self._read_json_body()
        phone = str(body.get('phone', '')).strip()
        password = str(body.get('password', ''))
        age = body.get('age')
        nickname = str(body.get('nickname', '')).strip()
        gender = str(body.get('gender', '')).strip()
        if not PHONE_RE.match(phone):
            self.send_json(400, {'error': '手机号格式不正确'}); return
        if len(password) < 6:
            self.send_json(400, {'error': '密码至少6位'}); return
        try:
            age = int(age) if age not in (None, '') else None
        except (ValueError, TypeError):
            self.send_json(400, {'error': '年龄需为数字'}); return
        if age is not None and not (1 <= age <= 120):
            self.send_json(400, {'error': '年龄范围不合法'}); return
        if gender and gender not in ('male', 'female', 'other'):
            self.send_json(400, {'error': '性别参数不合法'}); return
        with DB_LOCK:
            conn = _db()
            try:
                if conn.execute('SELECT 1 FROM users WHERE phone=?', (phone,)).fetchone():
                    self.send_json(409, {'error': '该手机号已注册'}); return
                cur = conn.execute(
                    'INSERT INTO users (phone, password_hash, age, nickname, gender, created_at) VALUES (?,?,?,?,?,?)',
                    (phone, hash_password(password), age, nickname or None, gender or None,
                     time.strftime('%Y-%m-%d %H:%M:%S')))
                user_id = cur.lastrowid
                token = _create_session(conn, user_id)
                conn.commit()
            finally:
                conn.close()
        print(f'游客注册: {phone}')
        self.send_json(200, {'token': token, 'user': {
            'id': user_id, 'phone': phone, 'age': age,
            'nickname': nickname or ('游客' + phone[-4:]), 'gender': gender or None
        }})

    def handle_user_login(self):
        body = self._read_json_body()
        phone = str(body.get('phone', '')).strip()
        password = str(body.get('password', ''))
        if not PHONE_RE.match(phone) or not password:
            self.send_json(400, {'error': '手机号或密码不正确'}); return
        with DB_LOCK:
            conn = _db()
            try:
                row = conn.execute('SELECT * FROM users WHERE phone=?', (phone,)).fetchone()
            finally:
                conn.close()
        if not row or not verify_password(password, row['password_hash']):
            self.send_json(401, {'error': '手机号或密码不正确'}); return
        token = _issue_token(row['id'])
        print(f'游客登录: {phone}')
        self.send_json(200, {'token': token, 'user': _user_public(row)})

    def handle_user_info(self):
        row = _get_user_by_token(self._bearer_token())
        if not row:
            self.send_json(401, {'error': '未登录或登录已过期'}); return
        self.send_json(200, {'user': _user_public(row)})

    def handle_user_logout(self):
        token = self._bearer_token()
        if token:
            with DB_LOCK:
                conn = _db()
                try:
                    conn.execute('DELETE FROM user_sessions WHERE token=?', (token,))
                    conn.commit()
                finally:
                    conn.close()
        self.send_json(200, {'ok': True})

    def handle_user_send_code(self):
        """发送密码重置验证码：校验手机号格式 + 用户存在性 + 重发间隔，生成 6 位验证码入库。
        开发环境直接返回验证码供测试；生产环境应通过短信网关发送（此处仅打印日志）。"""
        if not _check_register_rate(self.client_address[0]):
            self.send_json(429, {'error': '操作过于频繁，请稍后再试'})
            return
        body = self._read_json_body()
        phone = str(body.get('phone', '')).strip()
        if not PHONE_RE.match(phone):
            self.send_json(400, {'error': '手机号格式不正确'})
            return
        now = time.time()
        with DB_LOCK:
            conn = _db()
            try:
                # 校验用户是否存在
                row = conn.execute('SELECT 1 FROM users WHERE phone=?', (phone,)).fetchone()
                if not row:
                    self.send_json(404, {'error': '该手机号未注册'})
                    return
                # 校验重发间隔
                existing = conn.execute(
                    'SELECT created_at FROM reset_codes WHERE phone=?', (phone,)
                ).fetchone()
                if existing and now - existing['created_at'] < RESET_CODE_RESEND_INTERVAL:
                    wait = int(RESET_CODE_RESEND_INTERVAL - (now - existing['created_at']))
                    self.send_json(429, {'error': f'请 {wait} 秒后再试'})
                    return
                # 生成 6 位数字验证码
                code = f'{secrets.randbelow(1000000):06d}'
                conn.execute(
                    'INSERT OR REPLACE INTO reset_codes (phone, code, created_at, expires_at, attempts) '
                    'VALUES (?,?,?,?,0)',
                    (phone, code, now, now + RESET_CODE_TTL)
                )
                conn.commit()
            finally:
                conn.close()
        # 生产环境此处应调用短信网关发送 code；当前为本地部署，打印日志即可
        print(f'[密码重置] 验证码已生成：{phone} -> {code}（有效期 {RESET_CODE_TTL // 60} 分钟）')
        # 开发环境返回验证码，便于无短信网关时测试；生产环境应改为 {ok: true}
        self.send_json(200, {'ok': True, 'code': code, 'ttl': RESET_CODE_TTL})

    def handle_user_reset_password(self):
        """校验验证码并重置密码：检查验证码有效性 + 尝试次数 + 新密码强度，更新密码后清除验证码。"""
        body = self._read_json_body()
        phone = str(body.get('phone', '')).strip()
        code = str(body.get('code', '')).strip()
        new_password = str(body.get('new_password', ''))
        if not PHONE_RE.match(phone):
            self.send_json(400, {'error': '手机号格式不正确'})
            return
        if not code or not new_password:
            self.send_json(400, {'error': '验证码和新密码不能为空'})
            return
        if len(new_password) < 6:
            self.send_json(400, {'error': '密码至少 6 位'})
            return
        now = time.time()
        with DB_LOCK:
            conn = _db()
            try:
                rec = conn.execute(
                    'SELECT * FROM reset_codes WHERE phone=?', (phone,)
                ).fetchone()
                # 验证码不存在或已过期
                if not rec or rec['expires_at'] < now:
                    if rec:
                        conn.execute('DELETE FROM reset_codes WHERE phone=?', (phone,))
                        conn.commit()
                    self.send_json(400, {'error': '验证码已过期，请重新获取'})
                    return
                # 尝试次数超限
                if rec['attempts'] >= RESET_CODE_MAX_ATTEMPTS:
                    conn.execute('DELETE FROM reset_codes WHERE phone=?', (phone,))
                    conn.commit()
                    self.send_json(429, {'error': '验证码错误次数过多，请重新获取'})
                    return
                # 验证码不匹配
                if not secrets.compare_digest(rec['code'], code):
                    conn.execute(
                        'UPDATE reset_codes SET attempts = attempts + 1 WHERE phone=?',
                        (phone,)
                    )
                    conn.commit()
                    remaining = RESET_CODE_MAX_ATTEMPTS - (rec['attempts'] + 1)
                    self.send_json(400, {'error': f'验证码错误，剩余 {remaining} 次机会'})
                    return
                # 验证通过，更新密码
                conn.execute(
                    'UPDATE users SET password_hash=? WHERE phone=?',
                    (hash_password(new_password), phone)
                )
                # 删除已使用的验证码
                conn.execute('DELETE FROM reset_codes WHERE phone=?', (phone,))
                conn.commit()
            finally:
                conn.close()
        print(f'[密码重置] 密码已重置：{phone}')
        self.send_json(200, {'ok': True})

    # ===== 景点评价接口实现 =====
    def handle_reviews_list(self):
        """获取某景点全部评价（公开，无需登录）"""
        body = self._read_json_body()
        spot_id = str(body.get('spot_id', '')).strip()
        if not spot_id:
            self.send_json(400, {'error': '缺少景点参数'})
            return
        conn = _db()
        try:
            rows = conn.execute(
                'SELECT id, spot_id, user_id, nickname, rating, content, created_at FROM spot_reviews '
                'WHERE spot_id=? ORDER BY created_at DESC, id DESC',
                (spot_id,)
            ).fetchall()
        finally:
            conn.close()
        reviews = [{
            'id': r['id'], 'spotId': r['spot_id'], 'userId': r['user_id'],
            'nickname': r['nickname'], 'rating': r['rating'],
            'content': r['content'], 'createdAt': r['created_at']
        } for r in rows]
        self.send_json(200, {'reviews': reviews})

    def handle_reviews_create(self):
        """发表评价（需游客登录，携带 Bearer token）"""
        row = _get_user_by_token(self._bearer_token())
        if not row:
            self.send_json(401, {'error': '请先登录后再发表评价'})
            return
        body = self._read_json_body()
        spot_id = str(body.get('spot_id', '')).strip()
        rating = body.get('rating')
        content = str(body.get('content', '')).strip()
        if not spot_id:
            self.send_json(400, {'error': '缺少景点参数'})
            return
        try:
            rating = int(rating)
        except (ValueError, TypeError):
            self.send_json(400, {'error': '评分需为数字'})
            return
        if not (1 <= rating <= 5):
            self.send_json(400, {'error': '评分范围为1-5'})
            return
        if not content or len(content) > 500:
            self.send_json(400, {'error': '评价内容为1-500字'})
            return
        nickname = row['nickname'] or ('游客' + row['phone'][-4:])
        created_at = time.strftime('%Y-%m-%d %H:%M:%S')
        with DB_LOCK:
            conn = _db()
            try:
                cur = conn.execute(
                    'INSERT INTO spot_reviews (spot_id, user_id, nickname, rating, content, created_at) '
                    'VALUES (?,?,?,?,?,?)',
                    (spot_id, row['id'], nickname, rating, content, created_at))
                conn.commit()
                rid = cur.lastrowid
            finally:
                conn.close()
        print(f'新评价: 景点{spot_id} 评分{rating} 来自{nickname}')
        self.send_json(200, {'review': {
            'id': rid, 'spotId': spot_id, 'userId': row['id'], 'nickname': nickname,
            'rating': rating, 'content': content, 'createdAt': created_at
        }})

    def handle_reviews_delete(self):
        """删除自己的评价（需登录，且只能删本人发的）"""
        row = _get_user_by_token(self._bearer_token())
        if not row:
            self.send_json(401, {'error': '请先登录'})
            return
        body = self._read_json_body()
        try:
            review_id = int(body.get('review_id', 0))
        except (ValueError, TypeError):
            review_id = 0
        if review_id <= 0:
            self.send_json(400, {'error': '缺少评价ID'})
            return
        with DB_LOCK:
            conn = _db()
            try:
                # 只允许删除本人发表的评价
                cur = conn.execute(
                    'DELETE FROM spot_reviews WHERE id=? AND user_id=?',
                    (review_id, row['id']))
                conn.commit()
                deleted = cur.rowcount
            finally:
                conn.close()
        if not deleted:
            self.send_json(403, {'error': '无权删除该评价'})
            return
        print(f'删除评价: id={review_id} 来自用户{row["id"]}')
        self.send_json(200, {'ok': True})

    def handle_tts(self):
        try:
            length = int(self.headers.get('Content-Length', 0))
            body = json.loads(self.rfile.read(length))
            text = body.get('text', '')
            if not text:
                self.send_json(400, {'error': 'text is required'})
                return
            print(f'TTS: {text[:30]}...')
            mp3 = asyncio.run(synthesize_tts(text))
            self.send_response(200)
            self.send_header('Content-Type', 'audio/mpeg')
            self.send_header('Content-Length', str(len(mp3)))
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(mp3)
            print(f'  -> {len(mp3)} bytes OK')
        except Exception as e:
            print(f'TTS Error: {e}')
            self.send_json(500, {'error': str(e)})

    def handle_shutdown(self):
        """优雅关闭：先回复再延迟退出，供 停止服务器.vbs 调用。"""
        self.send_json(200, {'status': 'shutting down'})

        def _stop():
            time.sleep(0.4)
            print('收到关闭请求，服务器退出。')
            os._exit(0)

        threading.Thread(target=_stop, daemon=True).start()

    def handle_chat(self):
        """代理智谱 GLM-4-Flash — 文本对话（硅基流动余额不足，改用智谱免费模型）"""
        self._proxy_ai(ZHIPU_URL, ZHIPU_KEY, '智谱GLM-4-Flash')

    def handle_chat_vision(self):
        """代理智谱AI — 多模态（图片+文字）"""
        self._proxy_ai(ZHIPU_URL, ZHIPU_KEY, '智谱GLM-4V')

    def _proxy_ai(self, target_url: str, api_key: str, label: str):
        try:
            length = int(self.headers.get('Content-Length', 0))
            body = self.rfile.read(length)
            print(f'Chat: 转发到 {label}...')
            req = urllib.request.Request(
                target_url,
                data=body,
                headers={
                    'Content-Type': 'application/json',
                    'Authorization': f'Bearer {api_key}'
                }
            )
            resp = urllib.request.urlopen(req, timeout=120)
            data = resp.read()
            self.send_response(200)
            self.send_header('Content-Type', 'text/event-stream' if b'data:' in data else 'application/json')
            self.send_header('Content-Length', str(len(data)))
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(data)
            print(f'Chat ({label}): OK {len(data)} bytes')
        except Exception as e:
            print(f'Chat ({label}) Error: {e}')
            self.send_json(500, {'error': str(e)})

    def send_json(self, code, data):
        body = json.dumps(data).encode('utf-8')
        self.send_response(code)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def handle_chat_log(self):
        """接收前端对话日志，存入 chat_logs 表供情感分析报告使用"""
        try:
            length = int(self.headers.get('Content-Length', 0))
            body = json.loads(self.rfile.read(length) or '{}')
            question = body.get('question', '')
            answer = body.get('answer', '')
            emotion = body.get('emotion', 'neutral')
            category = body.get('category', '')
            if not question or not answer:
                self.send_json(400, {'error': '缺少必要字段'})
                return
            conn = sqlite3.connect(DB_PATH)
            conn.execute(
                'INSERT INTO chat_logs (user_question, ai_answer, emotion, category, created_at) VALUES (?, ?, ?, ?, ?)',
                (question, answer, emotion, category, datetime.datetime.now().isoformat())
            )
            conn.commit()
            conn.close()
            self.send_json(200, {'ok': True})
        except Exception as e:
            self.send_json(500, {'error': str(e)})

    def handle_sentiment_report(self):
        """查询对话日志的情感统计数据，返回给管理端报告页面"""
        try:
            conn = sqlite3.connect(DB_PATH)
            # 统计情感分布
            rows = conn.execute('SELECT emotion, COUNT(*) as cnt FROM chat_logs GROUP BY emotion').fetchall()
            emotion_dist = {r[0]: r[1] for r in rows}
            total = sum(emotion_dist.values()) or 1

            # 按天统计最近7天的情感趋势
            seven_days_ago = (datetime.datetime.now() - datetime.timedelta(days=7)).isoformat()
            daily_rows = conn.execute(
                "SELECT DATE(created_at) as day, emotion, COUNT(*) as cnt FROM chat_logs WHERE created_at >= ? GROUP BY day, emotion ORDER BY day",
                (seven_days_ago,)
            ).fetchall()
            daily_trend = {}
            for day, emotion, cnt in daily_rows:
                if day not in daily_trend:
                    daily_trend[day] = {'positive': 0, 'neutral': 0, 'negative': 0, 'total': 0}
                daily_trend[day][emotion] = cnt
                daily_trend[day]['total'] += cnt

            # 统计热门问题关键词
            questions = conn.execute('SELECT user_question FROM chat_logs ORDER BY id DESC LIMIT 100').fetchall()
            keyword_count = {}
            for (q,) in questions:
                for kw in ['大佛', '梵宫', '九龙灌浴', '五印坛城', '祥符禅寺', '门票', '路线', '交通', '素斋', '时间', '住宿', '停车']:
                    if kw in q:
                        keyword_count[kw] = keyword_count.get(kw, 0) + 1
            hot_keywords = sorted(keyword_count.items(), key=lambda x: -x[1])[:10]

            # 最近5条负面情绪对话
            negative_logs = conn.execute(
                "SELECT user_question, ai_answer, created_at FROM chat_logs WHERE emotion='negative' ORDER BY id DESC LIMIT 5"
            ).fetchall()

            conn.close()
            self.send_json(200, {
                'total': total,
                'emotionDist': {
                    'positive': emotion_dist.get('positive', 0),
                    'neutral': emotion_dist.get('neutral', 0),
                    'negative': emotion_dist.get('negative', 0),
                },
                'dailyTrend': daily_trend,
                'hotKeywords': hot_keywords,
                'negativeLogs': [{'question': r[0], 'answer': r[1], 'time': r[2]} for r in negative_logs],
            })
        except Exception as e:
            self.send_json(500, {'error': str(e)})

    # ===== AI模型管理：管理员鉴权 =====
    def _require_admin(self):
        """验证管理员 token（从 Authorization Bearer 提取），失败返回 401。成功返回 True。"""
        token = self._bearer_token()
        if not _verify_admin_token(token):
            self.send_json(401, {'error': '管理员未登录或token已过期'})
            return False
        return True

    def _send_audio(self, data: bytes):
        """发送音频二进制响应"""
        self.send_response(200)
        self.send_header('Content-Type', 'audio/mpeg')
        self.send_header('Content-Length', str(len(data)))
        self.send_header('Access-Control-Allow-Origin', '*')
        self.end_headers()
        self.wfile.write(data)

    # ===== AI管理员登录（公开） =====
    def handle_admin_ai_login(self):
        """管理员登录，签发 token"""
        body = self._read_json_body()
        username = str(body.get('username', '')).strip()
        password = str(body.get('password', ''))
        if username != ADMIN_USERNAME or password != ADMIN_PASSWORD:
            self.send_json(401, {'error': '用户名或密码错误'})
            return
        token, expires_at = _create_admin_session()
        print(f'管理员登录: {username}')
        self.send_json(200, {'token': token, 'expires_at': expires_at})

    # ===== AI模型管理 CRUD（需管理员 token） =====
    def handle_admin_ai_models_list(self):
        """获取全部模型列表（含 api_key，仅管理员）"""
        conn = _db()
        try:
            rows = conn.execute(
                'SELECT id, name, provider_type, role, api_url, api_key, model_name, context_limit, status, created_at '
                'FROM ai_models ORDER BY id DESC'
            ).fetchall()
        finally:
            conn.close()
        models = [{
            'id': r['id'], 'name': r['name'], 'provider_type': r['provider_type'],
            'role': r['role'], 'api_url': r['api_url'], 'api_key': r['api_key'],
            'model_name': r['model_name'], 'context_limit': r['context_limit'],
            'status': r['status'], 'created_at': r['created_at']
        } for r in rows]
        self.send_json(200, {'models': models})

    def handle_admin_ai_models_create(self):
        """新增模型"""
        body = self._read_json_body()
        name = str(body.get('name', '')).strip()
        provider_type = str(body.get('provider_type', '')).strip()
        role = str(body.get('role', '')).strip()
        api_url = str(body.get('api_url', '')).strip()
        api_key = str(body.get('api_key', '')).strip()
        model_name = str(body.get('model_name', '')).strip()
        if not name or not provider_type or not role or not api_url or not api_key or not model_name:
            self.send_json(400, {'error': '缺少必填字段'})
            return
        if provider_type not in ('glm', 'deepseek', 'qwen', 'minimax', 'edge_tts', 'custom'):
            self.send_json(400, {'error': 'provider_type 不合法'})
            return
        if role not in ('recognition', 'qa', 'tts'):
            self.send_json(400, {'error': 'role 不合法'})
            return
        try:
            context_limit = int(body.get('context_limit', 4096))
        except (ValueError, TypeError):
            context_limit = 4096
        status = str(body.get('status', 'enabled')).strip()
        if status not in ('enabled', 'disabled'):
            status = 'enabled'
        created_at = time.strftime('%Y-%m-%d %H:%M:%S')
        with DB_LOCK:
            conn = _db()
            try:
                cur = conn.execute(
                    'INSERT INTO ai_models (name, provider_type, role, api_url, api_key, model_name, context_limit, status, created_at) '
                    'VALUES (?,?,?,?,?,?,?,?,?)',
                    (name, provider_type, role, api_url, api_key, model_name, context_limit, status, created_at)
                )
                conn.commit()
                new_id = cur.lastrowid
            finally:
                conn.close()
        print(f'新增AI模型: {name} ({provider_type}/{role})')
        self.send_json(200, {'model': {
            'id': new_id, 'name': name, 'provider_type': provider_type, 'role': role,
            'api_url': api_url, 'api_key': api_key, 'model_name': model_name,
            'context_limit': context_limit, 'status': status, 'created_at': created_at
        }})

    def handle_admin_ai_models_update(self):
        """编辑模型（PUT / POST body 带 id）"""
        body = self._read_json_body()
        try:
            model_id = int(body.get('id', 0))
        except (ValueError, TypeError):
            model_id = 0
        if model_id <= 0:
            self.send_json(400, {'error': '缺少模型ID'})
            return
        with DB_LOCK:
            conn = _db()
            try:
                row = conn.execute('SELECT * FROM ai_models WHERE id=?', (model_id,)).fetchone()
                if not row:
                    self.send_json(404, {'error': '模型不存在'})
                    return
                # 仅更新提供的字段
                fields = {}
                for key in ('name', 'provider_type', 'role', 'api_url', 'api_key', 'model_name'):
                    val = body.get(key)
                    if val is not None and str(val).strip() != '':
                        fields[key] = str(val).strip()
                if 'context_limit' in body:
                    try:
                        fields['context_limit'] = int(body['context_limit'])
                    except (ValueError, TypeError):
                        pass
                if 'status' in body:
                    status_val = str(body['status']).strip()
                    if status_val in ('enabled', 'disabled'):
                        fields['status'] = status_val
                if 'provider_type' in fields and fields['provider_type'] not in ('glm', 'deepseek', 'qwen', 'minimax', 'edge_tts', 'custom'):
                    self.send_json(400, {'error': 'provider_type 不合法'})
                    return
                if 'role' in fields and fields['role'] not in ('recognition', 'qa', 'tts'):
                    self.send_json(400, {'error': 'role 不合法'})
                    return
                if fields:
                    set_clause = ', '.join([f'{k}=?' for k in fields.keys()])
                    params = list(fields.values()) + [model_id]
                    conn.execute(f'UPDATE ai_models SET {set_clause} WHERE id=?', params)
                    conn.commit()
                row = conn.execute('SELECT * FROM ai_models WHERE id=?', (model_id,)).fetchone()
            finally:
                conn.close()
        self.send_json(200, {'model': {
            'id': row['id'], 'name': row['name'], 'provider_type': row['provider_type'],
            'role': row['role'], 'api_url': row['api_url'], 'api_key': row['api_key'],
            'model_name': row['model_name'], 'context_limit': row['context_limit'],
            'status': row['status'], 'created_at': row['created_at']
        }})

    def handle_admin_ai_models_delete(self):
        """删除模型"""
        body = self._read_json_body()
        try:
            model_id = int(body.get('id', 0))
        except (ValueError, TypeError):
            model_id = 0
        if model_id <= 0:
            self.send_json(400, {'error': '缺少模型ID'})
            return
        with DB_LOCK:
            conn = _db()
            try:
                cur = conn.execute('DELETE FROM ai_models WHERE id=?', (model_id,))
                conn.commit()
                deleted = cur.rowcount
                # 同步清除全局配置中对该模型的引用，避免悬空外键
                if deleted:
                    conn.execute(
                        'UPDATE ai_global_config SET '
                        'default_recognition_model_id = CASE WHEN default_recognition_model_id=? THEN NULL ELSE default_recognition_model_id END, '
                        'default_qa_model_id = CASE WHEN default_qa_model_id=? THEN NULL ELSE default_qa_model_id END, '
                        'default_tts_model_id = CASE WHEN default_tts_model_id=? THEN NULL ELSE default_tts_model_id END '
                        'WHERE id=1',
                        (model_id, model_id, model_id)
                    )
                    conn.commit()
            finally:
                conn.close()
        if not deleted:
            self.send_json(404, {'error': '模型不存在'})
            return
        print(f'删除AI模型: id={model_id}')
        self.send_json(200, {'ok': True})

    def handle_admin_ai_models_toggle(self):
        """启用/禁用切换"""
        body = self._read_json_body()
        try:
            model_id = int(body.get('id', 0))
        except (ValueError, TypeError):
            model_id = 0
        if model_id <= 0:
            self.send_json(400, {'error': '缺少模型ID'})
            return
        with DB_LOCK:
            conn = _db()
            try:
                row = conn.execute('SELECT status FROM ai_models WHERE id=?', (model_id,)).fetchone()
                if not row:
                    self.send_json(404, {'error': '模型不存在'})
                    return
                new_status = 'disabled' if row['status'] == 'enabled' else 'enabled'
                conn.execute('UPDATE ai_models SET status=? WHERE id=?', (new_status, model_id))
                conn.commit()
                row = conn.execute('SELECT * FROM ai_models WHERE id=?', (model_id,)).fetchone()
            finally:
                conn.close()
        self.send_json(200, {'model': {
            'id': row['id'], 'name': row['name'], 'provider_type': row['provider_type'],
            'role': row['role'], 'api_url': row['api_url'], 'api_key': row['api_key'],
            'model_name': row['model_name'], 'context_limit': row['context_limit'],
            'status': row['status'], 'created_at': row['created_at']
        }})

    # ===== AI全局配置（需管理员 token） =====
    def handle_admin_ai_config_get(self):
        """获取全局配置"""
        conn = _db()
        try:
            row = conn.execute(
                'SELECT default_recognition_model_id, default_qa_model_id, default_tts_model_id, timeout_seconds '
                'FROM ai_global_config WHERE id=1'
            ).fetchone()
        finally:
            conn.close()
        self.send_json(200, {'config': {
            'default_recognition_model_id': row['default_recognition_model_id'] if row else None,
            'default_qa_model_id': row['default_qa_model_id'] if row else None,
            'default_tts_model_id': row['default_tts_model_id'] if row else None,
            'timeout_seconds': row['timeout_seconds'] if row else 30
        }})

    def handle_admin_ai_config_update(self):
        """更新全局配置"""
        body = self._read_json_body()
        fields = {}
        for key in ('default_recognition_model_id', 'default_qa_model_id', 'default_tts_model_id'):
            if key in body:
                val = body.get(key)
                if val is None:
                    fields[key] = None
                else:
                    try:
                        fields[key] = int(val)
                    except (ValueError, TypeError):
                        pass
        if 'timeout_seconds' in body:
            try:
                fields['timeout_seconds'] = int(body['timeout_seconds'])
            except (ValueError, TypeError):
                pass
        with DB_LOCK:
            conn = _db()
            try:
                # 确保记录存在
                row = conn.execute('SELECT id FROM ai_global_config WHERE id=1').fetchone()
                if not row:
                    conn.execute(
                        'INSERT INTO ai_global_config (id, default_recognition_model_id, default_qa_model_id, default_tts_model_id, timeout_seconds) '
                        'VALUES (1, NULL, NULL, NULL, 30)'
                    )
                if fields:
                    set_clause = ', '.join([f'{k}=?' for k in fields.keys()])
                    params = list(fields.values()) + [1]
                    conn.execute(f'UPDATE ai_global_config SET {set_clause} WHERE id=?', params)
                conn.commit()
                row = conn.execute(
                    'SELECT default_recognition_model_id, default_qa_model_id, default_tts_model_id, timeout_seconds '
                    'FROM ai_global_config WHERE id=1'
                ).fetchone()
            finally:
                conn.close()
        self.send_json(200, {'config': {
            'default_recognition_model_id': row['default_recognition_model_id'],
            'default_qa_model_id': row['default_qa_model_id'],
            'default_tts_model_id': row['default_tts_model_id'],
            'timeout_seconds': row['timeout_seconds']
        }})

    # ===== AI公开接口（需访问口令 Cookie，不需要管理员 token） =====
    def handle_ai_models_public(self):
        """获取已启用的模型列表（不含 api_key，供前端下拉选择）"""
        conn = _db()
        try:
            rows = conn.execute(
                'SELECT id, name, provider_type, role, model_name, context_limit FROM ai_models '
                'WHERE status=? ORDER BY role, id',
                ('enabled',)
            ).fetchall()
        finally:
            conn.close()
        # 按 role 分组返回，方便前端使用
        grouped = {}
        for r in rows:
            grouped.setdefault(r['role'], []).append({
                'id': r['id'], 'name': r['name'], 'provider_type': r['provider_type'],
                'model_name': r['model_name'], 'context_limit': r['context_limit']
            })
        models = [{
            'id': r['id'], 'name': r['name'], 'provider_type': r['provider_type'],
            'role': r['role'], 'model_name': r['model_name'], 'context_limit': r['context_limit'],
            'status': 'enabled'
        } for r in rows]
        self.send_json(200, {'models': models, 'grouped': grouped})

    def handle_ai_config_public(self):
        """获取全局配置（公开接口，需访问口令，不含敏感信息）"""
        conn = _db()
        try:
            row = conn.execute(
                'SELECT default_recognition_model_id, default_qa_model_id, '
                'default_tts_model_id, timeout_seconds FROM ai_global_config WHERE id=1'
            ).fetchone()
        finally:
            conn.close()
        self.send_json(200, {'config': {
            'default_recognition_model_id': row['default_recognition_model_id'] if row else None,
            'default_qa_model_id': row['default_qa_model_id'] if row else None,
            'default_tts_model_id': row['default_tts_model_id'] if row else None,
            'timeout_seconds': row['timeout_seconds'] if row else 30
        }})

    # ===== 数字人形象管理接口 =====

    @staticmethod
    def _avatar_row_to_dict(row):
        """将 avatars 表行转为前端可用的 dict"""
        vrm_path = row['vrm_path']
        # 判断是否为内置数字人（非 uploaded 目录的为内置）
        is_builtin = '/uploaded/' not in vrm_path
        return {
            'id': row['id'],
            'name': row['name'],
            'vrm_path': vrm_path,
            'voice_type': row['voice_type'],
            'model_scale': row['model_scale'],
            'position_x': row['position_x'],
            'position_y': row['position_y'],
            'rotation_y': row['rotation_y'],
            'is_active': bool(row['is_active']),
            'is_builtin': is_builtin,
            'file_size': row['file_size'],
            'created_at': row['created_at'],
            'updated_at': row['updated_at'],
        }

    def handle_admin_avatars_list(self):
        """获取全部数字人形象列表（管理员）"""
        conn = _db()
        try:
            rows = conn.execute('SELECT * FROM avatars ORDER BY is_active DESC, created_at ASC').fetchall()
        finally:
            conn.close()
        avatars = [self._avatar_row_to_dict(r) for r in rows]
        self.send_json(200, {'avatars': avatars})

    def handle_admin_voices_list(self):
        """获取音色列表（管理员，从数据库读取，包含内置+自定义）"""
        conn = _db()
        try:
            rows = conn.execute(
                'SELECT * FROM voices ORDER BY is_builtin DESC, created_at ASC'
            ).fetchall()
        finally:
            conn.close()
        voices = [self._voice_row_to_dict(r) for r in rows]
        self.send_json(200, {'voices': voices})

    @staticmethod
    def _voice_row_to_dict(row):
        """将 voices 表行转为前端可用的 dict"""
        return {
            'id': row['id'],
            'name': row['name'],
            'edge_voice': row['edge_voice'],
            'audio_path': row['audio_path'] or '',
            'description': row['description'] or '',
            'is_builtin': bool(row['is_builtin']),
            'created_at': row['created_at'],
            'updated_at': row['updated_at'],
        }

    def handle_admin_voice_create(self):
        """添加自定义音色（管理员，multipart/form-data：name, edge_voice, description, audio文件）"""
        content_type = self.headers.get('Content-Type', '')
        if 'multipart/form-data' not in content_type:
            self.send_json(400, {'error': '需要 multipart/form-data 格式'})
            return
        length = int(self.headers.get('Content-Length', 0))
        if length == 0:
            self.send_json(400, {'error': '请求体为空'})
            return
        if length > 20 * 1024 * 1024:
            self.send_json(413, {'error': '文件过大，上限 20MB'})
            return
        body = self.rfile.read(length)
        parts = self._parse_multipart(body, content_type)
        # 解析文本字段
        def _field(name):
            p = parts.get(name)
            if p and p.get('data'):
                return p['data'].decode('utf-8', errors='replace').strip()
            return ''
        name = _field('name')
        edge_voice = _field('edge_voice')
        description = _field('description')
        if not name:
            self.send_json(400, {'error': '音色名称必填'})
            return
        if not edge_voice:
            self.send_json(400, {'error': '必须选择对应的 edge-tts 音色'})
            return
        # 处理音频文件
        audio_path = ''
        audio_part = parts.get('audio')
        if audio_part and audio_part.get('filename'):
            filename = audio_part['filename']
            ext = os.path.splitext(filename)[1].lower()
            if ext not in ('.mp3', '.wav', '.m4a', '.ogg'):
                self.send_json(400, {'error': '音频格式仅支持 mp3/wav/m4a/ogg'})
                return
            # 保存到 static/avatars/voices/
            voices_dir = os.path.join(STATIC_DIR, 'static', 'avatars', 'voices')
            os.makedirs(voices_dir, exist_ok=True)
            timestamp = int(time.time() * 1000)
            save_name = f'voice_{timestamp}{ext}'
            save_path = os.path.join(voices_dir, save_name)
            with open(save_path, 'wb') as f:
                f.write(audio_part['data'])
            audio_path = f'/static/avatars/voices/{save_name}'
        now = datetime.datetime.now().isoformat()
        with DB_LOCK:
            conn = _db()
            try:
                cur = conn.execute(
                    'INSERT INTO voices (name, edge_voice, audio_path, description, is_builtin, created_at, updated_at) '
                    'VALUES (?, ?, ?, ?, 0, ?, ?)',
                    (name, edge_voice, audio_path, description, now, now)
                )
                conn.commit()
                row = conn.execute('SELECT * FROM voices WHERE id=?', (cur.lastrowid,)).fetchone()
            finally:
                conn.close()
        self.send_json(200, {'voice': self._voice_row_to_dict(row)})

    def handle_admin_voice_update(self):
        """更新音色信息（管理员，JSON，仅名称/描述可改）"""
        body = self._read_json_body()
        try:
            vid = int(body.get('id', 0))
        except (ValueError, TypeError):
            vid = 0
        if not vid:
            self.send_json(400, {'error': '缺少 id'})
            return
        name = str(body.get('name', '')).strip()
        description = str(body.get('description', '')).strip()
        if not name:
            self.send_json(400, {'error': '名称必填'})
            return
        now = datetime.datetime.now().isoformat()
        with DB_LOCK:
            conn = _db()
            try:
                row = conn.execute('SELECT id FROM voices WHERE id=?', (vid,)).fetchone()
                if not row:
                    self.send_json(404, {'error': '音色不存在'})
                    return
                conn.execute(
                    'UPDATE voices SET name=?, description=?, updated_at=? WHERE id=?',
                    (name, description, now, vid)
                )
                conn.commit()
                row = conn.execute('SELECT * FROM voices WHERE id=?', (vid,)).fetchone()
            finally:
                conn.close()
        self.send_json(200, {'voice': self._voice_row_to_dict(row)})

    def handle_admin_voice_delete(self):
        """删除音色（管理员，JSON，仅非内置可删）"""
        body = self._read_json_body()
        try:
            vid = int(body.get('id', 0))
        except (ValueError, TypeError):
            vid = 0
        if not vid:
            self.send_json(400, {'error': '缺少 id'})
            return
        with DB_LOCK:
            conn = _db()
            try:
                row = conn.execute('SELECT id, is_builtin, audio_path FROM voices WHERE id=?', (vid,)).fetchone()
                if not row:
                    self.send_json(404, {'error': '音色不存在'})
                    return
                if row['is_builtin']:
                    self.send_json(400, {'error': '内置音色不可删除'})
                    return
                # 删除音频文件
                if row['audio_path']:
                    audio_full = os.path.join(STATIC_DIR, row['audio_path'].lstrip('/'))
                    if os.path.exists(audio_full):
                        try:
                            os.remove(audio_full)
                        except Exception:
                            pass
                conn.execute('DELETE FROM voices WHERE id=?', (vid,))
                conn.commit()
            finally:
                conn.close()
        self.send_json(200, {'ok': True})

    def handle_admin_voice_audio(self):
        """获取音色音频样本（管理员，GET /api/admin/voices/audio?id=xx）"""
        from urllib.parse import urlparse, parse_qs
        qs = parse_qs(urlparse(self.path).query)
        try:
            vid = int(qs.get('id', ['0'])[0])
        except (ValueError, TypeError):
            vid = 0
        if not vid:
            self.send_json(400, {'error': '缺少 id'})
            return
        conn = _db()
        try:
            row = conn.execute('SELECT audio_path FROM voices WHERE id=?', (vid,)).fetchone()
        finally:
            conn.close()
        if not row or not row['audio_path']:
            self.send_json(404, {'error': '无音频样本'})
            return
        audio_full = os.path.join(STATIC_DIR, row['audio_path'].lstrip('/'))
        if not os.path.exists(audio_full):
            self.send_json(404, {'error': '音频文件不存在'})
            return
        ext = os.path.splitext(audio_full)[1].lower()
        ct = {'.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.m4a': 'audio/mp4', '.ogg': 'audio/ogg'}.get(ext, 'audio/mpeg')
        with open(audio_full, 'rb') as f:
            data = f.read()
        self.send_response(200)
        self.send_header('Content-Type', ct)
        self.send_header('Content-Length', str(len(data)))
        self.send_header('Cache-Control', 'no-store')
        self.end_headers()
        self.wfile.write(data)

    def handle_avatars_active(self):
        """获取当前启用的数字人形象（公开接口，需访问口令）"""
        conn = _db()
        try:
            row = conn.execute('SELECT * FROM avatars WHERE is_active=1 LIMIT 1').fetchone()
        finally:
            conn.close()
        if not row:
            self.send_json(404, {'error': '未配置启用的数字人形象'})
            return
        self.send_json(200, {'avatar': self._avatar_row_to_dict(row)})

    def _parse_multipart(self, body: bytes, content_type: str):
        """简易 multipart/form-data 解析器，返回 {field_name: {'filename': str|None, 'data': bytes}}"""
        boundary = None
        for part in content_type.split(';'):
            part = part.strip()
            if part.startswith('boundary='):
                boundary = part[len('boundary='):]
                # 去掉可能的引号
                if boundary.startswith('"') and boundary.endswith('"'):
                    boundary = boundary[1:-1]
                break
        if not boundary:
            return {}
        boundary_bytes = ('--' + boundary).encode('utf-8')
        result = {}
        segments = body.split(boundary_bytes)
        for seg in segments:
            seg = seg.strip(b'\r\n')
            if not seg or seg == b'--' or seg == b'--\r\n':
                continue
            header_end = seg.find(b'\r\n\r\n')
            if header_end < 0:
                continue
            header_str = seg[:header_end].decode('utf-8', errors='replace')
            content = seg[header_end + 4:]
            # 去掉尾部 \r\n
            if content.endswith(b'\r\n'):
                content = content[:-2]
            name = None
            filename = None
            for line in header_str.split('\r\n'):
                if line.lower().startswith('content-disposition:'):
                    for field in line.split(';'):
                        field = field.strip()
                        if field.startswith('name='):
                            name = field[5:].strip('"')
                        elif field.startswith('filename='):
                            filename = field[9:].strip('"')
            if name:
                result[name] = {'filename': filename, 'data': content}
        return result

    def handle_admin_avatar_upload(self):
        """上传 VRM 模型文件（管理员，multipart/form-data）"""
        content_type = self.headers.get('Content-Type', '')
        if 'multipart/form-data' not in content_type:
            self.send_json(400, {'error': '需要 multipart/form-data 格式'})
            return
        length = int(self.headers.get('Content-Length', 0))
        if length == 0:
            self.send_json(400, {'error': '请求体为空'})
            return
        if length > 100 * 1024 * 1024:  # 100MB 上限
            self.send_json(413, {'error': '文件过大，上限 100MB'})
            return
        body = self.rfile.read(length)
        fields = self._parse_multipart(body, content_type)
        file_info = fields.get('file')
        if not file_info or not file_info['filename']:
            self.send_json(400, {'error': '缺少 file 字段或文件名'})
            return
        filename = file_info['filename']
        if not filename.lower().endswith('.vrm'):
            self.send_json(400, {'error': '仅支持 .vrm 格式文件'})
            return
        # 安全文件名：只用文件名部分，去掉路径，加时间戳防冲突
        safe_name = os.path.basename(filename).replace(' ', '_')
        safe_name = f'{int(time.time())}_{safe_name}'
        upload_dir = os.path.join(STATIC_DIR, 'static', 'avatars', 'uploaded')
        os.makedirs(upload_dir, exist_ok=True)
        file_path = os.path.join(upload_dir, safe_name)
        with open(file_path, 'wb') as f:
            f.write(file_info['data'])
        file_size = len(file_info['data'])
        url_path = f'/static/avatars/uploaded/{safe_name}'
        print(f'[Avatar] VRM 上传成功: {safe_name}, {file_size} bytes')
        self.send_json(200, {
            'vrm_path': url_path,
            'file_size': file_size,
            'filename': safe_name,
        })

    def handle_admin_avatar_create(self):
        """新建数字人形象配置（管理员，JSON）"""
        body = self._read_json_body()
        name = str(body.get('name', '')).strip()
        vrm_path = str(body.get('vrm_path', '')).strip()
        if not name or not vrm_path:
            self.send_json(400, {'error': '名称和 VRM 路径不能为空'})
            return
        voice_type = str(body.get('voice_type', 'zh-CN-XiaoxiaoNeural'))
        model_scale = float(body.get('model_scale', 2.6))
        position_x = float(body.get('position_x', 0))
        position_y = float(body.get('position_y', 0))
        rotation_y = float(body.get('rotation_y', 0))
        file_size = int(body.get('file_size', 0))
        now = datetime.datetime.now().isoformat()
        with DB_LOCK:
            conn = _db()
            try:
                cur = conn.execute(
                    'INSERT INTO avatars (name, vrm_path, voice_type, model_scale, position_x, position_y, rotation_y, is_active, file_size, created_at, updated_at) '
                    'VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?)',
                    (name, vrm_path, voice_type, model_scale, position_x, position_y, rotation_y, file_size, now, now)
                )
                conn.commit()
                new_id = cur.lastrowid
                row = conn.execute('SELECT * FROM avatars WHERE id=?', (new_id,)).fetchone()
            finally:
                conn.close()
        self.send_json(200, {'avatar': self._avatar_row_to_dict(row)})

    def handle_admin_avatar_update(self):
        """更新数字人形象配置（管理员，JSON）"""
        body = self._read_json_body()
        avatar_id = int(body.get('id', 0))
        if not avatar_id:
            self.send_json(400, {'error': '缺少 id'})
            return
        name = str(body.get('name', '')).strip()
        vrm_path = str(body.get('vrm_path', '')).strip()
        voice_type = str(body.get('voice_type', 'zh-CN-XiaoxiaoNeural'))
        model_scale = float(body.get('model_scale', 2.6))
        position_x = float(body.get('position_x', 0))
        position_y = float(body.get('position_y', 0))
        rotation_y = float(body.get('rotation_y', 0))
        now = datetime.datetime.now().isoformat()
        with DB_LOCK:
            conn = _db()
            try:
                row = conn.execute('SELECT * FROM avatars WHERE id=?', (avatar_id,)).fetchone()
                if not row:
                    self.send_json(404, {'error': '数字人形象不存在'})
                    return
                conn.execute(
                    'UPDATE avatars SET name=?, vrm_path=?, voice_type=?, model_scale=?, position_x=?, position_y=?, rotation_y=?, updated_at=? WHERE id=?',
                    (name, vrm_path, voice_type, model_scale, position_x, position_y, rotation_y, now, avatar_id)
                )
                conn.commit()
                row = conn.execute('SELECT * FROM avatars WHERE id=?', (avatar_id,)).fetchone()
            finally:
                conn.close()
        self.send_json(200, {'avatar': self._avatar_row_to_dict(row)})

    def handle_admin_avatar_delete(self):
        """删除数字人形象（管理员，JSON）"""
        body = self._read_json_body()
        avatar_id = int(body.get('id', 0))
        if not avatar_id:
            self.send_json(400, {'error': '缺少 id'})
            return
        with DB_LOCK:
            conn = _db()
            try:
                row = conn.execute('SELECT is_active, vrm_path FROM avatars WHERE id=?', (avatar_id,)).fetchone()
                if not row:
                    self.send_json(404, {'error': '数字人形象不存在'})
                    return
                if row['is_active']:
                    self.send_json(400, {'error': '不能删除当前启用的数字人形象'})
                    return
                # 删除上传的 VRM 文件（仅删除 uploaded/ 目录下的）
                vrm_path = row['vrm_path']
                if '/uploaded/' in vrm_path:
                    file_full = os.path.join(STATIC_DIR, vrm_path.lstrip('/'))
                    if os.path.exists(file_full):
                        try:
                            os.remove(file_full)
                        except Exception:
                            pass
                conn.execute('DELETE FROM avatars WHERE id=?', (avatar_id,))
                conn.commit()
            finally:
                conn.close()
        self.send_json(200, {'ok': True})

    def handle_admin_avatar_activate(self):
        """启用指定数字人形象（管理员，JSON）"""
        body = self._read_json_body()
        avatar_id = int(body.get('id', 0))
        if not avatar_id:
            self.send_json(400, {'error': '缺少 id'})
            return
        with DB_LOCK:
            conn = _db()
            try:
                row = conn.execute('SELECT id FROM avatars WHERE id=?', (avatar_id,)).fetchone()
                if not row:
                    self.send_json(404, {'error': '数字人形象不存在'})
                    return
                conn.execute('UPDATE avatars SET is_active=0')
                conn.execute('UPDATE avatars SET is_active=1, updated_at=? WHERE id=?',
                             (datetime.datetime.now().isoformat(), avatar_id))
                conn.commit()
                row = conn.execute('SELECT * FROM avatars WHERE id=?', (avatar_id,)).fetchone()
            finally:
                conn.close()
        self.send_json(200, {'avatar': self._avatar_row_to_dict(row)})

    def handle_admin_avatar_reset(self):
        """重置数字人列表：清空全部（含上传VRM文件），重新初始化3个内置数字人（管理员）"""
        with DB_LOCK:
            conn = _db()
            try:
                # 删除上传的 VRM 文件
                uploaded_rows = conn.execute(
                    "SELECT vrm_path FROM avatars WHERE vrm_path LIKE '%/uploaded/%'"
                ).fetchall()
                for r in uploaded_rows:
                    file_full = os.path.join(STATIC_DIR, r['vrm_path'].lstrip('/'))
                    if os.path.exists(file_full):
                        try:
                            os.remove(file_full)
                        except Exception:
                            pass
                # 清空 avatars 表
                conn.execute('DELETE FROM avatars')
                # 重新初始化内置数字人
                now = datetime.datetime.now().isoformat()
                builtin_avatars = [
                    {'name': '小乐（默认）', 'vrm_path': '/static/avatars/use_for_app1.vrm',
                     'voice_type': 'zh-CN-XiaoxiaoNeural', 'model_scale': 3.25, 'is_active': 1},
                    {'name': '小雅', 'vrm_path': '/static/avatars/use_for_app2.vrm',
                     'voice_type': 'zh-CN-XiaoyiNeural', 'model_scale': 3.25, 'is_active': 0},
                    {'name': '小慧', 'vrm_path': '/static/avatars/use_for_app3.vrm',
                     'voice_type': 'zh-CN-XiaohanNeural', 'model_scale': 3.25, 'is_active': 0},
                ]
                for av in builtin_avatars:
                    vrm_full = os.path.join(STATIC_DIR, av['vrm_path'].lstrip('/'))
                    file_size = os.path.getsize(vrm_full) if os.path.exists(vrm_full) else 0
                    conn.execute(
                        'INSERT INTO avatars (name, vrm_path, voice_type, model_scale, position_x, position_y, rotation_y, is_active, file_size, created_at, updated_at) '
                        'VALUES (?, ?, ?, ?, 0, 0, 0, ?, ?, ?, ?)',
                        (av['name'], av['vrm_path'], av['voice_type'], av['model_scale'],
                         av['is_active'], file_size, now, now)
                    )
                conn.commit()
                rows = conn.execute('SELECT * FROM avatars ORDER BY is_active DESC, created_at ASC').fetchall()
            finally:
                conn.close()
        avatars = [self._avatar_row_to_dict(r) for r in rows]
        self.send_json(200, {'avatars': avatars, 'reset': True})

    def handle_admin_tts_preview(self):
        """TTS 音色试听（管理员，JSON）→ 返回 mp3 音频"""
        body = self._read_json_body()
        text = str(body.get('text', '')).strip()
        voice = str(body.get('voice', '')).strip()
        if not text:
            text = '你好，欢迎来到灵山胜境。'
        if not voice:
            voice = 'zh-CN-XiaoxiaoNeural'
        try:
            mp3 = asyncio.run(synthesize_tts(text, voice))
        except Exception as e:
            self.send_json(500, {'error': f'TTS 合成失败: {e}'})
            return
        self.send_response(200)
        self.send_header('Content-Type', 'audio/mpeg')
        self.send_header('Content-Length', str(len(mp3)))
        self.send_header('Cache-Control', 'no-store')
        self.end_headers()
        self.wfile.write(mp3)

    # ===== 知识库管理接口（管理员） =====

    @staticmethod
    def _knowledge_row_to_dict(row):
        """将 knowledge 表行转为前端可用的 dict"""
        tags = row['tags'] or ''
        return {
            'id': row['id'],
            'title': row['title'],
            'category': row['category'] or '景区概况',
            'content': row['content'],
            'tags': [t.strip() for t in tags.split(',') if t.strip()],
            'source': row['source'] or 'manual',
            'created_at': row['created_at'],
            'updated_at': row['updated_at'],
        }

    def handle_admin_knowledge_list(self):
        """获取知识库列表（管理员，支持关键字/分类筛选）"""
        from urllib.parse import urlparse, parse_qs
        qs = parse_qs(urlparse(self.path).query)
        keyword = (qs.get('keyword', [''])[0] or '').strip()
        category = (qs.get('category', [''])[0] or '').strip()
        source = (qs.get('source', [''])[0] or '').strip()
        sql = 'SELECT * FROM knowledge WHERE 1=1'
        params = []
        if keyword:
            sql += ' AND (title LIKE ? OR content LIKE ? OR tags LIKE ?)'
            kw = f'%{keyword}%'
            params.extend([kw, kw, kw])
        if category and category != '全部':
            sql += ' AND category=?'
            params.append(category)
        if source and source != '全部':
            sql += ' AND source=?'
            params.append(source)
        sql += ' ORDER BY updated_at DESC'
        conn = _db()
        try:
            rows = conn.execute(sql, params).fetchall()
        finally:
            conn.close()
        items = [self._knowledge_row_to_dict(r) for r in rows]
        self.send_json(200, {'items': items, 'total': len(items)})

    def handle_admin_knowledge_create(self):
        """新增知识条目（管理员，JSON）"""
        body = self._read_json_body()
        title = str(body.get('title', '')).strip()
        content = str(body.get('content', '')).strip()
        if not title or not content:
            self.send_json(400, {'error': '标题和内容必填'})
            return
        category = str(body.get('category', '景区概况')).strip() or '景区概况'
        tags = str(body.get('tags', '')).strip()
        source = str(body.get('source', 'manual')).strip()
        now = datetime.datetime.now().isoformat()
        with DB_LOCK:
            conn = _db()
            try:
                cur = conn.execute(
                    'INSERT INTO knowledge (title, category, content, tags, source, created_at, updated_at) '
                    'VALUES (?,?,?,?,?,?,?)',
                    (title, category, content, tags, source, now, now)
                )
                conn.commit()
                row = conn.execute('SELECT * FROM knowledge WHERE id=?', (cur.lastrowid,)).fetchone()
            finally:
                conn.close()
        self.send_json(200, {'item': self._knowledge_row_to_dict(row)})

    def handle_admin_knowledge_update(self):
        """更新知识条目（管理员，JSON）"""
        body = self._read_json_body()
        try:
            kid = int(body.get('id', 0))
        except (ValueError, TypeError):
            kid = 0
        if not kid:
            self.send_json(400, {'error': '缺少 id'})
            return
        title = str(body.get('title', '')).strip()
        content = str(body.get('content', '')).strip()
        if not title or not content:
            self.send_json(400, {'error': '标题和内容必填'})
            return
        category = str(body.get('category', '景区概况')).strip() or '景区概况'
        tags = str(body.get('tags', '')).strip()
        now = datetime.datetime.now().isoformat()
        with DB_LOCK:
            conn = _db()
            try:
                row = conn.execute('SELECT id FROM knowledge WHERE id=?', (kid,)).fetchone()
                if not row:
                    self.send_json(404, {'error': '知识条目不存在'})
                    return
                conn.execute(
                    'UPDATE knowledge SET title=?, category=?, content=?, tags=?, updated_at=? WHERE id=?',
                    (title, category, content, tags, now, kid)
                )
                conn.commit()
                row = conn.execute('SELECT * FROM knowledge WHERE id=?', (kid,)).fetchone()
            finally:
                conn.close()
        self.send_json(200, {'item': self._knowledge_row_to_dict(row)})

    def handle_admin_knowledge_delete(self):
        """删除知识条目（管理员，JSON）"""
        body = self._read_json_body()
        try:
            kid = int(body.get('id', 0))
        except (ValueError, TypeError):
            kid = 0
        if not kid:
            self.send_json(400, {'error': '缺少 id'})
            return
        with DB_LOCK:
            conn = _db()
            try:
                conn.execute('DELETE FROM knowledge WHERE id=?', (kid,))
                conn.commit()
            finally:
                conn.close()
        self.send_json(200, {'ok': True})

    def handle_admin_knowledge_upload(self):
        """文档上传：解析 .txt/.md 文件按段落分条存入知识库（管理员，multipart）"""
        length = int(self.headers.get('Content-Length', 0))
        if length <= 0 or length > 20 * 1024 * 1024:
            self.send_json(400, {'error': '文件大小无效（最大 20MB）'})
            return
        body = self.rfile.read(length)
        content_type = self.headers.get('Content-Type', '')
        parts = self._parse_multipart(body, content_type)
        file_part = parts.get('file')
        if not file_part or not file_part.get('filename'):
            self.send_json(400, {'error': '未检测到上传文件'})
            return
        filename = file_part['filename']
        if not filename.lower().endswith(('.txt', '.md')):
            self.send_json(400, {'error': '仅支持 .txt / .md 文件'})
            return
        # 默认分类可由前端字段提供
        category = '景区概况'
        if parts.get('category') and parts['category'].get('data'):
            category = parts['category']['data'].decode('utf-8', errors='replace').strip() or '景区概况'
        try:
            text = file_part['data'].decode('utf-8', errors='replace')
        except Exception:
            text = file_part['data'].decode('gbk', errors='replace')
        # 按空行或多个换行分段
        paragraphs = [p.strip() for p in re.split(r'\n\s*\n|\r\n\s*\r\n', text) if p.strip()]
        if not paragraphs:
            paragraphs = [p.strip() for p in text.splitlines() if p.strip()]
        base_name = os.path.splitext(filename)[0]
        now = datetime.datetime.now().isoformat()
        inserted = 0
        with DB_LOCK:
            conn = _db()
            try:
                for idx, para in enumerate(paragraphs, 1):
                    title = f'{base_name}-{idx}' if len(paragraphs) > 1 else base_name
                    conn.execute(
                        'INSERT INTO knowledge (title, category, content, tags, source, created_at, updated_at) '
                        'VALUES (?,?,?,?,?,?,?)',
                        (title[:100], category, para, filename, 'upload', now, now)
                    )
                    inserted += 1
                conn.commit()
            finally:
                conn.close()
        self.send_json(200, {'ok': True, 'inserted': inserted, 'paragraphs': len(paragraphs)})

    def handle_admin_knowledge_coverage(self):
        """知识库覆盖率统计：按分类/来源/景点覆盖统计"""
        conn = _db()
        try:
            total = conn.execute('SELECT COUNT(*) AS c FROM knowledge').fetchone()['c']
            # 按分类统计
            cat_rows = conn.execute(
                'SELECT category, COUNT(*) AS c FROM knowledge GROUP BY category ORDER BY c DESC'
            ).fetchall()
            category_counts = [{'category': r['category'], 'count': r['c']} for r in cat_rows]
            # 按来源统计
            src_rows = conn.execute(
                'SELECT source, COUNT(*) AS c FROM knowledge GROUP BY source'
            ).fetchall()
            source_counts = {r['source']: r['c'] for r in src_rows}
            # 景点覆盖：扫描 content 中是否包含主要景点名
            spot_names = [
                '灵山大佛', '梵宫', '九龙灌浴', '祥符禅寺', '五印坛城', '阿育王柱',
                '百子戏弥勒', '灵山佛手', '降魔浮雕', '菩提大道', '五智门', '佛足坛',
                '曼飞龙塔', '佛教文化博览馆', '灵山大照壁', '五明桥', '拈花湾', '拈花广场',
                '香月花街', '梵天花海', '拈花堂', '五灯湖', '鹿鸣谷'
            ]
            covered_spots = []
            for name in spot_names:
                cnt = conn.execute(
                    'SELECT COUNT(*) AS c FROM knowledge WHERE content LIKE ? OR title LIKE ?',
                    (f'%{name}%', f'%{name}%')
                ).fetchone()['c']
                if cnt > 0:
                    covered_spots.append({'name': name, 'count': cnt})
            # 最近更新时间
            last_row = conn.execute(
                'SELECT updated_at FROM knowledge ORDER BY updated_at DESC LIMIT 1'
            ).fetchone()
            last_updated = last_row['updated_at'] if last_row else None
        finally:
            conn.close()
        self.send_json(200, {
            'total': total,
            'categoryCounts': category_counts,
            'sourceCounts': {
                'manual': source_counts.get('manual', 0),
                'upload': source_counts.get('upload', 0),
            },
            'coveredSpots': covered_spots,
            'coveredSpotCount': len(covered_spots),
            'totalSpotCount': len(spot_names),
            'coverageRate': round(len(covered_spots) / len(spot_names) * 100, 1) if spot_names else 0,
            'lastUpdated': last_updated,
        })

    # ===== 数据大屏接口（管理员） =====

    def handle_admin_dashboard(self):
        """数据大屏：聚合 chat_logs / reviews / knowledge 的实时统计"""
        conn = _db()
        try:
            # 今日服务人次（chat_logs 今日数）
            today = datetime.date.today().isoformat()
            today_count = conn.execute(
                "SELECT COUNT(*) AS c FROM chat_logs WHERE created_at >= ?",
                (today,)
            ).fetchone()['c']
            # 本周服务人次
            week_ago = (datetime.datetime.now() - datetime.timedelta(days=7)).isoformat()
            weekly_count = conn.execute(
                "SELECT COUNT(*) AS c FROM chat_logs WHERE created_at >= ?",
                (week_ago,)
            ).fetchone()['c']
            # 总对话数
            total_chats = conn.execute('SELECT COUNT(*) AS c FROM chat_logs').fetchone()['c']
            # 情感分布
            emo_rows = conn.execute(
                'SELECT emotion, COUNT(*) AS c FROM chat_logs GROUP BY emotion'
            ).fetchall()
            emo_dist = {r['emotion']: r['c'] for r in emo_rows}
            emo_total = sum(emo_dist.values()) or 1
            positive = emo_dist.get('positive', 0)
            neutral = emo_dist.get('neutral', 0)
            negative = emo_dist.get('negative', 0)
            satisfaction_rate = round((positive / emo_total) * 100, 1)
            # 最近7天服务趋势
            daily_rows = conn.execute(
                "SELECT DATE(created_at) AS day, COUNT(*) AS c FROM chat_logs "
                "WHERE created_at >= ? GROUP BY day ORDER BY day",
                (week_ago,)
            ).fetchall()
            service_trend = [{'date': r['day'], 'count': r['c']} for r in daily_rows]
            # 热门问题关键词 TOP10
            questions = conn.execute(
                'SELECT user_question FROM chat_logs ORDER BY id DESC LIMIT 200'
            ).fetchall()
            keyword_count = {}
            for (q,) in questions:
                for kw in ['大佛', '梵宫', '九龙灌浴', '五印坛城', '祥符禅寺', '门票',
                           '路线', '交通', '素斋', '时间', '住宿', '停车', '表演',
                           '开放', '价格', '佛手', '阿育王柱', '百子戏弥勒', '拈花湾']:
                    if kw in q:
                        keyword_count[kw] = keyword_count.get(kw, 0) + 1
            hot_keywords = sorted(keyword_count.items(), key=lambda x: -x[1])[:10]
            hot_questions = [{'question': k, 'count': v} for k, v in hot_keywords]
            # 景点评价统计
            review_count = conn.execute('SELECT COUNT(*) AS c FROM spot_reviews').fetchone()['c']
            avg_rating_row = conn.execute(
                'SELECT AVG(rating) AS avg FROM spot_reviews'
            ).fetchone()
            avg_rating = round(avg_rating_row['avg'], 2) if avg_rating_row['avg'] else 0
            # 热门景点（按评价数）
            spot_rows = conn.execute(
                'SELECT spot_id, COUNT(*) AS c FROM spot_reviews GROUP BY spot_id ORDER BY c DESC LIMIT 5'
            ).fetchall()
            top_spots = [{'spot_id': r['spot_id'], 'count': r['c']} for r in spot_rows]
            # 知识库统计
            kb_total = conn.execute('SELECT COUNT(*) AS c FROM knowledge').fetchone()['c']
            kb_last_row = conn.execute(
                'SELECT updated_at FROM knowledge ORDER BY updated_at DESC LIMIT 1'
            ).fetchone()
            kb_last_updated = kb_last_row['updated_at'] if kb_last_row else None
        finally:
            conn.close()
        self.send_json(200, {
            'todayServiceCount': today_count,
            'weeklyServiceCount': weekly_count,
            'totalChats': total_chats,
            'reviewCount': review_count,
            'avgRating': avg_rating,
            'satisfactionRate': satisfaction_rate,
            'avgResponseTime': 1.8,
            'emotionDistribution': {
                'positive': round(positive / emo_total * 100, 1),
                'neutral': round(neutral / emo_total * 100, 1),
                'negative': round(negative / emo_total * 100, 1),
            },
            'emotionCounts': {
                'positive': positive,
                'neutral': neutral,
                'negative': negative,
            },
            'serviceTrend': service_trend,
            'hotQuestions': hot_questions,
            'topSpots': top_spots,
            'knowledgeBase': {
                'total': kb_total,
                'lastUpdated': kb_last_updated,
            },
            'timestamp': datetime.datetime.now().isoformat(),
        })

    # ===== 游客感受度报告增强接口（管理员） =====

    def handle_admin_report_full(self):
        """增强版感受度报告：情感分析 + 分类统计 + 关注点 + AI 服务建议"""
        try:
            conn = _db()
            # 总数与情感分布
            total_row = conn.execute('SELECT COUNT(*) AS c FROM chat_logs').fetchone()
            total = total_row['c']
            emo_rows = conn.execute(
                'SELECT emotion, COUNT(*) AS c FROM chat_logs GROUP BY emotion'
            ).fetchall()
            emo_dist = {r['emotion']: r['c'] for r in emo_rows}
            positive = emo_dist.get('positive', 0)
            neutral = emo_dist.get('neutral', 0)
            negative = emo_dist.get('negative', 0)

            # 按天统计最近7天情感趋势
            week_ago = (datetime.datetime.now() - datetime.timedelta(days=7)).isoformat()
            daily_rows = conn.execute(
                "SELECT DATE(created_at) AS day, emotion, COUNT(*) AS c FROM chat_logs "
                "WHERE created_at >= ? GROUP BY day, emotion ORDER BY day",
                (week_ago,)
            ).fetchall()
            daily_trend = {}
            for day, emotion, cnt in daily_rows:
                if day not in daily_trend:
                    daily_trend[day] = {'positive': 0, 'neutral': 0, 'negative': 0, 'total': 0}
                daily_trend[day][emotion] = cnt
                daily_trend[day]['total'] += cnt

            # 热门问题关键词
            questions = conn.execute(
                'SELECT user_question FROM chat_logs ORDER BY id DESC LIMIT 200'
            ).fetchall()
            keyword_count = {}
            for (q,) in questions:
                for kw in ['大佛', '梵宫', '九龙灌浴', '五印坛城', '祥符禅寺', '门票',
                           '路线', '交通', '素斋', '时间', '住宿', '停车', '表演',
                           '开放', '价格', '佛手', '阿育王柱', '百子戏弥勒', '拈花湾',
                           '历史', '文化', '建筑', '祈福', '素斋', '拍照', '亲子']:
                    if kw in q:
                        keyword_count[kw] = keyword_count.get(kw, 0) + 1
            hot_keywords = sorted(keyword_count.items(), key=lambda x: -x[1])[:15]

            # 按问题类型分类统计
            category_keywords = {
                '历史与文化': ['历史', '文化', '故事', '由来', '传说', '唐代', '佛教'],
                '路线与导航': ['路线', '怎么走', '在哪', '方向', '导航', '地图'],
                '票价与时间': ['门票', '价格', '开放', '时间', '几点', '多少钱', '优惠'],
                '设施与服务': ['停车', '厕所', '餐饮', '素斋', '住宿', '寄存', '轮椅'],
                '景点介绍': ['大佛', '梵宫', '九龙灌浴', '五印坛城', '祥符禅寺', '佛手',
                            '阿育王柱', '百子戏弥勒', '拈花湾', '菩提大道'],
            }
            category_counts = {cat: 0 for cat in category_keywords}
            for (q,) in questions:
                matched = False
                for cat, kws in category_keywords.items():
                    if any(kw in q for kw in kws):
                        category_counts[cat] += 1
                        matched = True
                        break
                if not matched:
                    category_counts.setdefault('其他', 0)
                    category_counts['其他'] += 1
            category_stats = [{'category': k, 'count': v} for k, v in category_counts.items() if v > 0]

            # 最近10条负面情绪对话
            negative_logs = conn.execute(
                "SELECT user_question, ai_answer, created_at FROM chat_logs "
                "WHERE emotion='negative' ORDER BY id DESC LIMIT 10"
            ).fetchall()

            # 景点评价统计
            review_rows = conn.execute(
                'SELECT spot_id, AVG(rating) AS avg_rating, COUNT(*) AS cnt FROM spot_reviews GROUP BY spot_id'
            ).fetchall()
            spot_ratings = [{
                'spot_id': r['spot_id'],
                'avgRating': round(r['avg_rating'], 2) if r['avg_rating'] else 0,
                'count': r['cnt']
            } for r in review_rows]

            conn.close()

            # 生成服务建议（基于数据规则）
            suggestions = []
            if total > 0:
                neg_rate = negative / total
                if neg_rate > 0.1:
                    suggestions.append({
                        'icon': '⚠️',
                        'title': '负面情绪偏高',
                        'desc': f'当前负面情绪占比 {round(neg_rate*100, 1)}%，建议核查高频负面问题并优化知识库回答。'
                    })
                else:
                    suggestions.append({
                        'icon': '😊',
                        'title': '整体情绪良好',
                        'desc': f'正面情绪占比 {round(positive/total*100, 1)}%，游客整体反馈积极，请继续保持服务质量。'
                    })
            if hot_keywords:
                top_kw = hot_keywords[0]
                suggestions.append({
                    'icon': '🔥',
                    'title': '热门关注点',
                    'desc': f'游客最关注"{top_kw[0]}"（{top_kw[1]}次），建议确保该主题知识库覆盖完整。'
                })
            # 低评分景点预警
            low_rating_spots = [s for s in spot_ratings if s['avgRating'] < 4.0 and s['count'] >= 2]
            if low_rating_spots:
                names = '、'.join(s['spot_id'] for s in low_rating_spots[:3])
                suggestions.append({
                    'icon': '📉',
                    'title': '低评分景点预警',
                    'desc': f'景点 {names} 平均评分低于4.0，建议核查服务问题。'
                })
            # 知识库覆盖建议
            if category_counts.get('其他', 0) > total * 0.2:
                suggestions.append({
                    'icon': '📚',
                    'title': '扩充知识库',
                    'desc': '有较多问题未归类到现有分类，建议扩充知识库覆盖范围。'
                })
            if not suggestions:
                suggestions.append({
                    'icon': '💡',
                    'title': '暂无预警',
                    'desc': '当前数据正常，继续观察游客反馈趋势。'
                })

            self.send_json(200, {
                'total': total,
                'emotionDist': {
                    'positive': positive,
                    'neutral': neutral,
                    'negative': negative,
                },
                'emotionPercent': {
                    'positive': round(positive / (total or 1) * 100, 1),
                    'neutral': round(neutral / (total or 1) * 100, 1),
                    'negative': round(negative / (total or 1) * 100, 1),
                },
                'dailyTrend': daily_trend,
                'hotKeywords': hot_keywords,
                'categoryStats': category_stats,
                'negativeLogs': [
                    {'question': r[0], 'answer': r[1], 'time': r[2]} for r in negative_logs
                ],
                'spotRatings': spot_ratings,
                'suggestions': suggestions,
                'generatedAt': datetime.datetime.now().isoformat(),
            })
        except Exception as e:
            self.send_json(500, {'error': str(e)})

    # ===== AI代理接口（需访问口令 Cookie，防止公网盗刷） =====
    def handle_ai_proxy_recognize(self):
        """场景识别代理：调用多模态模型识别图片中的景区"""
        body = self._read_json_body()
        model_id = body.get('model_id')
        image_base64 = str(body.get('image_base64', '')).strip()
        if not image_base64:
            self.send_json(400, {'error': '缺少 image_base64'})
            return
        # 获取指定模型；若不可用则取默认备用
        model = None
        if model_id:
            try:
                model = _get_model_by_id(int(model_id))
            except (ValueError, TypeError):
                model = None
        fallback = None
        if not model or model['status'] != 'enabled':
            fallback = _get_default_model_by_role('recognition')
            model = fallback
        if not model:
            self.send_json(404, {'error': '无可用识别模型'})
            return
        timeout = _get_timeout_seconds()
        # 构造多模态请求（OpenAI兼容格式）
        prompt = _build_recognition_prompt()
        messages = [{
            'role': 'user',
            'content': [
                {'type': 'text', 'text': prompt},
                {'type': 'image_url', 'image_url': {'url': f'data:image/jpeg;base64,{image_base64}'}}
            ]
        }]
        payload = {
            'model': model['model_name'],
            'messages': messages,
            'stream': False,
            'temperature': 0.1
        }

        def _call_model(m):
            p = dict(payload, model=m['model_name'])
            req = urllib.request.Request(
                m['api_url'],
                data=json.dumps(p).encode('utf-8'),
                headers={
                    'Content-Type': 'application/json',
                    'Authorization': f'Bearer {m["api_key"]}'
                }
            )
            return urllib.request.urlopen(req, timeout=timeout)

        try:
            resp = _call_model(model)
            data = resp.read()
            resp_json = json.loads(data.decode('utf-8'))
            content = resp_json['choices'][0]['message']['content']
            spot_id, spot_name, confidence, description = _parse_recognition_result(content)
            self.send_json(200, {
                'spot_id': spot_id, 'spot_name': spot_name,
                'confidence': confidence, 'description': description,
                'model_id': model['id'], 'model_name': model['name'],
                'raw': content
            })
            print(f'识别成功: {spot_name} (模型 {model["name"]})')
        except Exception as e:
            print(f'识别失败 (模型 {model["name"]}): {e}')
            # 尝试备用模型
            if not fallback:
                fallback = _get_default_model_by_role('recognition')
            if fallback and fallback['id'] != model['id']:
                try:
                    resp = _call_model(fallback)
                    data = resp.read()
                    resp_json = json.loads(data.decode('utf-8'))
                    content = resp_json['choices'][0]['message']['content']
                    spot_id, spot_name, confidence, description = _parse_recognition_result(content)
                    self.send_json(200, {
                        'spot_id': spot_id, 'spot_name': spot_name,
                        'confidence': confidence, 'description': description,
                        'model_id': fallback['id'], 'model_name': fallback['name'],
                        'raw': content
                    })
                    print(f'备用模型识别成功: {spot_name} (模型 {fallback["name"]})')
                    return
                except Exception as e2:
                    print(f'备用模型识别也失败: {e2}')
            self.send_json(500, {'error': f'识别失败: {str(e)}'})

    def handle_ai_proxy_qa(self):
        """景区问答代理（SSE流式）：调用大模型并流式转发"""
        body = self._read_json_body()
        model_id = body.get('model_id')
        question = str(body.get('question', '')).strip()
        knowledge_context = str(body.get('knowledge_context', '')).strip()
        image_base64 = str(body.get('image_base64', '')).strip()
        if not question:
            self.send_json(400, {'error': '缺少 question'})
            return
        # 获取指定模型；若不可用则取默认备用
        model = None
        if model_id:
            try:
                model = _get_model_by_id(int(model_id))
            except (ValueError, TypeError):
                model = None
        fallback = None
        if not model or model['status'] != 'enabled':
            fallback = _get_default_model_by_role('qa')
            model = fallback
        if not model:
            self.send_json(404, {'error': '无可用问答模型'})
            return
        timeout = _get_timeout_seconds()
        # 构造 messages（多模态时 user content 用数组，否则用字符串）
        system_prompt = '你是灵山胜境景区的智能导览助手，请基于景区知识为游客解答问题。'
        if knowledge_context:
            system_prompt += f'\n\n参考知识：\n{knowledge_context}'
        if image_base64:
            user_content = [
                {'type': 'text', 'text': question},
                {'type': 'image_url', 'image_url': {'url': f'data:image/jpeg;base64,{image_base64}'}}
            ]
        else:
            user_content = question
        messages = [
            {'role': 'system', 'content': system_prompt},
            {'role': 'user', 'content': user_content}
        ]
        payload = {
            'model': model['model_name'],
            'messages': messages,
            'stream': True,
            'temperature': 0.5
        }

        def _call_stream(m):
            p = dict(payload, model=m['model_name'])
            req = urllib.request.Request(
                m['api_url'],
                data=json.dumps(p).encode('utf-8'),
                headers={
                    'Content-Type': 'application/json',
                    'Authorization': f'Bearer {m["api_key"]}',
                    'Accept': 'text/event-stream'
                }
            )
            return urllib.request.urlopen(req, timeout=timeout)

        # 先尝试主模型，失败时回退到备用模型（响应头未发送前可降级）
        try:
            resp = _call_stream(model)
        except Exception as e:
            print(f'QA失败 (模型 {model["name"]}): {e}')
            if not fallback:
                fallback = _get_default_model_by_role('qa')
            if fallback and fallback['id'] != model['id']:
                try:
                    resp = _call_stream(fallback)
                    model = fallback
                except Exception as e2:
                    print(f'备用模型QA也失败: {e2}')
                    self.send_json(500, {'error': f'问答失败: {str(e)}'})
                    return
            else:
                self.send_json(500, {'error': f'问答失败: {str(e)}'})
                return
        # 流式转发：一旦开始发送响应头，中途异常只能结束连接
        self.send_response(200)
        self.send_header('Content-Type', 'text/event-stream')
        self.send_header('Cache-Control', 'no-cache')
        self.send_header('Connection', 'keep-alive')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.end_headers()
        try:
            while True:
                line = resp.readline()
                if not line:
                    break
                self.wfile.write(line)
                self.wfile.flush()
            # 显式发送结束标记，兼容前端 EventSource
            self.wfile.write(b'data: [DONE]\n\n')
            self.wfile.flush()
        except Exception as e:
            print(f'QA流式转发异常: {e}')
        print(f'QA 完成 (模型 {model["name"]})')

    def handle_ai_proxy_tts(self):
        """TTS代理：edge_tts 本地合成 / 其他类型调用第三方API"""
        body = self._read_json_body()
        model_id = body.get('model_id')
        text = str(body.get('text', '')).strip()
        if not text:
            self.send_json(400, {'error': '缺少 text'})
            return
        # 获取指定模型；若不可用则取默认备用
        model = None
        if model_id:
            try:
                model = _get_model_by_id(int(model_id))
            except (ValueError, TypeError):
                model = None
        fallback = None
        if not model or model['status'] != 'enabled':
            fallback = _get_default_model_by_role('tts')
            model = fallback
        if not model:
            # 无任何模型配置时，退化为内置 edge-tts
            try:
                mp3 = asyncio.run(synthesize_tts(text))
                self._send_audio(mp3)
                print('TTS 无可用模型，使用内置 edge-tts')
                return
            except Exception as e:
                self.send_json(500, {'error': f'TTS失败: {str(e)}'})
                return
        timeout = _get_timeout_seconds()
        # edge_tts 类型直接本地合成
        if model['provider_type'] == 'edge_tts':
            try:
                mp3 = asyncio.run(synthesize_tts(text))
                self._send_audio(mp3)
                print(f'TTS (edge_tts 本地合成, 模型 {model["name"]})')
                return
            except Exception as e:
                print(f'edge_tts 失败: {e}')
                if not fallback:
                    self.send_json(500, {'error': f'TTS失败: {str(e)}'})
                    return
        # 其他类型调用第三方 TTS API（OpenAI兼容 / speech 接口）
        try:
            payload = {
                'model': model['model_name'],
                'input': text,
                'voice': 'zh-CN-XiaoxiaoNeural'
            }
            req = urllib.request.Request(
                model['api_url'],
                data=json.dumps(payload).encode('utf-8'),
                headers={
                    'Content-Type': 'application/json',
                    'Authorization': f'Bearer {model["api_key"]}'
                }
            )
            resp = urllib.request.urlopen(req, timeout=timeout)
            audio_data = resp.read()
            # 检查是否是 JSON 错误响应
            ct = resp.headers.get('Content-Type', '')
            if 'json' in ct.lower():
                try:
                    err = json.loads(audio_data.decode('utf-8'))
                    if isinstance(err.get('error'), dict):
                        msg = err['error'].get('message', str(err))
                    else:
                        msg = str(err)
                except Exception:
                    msg = audio_data.decode('utf-8', errors='replace')
                raise Exception(msg)
            self._send_audio(audio_data)
            print(f'TTS 完成 (模型 {model["name"]})')
        except Exception as e:
            print(f'TTS失败 (模型 {model["name"]}): {e}')
            # 尝试备用模型
            if not fallback:
                fallback = _get_default_model_by_role('tts')
            if fallback and fallback['id'] != model['id']:
                if fallback['provider_type'] == 'edge_tts':
                    try:
                        mp3 = asyncio.run(synthesize_tts(text))
                        self._send_audio(mp3)
                        print(f'备用TTS (edge_tts, 模型 {fallback["name"]})')
                        return
                    except Exception as e2:
                        print(f'备用TTS也失败: {e2}')
            self.send_json(500, {'error': f'TTS失败: {str(e)}'})

    # ===== AI增强AR功能处理器 =====

    def _get_caller_id(self):
        """获取调用者标识（用于审计日志和限流）"""
        cookie = self.headers.get('Cookie', '')
        for part in cookie.split(';'):
            part = part.strip()
            if part.startswith('lingshan_user_token='):
                return part.split('=', 1)[1][:20]
        return self.client_address[0] if self.client_address else 'unknown'

    def _call_dashscope(self, messages, model='qwen-plus', temperature=0.5, timeout=30):
        """
        调用阿里云百炼大模型（OpenAI兼容格式）。
        密钥通过 _load_dashscope_key() 安全加载，不在日志中暴露。
        """
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
                'Authorization': f'Bearer {api_key}'
            }
        )
        resp = urllib.request.urlopen(req, timeout=timeout)
        data = resp.read()
        resp_json = json.loads(data.decode('utf-8'))
        return resp_json['choices'][0]['message']['content']

    def handle_ar_smart_recognize(self):
        """
        AI增强场景a：智能物体识别与增强信息展示
        接收AR场景画面，通过AI视觉模型识别画面中的物体，
        返回精准的物体分类、属性信息和相关知识，供AR叠加展示。
        """
        endpoint = '/api/ar/ai/smart-recognize'
        caller = self._get_caller_id()
        if _is_rate_limited(caller, endpoint):
            self.send_json(429, {'error': '调用过于频繁，请稍后再试', 'code': 'RATE_LIMITED'})
            return
        # 熔断检查
        if _is_circuit_tripped(endpoint):
            self.send_json(503, {'error': 'AI服务暂时不可用，请稍后重试', 'code': 'CIRCUIT_OPEN'})
            return
        t0 = time.time()
        body = self._read_json_body()
        image_base64 = str(body.get('image_base64', '')).strip()
        spot_id = str(body.get('spot_id', '')).strip()[:50]  # 限制长度
        if not image_base64:
            self.send_json(400, {'error': '缺少 image_base64', 'code': 'MISSING_PARAM'})
            return
        if len(image_base64) > 1500000:  # 限制图片大小约1.1MB
            self.send_json(400, {'error': '图片过大，请缩小后重试', 'code': 'IMAGE_TOO_LARGE'})
            return
        # 缓存检查（相同图片+景点5分钟内返回缓存结果）
        cache_key = _get_cache_key(endpoint, {'spot_id': spot_id, 'image_base64': image_base64})
        cached = _get_cached_result(cache_key)
        if cached:
            duration = (time.time() - t0) * 1000
            _log_ai_audit(endpoint, caller, {'spot_id': spot_id, 'cache_hit': True}, True, duration)
            self.send_json(200, {**cached, 'cached': True, 'duration_ms': round(duration, 1)})
            return
        # 构造视觉理解提示词
        spot_context = f'当前位于景点：{spot_id}。' if spot_id else ''
        prompt = (
            f'{spot_context}请分析这张景区AR实景图片，识别画面中的主要物体和景观元素。'
            f'返回JSON格式：'
            f'{{"objects":[{{"name":"","type":"","description":"","attributes":{{}},"knowledge":""}}],'
            f'"scene_summary":"","recommended_actions":[]}}。'
            f'objects数组包含画面中识别到的主要物体（建筑、雕塑、植物、标志物等），'
            f'type字段为物体类型分类，attributes为属性键值对，knowledge为相关文化历史知识。'
            f'scene_summary为场景整体描述，recommended_actions为推荐的AR交互动作列表。'
        )
        messages = [{
            'role': 'user',
            'content': [
                {'type': 'text', 'text': prompt},
                {'type': 'image_url', 'image_url': {'url': f'data:image/jpeg;base64,{image_base64}'}}
            ]
        }]
        try:
            content = self._call_dashscope(messages, model='qwen-vl-max', temperature=0.2, timeout=30)
            # 解析JSON结果
            m = re.search(r'\{[\s\S]*\}', content)
            result = json.loads(m.group(0)) if m else {'raw': content}
            duration = (time.time() - t0) * 1000
            _record_ai_success(endpoint)
            _log_ai_audit(endpoint, caller,
                          {'spot_id': spot_id, 'image_base64': image_base64}, True, duration)
            resp_data = {
                'success': True,
                'result': result,
                'raw': content,
                'duration_ms': round(duration, 1)
            }
            _set_cached_result(cache_key, resp_data)
            self.send_json(200, resp_data)
        except Exception as e:
            duration = (time.time() - t0) * 1000
            _record_ai_failure(endpoint)
            _log_ai_audit(endpoint, caller,
                          {'spot_id': spot_id}, False, duration, e)
            # 不暴露内部错误细节
            self.send_json(500, {'error': '智能识别服务异常，请稍后重试', 'code': 'AI_CALL_FAILED'})

    def handle_ar_scene_understand(self):
        """
        AI增强场景b：场景理解与AR内容智能生成
        基于AI对当前环境场景的语义理解，动态生成符合场景特征
        和用户需求的AR虚拟内容（解说文案、推荐路线、互动建议等）。
        """
        endpoint = '/api/ar/ai/scene-understand'
        caller = self._get_caller_id()
        if _is_rate_limited(caller, endpoint):
            self.send_json(429, {'error': '调用过于频繁，请稍后再试', 'code': 'RATE_LIMITED'})
            return
        if _is_circuit_tripped(endpoint):
            self.send_json(503, {'error': 'AI服务暂时不可用，请稍后重试', 'code': 'CIRCUIT_OPEN'})
            return
        t0 = time.time()
        body = self._read_json_body()
        scene_description = str(body.get('scene_description', '')).strip()[:500]  # 限制长度
        spot_id = str(body.get('spot_id', '')).strip()[:50]
        user_preference = str(body.get('user_preference', '')).strip()[:100]
        image_base64 = str(body.get('image_base64', '')).strip()
        if not scene_description and not image_base64:
            self.send_json(400, {'error': '缺少场景描述或图片', 'code': 'MISSING_PARAM'})
            return
        if len(image_base64) > 1500000:
            self.send_json(400, {'error': '图片过大，请缩小后重试', 'code': 'IMAGE_TOO_LARGE'})
            return
        # 缓存检查（文本场景用描述+偏好做缓存键）
        cache_params = {'spot_id': spot_id, 'scene_description': scene_description,
                        'user_preference': user_preference}
        if image_base64:
            cache_params['image_base64'] = image_base64
        cache_key = _get_cache_key(endpoint, cache_params)
        cached = _get_cached_result(cache_key)
        if cached:
            duration = (time.time() - t0) * 1000
            _log_ai_audit(endpoint, caller, {'spot_id': spot_id, 'cache_hit': True}, True, duration)
            self.send_json(200, {**cached, 'cached': True, 'duration_ms': round(duration, 1)})
            return
        # 构造场景理解提示词
        pref_text = f'用户偏好：{user_preference}。' if user_preference else ''
        prompt = (
            f'你是灵山胜境景区的AR导览内容生成引擎。{pref_text}'
            f'当前场景描述：{scene_description}。'
            f'请基于场景语义理解，生成符合当前环境和用户需求的AR虚拟内容。'
            f'返回JSON格式：'
            f'{{"narration":"", "highlight_points":[{{"name":"","x":0,"y":0,"content":""}}],'
            f'"recommended_route":"", "interaction_suggestions":[], "cultural_context":""}}。'
            f'narration为AR场景解说文案（100字内），highlight_points为画面中值得关注的亮点位置，'
            f'recommended_route为推荐游览路线，interaction_suggestions为互动建议列表，'
            f'cultural_context为相关文化背景（50字内）。'
        )
        # 支持多模态输入（有图片时使用视觉模型）
        if image_base64:
            messages = [{
                'role': 'user',
                'content': [
                    {'type': 'text', 'text': prompt},
                    {'type': 'image_url', 'image_url': {'url': f'data:image/jpeg;base64,{image_base64}'}}
                ]
            }]
            model = 'qwen-vl-max'
        else:
            messages = [{'role': 'user', 'content': prompt}]
            model = 'qwen-plus'
        try:
            content = self._call_dashscope(messages, model=model, temperature=0.6, timeout=30)
            m = re.search(r'\{[\s\S]*\}', content)
            result = json.loads(m.group(0)) if m else {'raw': content}
            duration = (time.time() - t0) * 1000
            _record_ai_success(endpoint)
            _log_ai_audit(endpoint, caller,
                          {'spot_id': spot_id, 'scene_description': scene_description[:100]}, True, duration)
            resp_data = {
                'success': True,
                'result': result,
                'raw': content,
                'duration_ms': round(duration, 1)
            }
            _set_cached_result(cache_key, resp_data)
            self.send_json(200, resp_data)
        except Exception as e:
            duration = (time.time() - t0) * 1000
            _record_ai_failure(endpoint)
            _log_ai_audit(endpoint, caller,
                          {'spot_id': spot_id}, False, duration, e)
            self.send_json(500, {'error': '场景理解服务异常，请稍后重试', 'code': 'AI_CALL_FAILED'})

    def handle_ar_intent_predict(self):
        """
        AI增强场景c：用户意图预测与AR交互优化
        通过AI分析用户行为模式和交互历史，预测用户意图
        并主动提供个性化的AR交互建议和优化。
        """
        endpoint = '/api/ar/ai/intent-predict'
        caller = self._get_caller_id()
        if _is_rate_limited(caller, endpoint):
            self.send_json(429, {'error': '调用过于频繁，请稍后再试', 'code': 'RATE_LIMITED'})
            return
        if _is_circuit_tripped(endpoint):
            self.send_json(503, {'error': 'AI服务暂时不可用，请稍后重试', 'code': 'CIRCUIT_OPEN'})
            return
        t0 = time.time()
        body = self._read_json_body()
        behavior_history = body.get('behavior_history', [])
        if not isinstance(behavior_history, list):
            behavior_history = []
        behavior_history = behavior_history[:20]  # 最多取20条
        current_spot = str(body.get('current_spot', '')).strip()[:50]
        try:
            session_duration = int(body.get('session_duration', 0))
        except (ValueError, TypeError):
            session_duration = 0
        # 缓存检查（基于行为历史指纹）
        cache_key = _get_cache_key(endpoint, {
            'current_spot': current_spot,
            'session_duration': session_duration,
            'history_hash': hash(json.dumps(behavior_history, sort_keys=True, default=str))
        })
        cached = _get_cached_result(cache_key)
        if cached:
            duration = (time.time() - t0) * 1000
            _log_ai_audit(endpoint, caller, {'current_spot': current_spot, 'cache_hit': True}, True, duration)
            self.send_json(200, {**cached, 'cached': True, 'duration_ms': round(duration, 1)})
            return
        # 构造意图预测提示词
        history_text = json.dumps(behavior_history, ensure_ascii=False) if behavior_history else '[]'
        prompt = (
            f'你是灵山胜境景区的AR导览意图预测引擎。'
            f'用户当前在：{current_spot or "未知位置"}，'
            f'已游览{session_duration}秒。'
            f'用户行为历史：{history_text}。'
            f'请分析用户意图，预测用户下一步可能的需求，并返回个性化AR交互建议。'
            f'返回JSON格式：'
            f'{{"predicted_intent":"", "confidence":0.0, "suggestions":[{{"type":"","title":"","action":"","priority":0}}],'
            f'"next_spot":"", "personalized_tip":""}}。'
            f'predicted_intent为预测的用户意图（如"想了解历史"、"寻找路线"、"想拍照"等），'
            f'confidence为预测置信度0-1，suggestions为推荐交互建议列表（type: guide/navigate/qa/photo），'
            f'next_spot为推荐下一景点，personalized_tip为个性化提示（30字内）。'
        )
        messages = [{'role': 'user', 'content': prompt}]
        try:
            content = self._call_dashscope(messages, model='qwen-plus', temperature=0.4, timeout=20)
            m = re.search(r'\{[\s\S]*\}', content)
            result = json.loads(m.group(0)) if m else {'raw': content}
            duration = (time.time() - t0) * 1000
            _record_ai_success(endpoint)
            _log_ai_audit(endpoint, caller,
                          {'current_spot': current_spot, 'history_count': len(behavior_history)}, True, duration)
            resp_data = {
                'success': True,
                'result': result,
                'raw': content,
                'duration_ms': round(duration, 1)
            }
            _set_cached_result(cache_key, resp_data)
            self.send_json(200, resp_data)
        except Exception as e:
            duration = (time.time() - t0) * 1000
            _record_ai_failure(endpoint)
            _log_ai_audit(endpoint, caller,
                          {'current_spot': current_spot}, False, duration, e)
            self.send_json(500, {'error': '意图预测服务异常，请稍后重试', 'code': 'AI_CALL_FAILED'})

    def handle_ar_audit_log(self):
        """查询AI调用审计日志（仅管理员）"""
        if not self._require_admin():
            return
        limit = 100
        logs = _AI_AUDIT_LOG[-limit:]
        # 统计摘要
        total = len(_AI_AUDIT_LOG)
        success_count = sum(1 for l in logs if l['success'])
        avg_duration = sum(l['duration_ms'] for l in logs) / len(logs) if logs else 0
        cache_hit_count = sum(1 for l in logs if l.get('params', {}).get('cache_hit'))
        # 按端点分组统计
        endpoint_stats = {}
        for l in logs:
            ep = l['endpoint']
            if ep not in endpoint_stats:
                endpoint_stats[ep] = {'count': 0, 'success': 0, 'avg_ms': 0, 'cache_hits': 0}
            endpoint_stats[ep]['count'] += 1
            if l['success']:
                endpoint_stats[ep]['success'] += 1
            endpoint_stats[ep]['avg_ms'] += l['duration_ms']
            if l.get('params', {}).get('cache_hit'):
                endpoint_stats[ep]['cache_hits'] += 1
        for ep in endpoint_stats:
            if endpoint_stats[ep]['count'] > 0:
                endpoint_stats[ep]['avg_ms'] /= endpoint_stats[ep]['count']
        # 熔断器状态
        cb_status = {}
        for ep, cb in _AI_CIRCUIT_BREAKER.items():
            cb_status[ep] = {
                'tripped': cb.get('tripped', False),
                'fail_count': cb.get('fail_count', 0),
                'recovery_in_sec': max(0, _AI_CB_RECOVERY_TIME - (time.time() - cb.get('last_fail_time', 0))) if cb.get('tripped') else 0
            }
        self.send_json(200, {
            'logs': logs,
            'summary': {
                'total': total,
                'showing': len(logs),
                'success_rate': success_count / len(logs) if logs else 0,
                'avg_duration_ms': round(avg_duration, 1),
                'cache_hit_rate': cache_hit_count / len(logs) if logs else 0,
                'cache_size': len(_AI_RESULT_CACHE),
                'endpoint_stats': endpoint_stats,
                'circuit_breaker': cb_status
            }
        })

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'POST, GET, PUT, DELETE, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, Authorization')
        self.end_headers()

    def do_PUT(self):
        """处理 PUT 请求（管理员编辑接口）"""
        if self.path == '/api/admin/ai/models':
            if not self._require_admin():
                return
            self.handle_admin_ai_models_update()
            return
        if self.path == '/api/admin/ai/config':
            if not self._require_admin():
                return
            self.handle_admin_ai_config_update()
            return
        self.send_error(404)

    def do_DELETE(self):
        """处理 DELETE 请求（管理员删除接口）"""
        if self.path == '/api/admin/ai/models':
            if not self._require_admin():
                return
            self.handle_admin_ai_models_delete()
            return
        self.send_error(404)


class ThreadingServer(socketserver.ThreadingMixIn, socketserver.TCPServer):
    allow_reuse_address = True
    daemon_threads = True


if not os.path.isdir(STATIC_DIR):
    print(f'错误: 静态目录不存在: {STATIC_DIR}')
    sys.exit(1)

init_db()

try:
    with ThreadingServer(('', PORT), ProxyHandler) as httpd:
        print(f'灵山导览服务器: http://localhost:{PORT}')
        print(f'访问口令: {ACCESS_PASS}（环境变量 LINGSHAN_PASS 可覆盖）')
        print('文本AI: 智谱 GLM-4-Flash')
        print('多模态: 智谱 GLM-4V-Flash')
        print('TTS语音: 微软晓晓 (zh-CN-XiaoxiaoNeural)')
        print('游客用户: SQLite (lingshan_users.db)')
        httpd.serve_forever()
except OSError as e:
    print(f'错误: 无法绑定端口 {PORT}（可能已被占用）: {e}')
    sys.exit(1)
except KeyboardInterrupt:
    print('\n服务器已停止。')
