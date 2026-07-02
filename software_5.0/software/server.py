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
from http.cookies import SimpleCookie

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
        ''')
        conn.commit()
        conn.close()
    _seed_reviews()


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
      body: JSON.stringify({ pass })
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


async def synthesize_tts(text: str) -> bytes:
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
        # 未登录：一律返回登录页（含 /assets/*.js，顺带保护前端源码）
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
        # 以下接口需要登录，否则返回 401
        if not self._is_authed():
            self.send_json(401, {'error': 'unauthorized', 'needLogin': True})
            return
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

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'POST, OPTIONS, GET')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, Authorization')
        self.end_headers()


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
