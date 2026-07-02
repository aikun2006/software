# AI_CONTEXT — 项目上下文（喂给你的 AI 助手）

> 用法：开始干活前，把本文件完整内容发给你的 AI 助手（或让它读取本文件），让它先建立上下文再动手。人类向的项目介绍见 `software/README.md`。

## 项目一句话
AI 数字人景区导览系统。前端 uni-app(Vue3 + TS)，后端 Python 单文件 `server.py`。三人小组协作。仓库根目前不是 git 仓库。

## 仓库布局
根目录（你解压/克隆到的目录，开发机上是 `D:\software_5.0`）：
- `software/` — 主项目，所有代码在这里
- `cloudflared.exe` — 公网隧道二进制
- `启动服务器.vbs` / `启动隧道.vbs` / `停止服务器.vbs` / `停止隧道.vbs` — 一键脚本
- `.gitignore`、`AI_CONTEXT.md`（本文件）

`software/`：
- `src/` — 前端源码（`pages/admin`、`pages/visitor`、`stores`、`api`、`utils`、`styles`、`types`、`static`）
- `server.py` — Python 后端：发静态文件 + AI 代理 + TTS（单文件，约 330 行）
- `dist/build/h5/` — 前端构建产物，`server.py` 发的就是它
- `package.json` / `package-lock.json` — 前端依赖与锁定
- `requirements.txt` — 后端依赖（`edge-tts==7.2.8`）
- `vite.config.ts` — Vite 配置，含 `/api` → `localhost:8080` 代理
- `README.md` — 人类向说明

## 技术栈 & 版本（版本是硬约束）
- 前端：UniApp + Vue 3 + TypeScript + Pinia + SCSS + Vite 5.4
- 后端：Python 3 标准库（`http.server` / `urllib` / `asyncio` / `threading`）+ `edge-tts`，无 Web 框架
- **Node：22 LTS 必须；≥18 可用；v16 禁用（Vite 5 会崩在 `crypto.getRandomValues is not a function`）**
- Python：3.8+（开发用 3.13.9）
- npm：10.x

## 两套服务器（最容易混的地方）
| 角色 | 命令 | 端口 | 干什么 |
|---|---|---|---|
| 前端开发 | `npm run dev:h5` | 5173 | Vite 热更新；改前端代码实时生效；`/api` 代理到 8080 |
| 后端一体 | `python server.py` | 8080 | 发 dist 静态文件 + AI 对话代理 + TTS 语音 |

- 开发时两个都开：5173 看改动，8080 提供 AI/TTS（5173 的 `/api` 靠 8080）。
- 只预览 / 对外发布：只开 8080（基于已构建的 dist）。
- 公网隧道（cloudflared）暴露的是 8080，跟 Node 无关。

## 新机器配环境（一次性）
1. 装 Node 22 LTS：https://nodejs.org
2. 装 Python 3：https://www.python.org
3. `cd software`
4. `npm install` — 生成 `node_modules`（约 235MB，别共享）
5. `pip install -r requirements.txt` — 装 edge-tts

## 常用命令
- 开发：`npm run dev:h5` → http://localhost:5173
- 构建：`npm run build:h5` → 产物进 `dist/build/h5/`
- 后端：`python server.py` → http://localhost:8080
- 微信小程序：`npm run dev:mp-weixin`（需微信开发者工具导入）

## server.py 关键参数
- `PORT = 8080`
- `STATIC_DIR = dist/build/h5`（相对于 `server.py`）
- `ACCESS_PASS`：环境变量 `LINGSHAN_PASS` 覆盖，默认 `lingshan2026`（防止公网网址被陌生人盗刷 AI）
- 文本 AI：硅基流动 Qwen2.5-72B，`SILICONFLOW_KEY`（`server.py` 顶部，约第 28 行）
- 多模态 AI：智谱 GLM-4V-Flash，`ZHIPU_KEY`（约第 32 行）
- TTS：微软晓晓 `zh-CN-XiaoxiaoNeural`（edge-tts）
- 管理端默认账号：`admin` / `admin123`

## 铁律 / 易踩坑（AI 务必看）
1. **Node 版本**：必须 ≥18，推荐 22 LTS。v16 会让 Vite 5 启动崩溃（`crypto.getRandomValues`）。
2. **生成物别碰**：`node_modules/`、`dist/` 是生成的，不要手改、不要共享、不要提交。每台机器各自 `npm install` / `npm run build:h5`。
3. **改前端要重新构建**：改完前端代码，要让它出现在 8080 的成品里，必须重跑 `npm run build:h5`；否则 8080 还在发旧 dist。
4. **dist 要存在**：`server.py` 依赖 `dist/build/h5/`；没有就先 build，否则页面 404。
5. **隧道地址临时**：cloudflared 每次启动生成新的 `*.trycloudflare.com` 地址，旧的会失效。
6. **5173 依赖 8080**：开发时 AI 对话 / TTS 要通，必须 8080 也在跑（5173 的 `/api` 代理过去）。
7. **API key 是硬编码**：`SILICONFLOW_KEY` / `ZHIPU_KEY` 写死在 `server.py` 顶部，是真实可用 key。别把含 key 的 `server.py` 推到公开仓库；要换自己的 key 就改这两行。公网访问由 `lingshan2026` 口令门控。
8. **别把 secret 提交进代码库**。

## 对外分享
双击 `启动隧道.vbs`：自动确保 8080 在跑 → 启动 cloudflared → 弹窗给公网网址（复制到剪贴板）→ 把网址 + 口令 `lingshan2026` 发给访客。停止用 `停止隧道.vbs`。

## 团队交接
- 给队友：源码、`package.json`、`package-lock.json`、`requirements.txt`、`README.md`、`AI_CONTEXT.md`（本文件）
- 不给：`node_modules/`（235MB）、`dist/`（构建产物）
- 队友拿到后：装好 Node 22 + Python 3 → `npm install` → `pip install -r requirements.txt` → 开工

## 更多
人类向的功能 / 结构 / 特性介绍见 `software/README.md`。
