"""灵山导览本地服务器 —— 静态文件 + Edge TTS + 豆包AI代理"""
import http.server
import socketserver
import json
import asyncio
import edge_tts
import urllib.request
import urllib.error
import tempfile
import os

PORT = 8080
STATIC_DIR = os.path.join(os.path.dirname(__file__), 'dist', 'build', 'h5')
DOUBAO_URL = 'https://ark.cn-beijing.volces.com/api/v3/chat/completions'
DOUBAO_KEY = 'ark-6c40917b-c43a-4102-b524-fb472c88ca51-20741'

async def synthesize_tts(text: str) -> bytes:
    """用微软晓晓女声合成语音"""
    voice = 'zh-CN-XiaoxiaoNeural'  # 晓晓 - 最温柔的中文女声
    mp3 = b''
    tts = edge_tts.Communicate(text, voice, rate='+10%')
    async for chunk in tts.stream():
        if chunk['type'] == 'audio':
            mp3 += chunk['data']
    return mp3

class ProxyHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=STATIC_DIR, **kwargs)

    def do_POST(self):
        if self.path == '/api/tts':
            self.handle_tts()
        elif self.path == '/api/chat':
            self.handle_chat()
        else:
            self.send_error(404)

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

    def handle_chat(self):
        """代理豆包AI请求，解决浏览器CORS限制"""
        try:
            length = int(self.headers.get('Content-Length', 0))
            body = self.rfile.read(length)
            print(f'Chat: forwarding to Doubao...')
            
            req = urllib.request.Request(
                DOUBAO_URL,
                data=body,
                headers={
                    'Content-Type': 'application/json',
                    'Authorization': f'Bearer {DOUBAO_KEY}'
                }
            )
            resp = urllib.request.urlopen(req, timeout=30)
            data = resp.read()
            
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Content-Length', str(len(data)))
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(data)
            print(f'Chat: OK {len(data)} bytes')
        except Exception as e:
            print(f'Chat Error: {e}')
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

print(f'灵山导览服务器启动: http://localhost:{PORT}')
print('TTS语音: 微软晓晓 (zh-CN-XiaoxiaoNeural) - 温柔女声（并发合成）')
with ThreadingServer(('', PORT), ProxyHandler) as httpd:
    httpd.serve_forever()
