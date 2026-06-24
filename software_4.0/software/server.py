"""灵山导览本地服务器 —— 静态文件 + Edge TTS + 双模型AI代理
文本对话 → 硅基流动 Qwen2.5-72B | 多模态 → 智谱 GLM-4V-Flash
+ 访问口令（Cookie 会话）：公网网址下未登录者无法调用收费 AI 接口"""
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
from http.cookies import SimpleCookie

try:
    sys.stdout.reconfigure(line_buffering=True)
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
        print(f'[{self.log_date_time_string()}] {format % args}')

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
        """代理硅基流动 — 文本对话"""
        self._proxy_ai(SILICONFLOW_URL, SILICONFLOW_KEY, '硅基流动')

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
        self.send_header('Access-Control-Allow-Methods', 'POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()


class ThreadingServer(socketserver.ThreadingMixIn, socketserver.TCPServer):
    allow_reuse_address = True
    daemon_threads = True


if not os.path.isdir(STATIC_DIR):
    print(f'错误: 静态目录不存在: {STATIC_DIR}')
    sys.exit(1)

try:
    with ThreadingServer(('', PORT), ProxyHandler) as httpd:
        print(f'灵山导览服务器: http://localhost:{PORT}')
        print(f'访问口令: {ACCESS_PASS}（环境变量 LINGSHAN_PASS 可覆盖）')
        print('文本AI: 硅基流动 Qwen2.5-72B')
        print('多模态: 智谱 GLM-4V-Flash')
        print('TTS语音: 微软晓晓 (zh-CN-XiaoxiaoNeural)')
        httpd.serve_forever()
except OSError as e:
    print(f'错误: 无法绑定端口 {PORT}（可能已被占用）: {e}')
    sys.exit(1)
except KeyboardInterrupt:
    print('\n服务器已停止。')
