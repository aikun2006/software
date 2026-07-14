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

## 对话记录

### 2026-07-03
- 用户要求读取 AI_CONTEXT，并在每次对话时把对话内容追加到本文件，方便其他 AI 读取。
- 已建立「对话记录」区块，后续每次用户下达指令都会在此按日期追加记录。
- 用户要求预览项目，已启动 Vite 开发服务器（http://localhost:5173），前端页面可正常访问。后端 8080 未启动，AI 对话/TTS 暂不可用。
- 用户确认要启动后端，已安装 edge-tts 依赖并启动 server.py（http://localhost:8080）。前后端均正常运行，AI 对话和 TTS 现在可用。
- 用户反馈浏览器打不开页面（连接超时），排查发现 Vite 编译报错（Unbalanced delimiter found in string, plugin uni:dep-scan），导致 JS 模块无法加载、页面卡死。改用 8080 端口预览（Python 后端直接发 dist 构建产物），绕开 Vite 编译问题。
- 用户下达指令：替换底部导航栏全部5个图标为「图片/图标」目录下对应图片（shouye→首页、jingdian→景点、daolan→导览、luxian→地图、wode→我的）。已将5张图片复制到 src/static/icons/，更新 pages.json tabBar 配置（为景点/地图/我的补充了 iconPath），构建 H5 产物完成，8080 预览已刷新。
- 用户下达指令：增强底部导航栏样式——统一图标尺寸28px、悬浮POV透视+放大1.2倍+蓝色竖线、当前选中项常驻动效、过渡0.25s。已修改 App.vue（添加 JS 检测选中项并标记 .tab-active 类，因 UniApp 原生 tabBar 用内联 style 区分选中态无 CSS class）和 global.scss（添加全部增强样式），构建完成。
- 用户下达指令：在聊天页输入框上方新增「猜你想问」模块。需求：横向单行滚动容器+隐藏滚动条+鼠标拖拽左右滑动、浅灰圆角标签自适应宽度、悬浮提亮0.2s过渡、点击填充输入框、16条灵山景区默认问句、根据用户最近3-5条提问关键词热度动态排序。已修改 chat.vue（新增模板HTML、script逻辑、CSS样式），未改动原有任何代码。构建成功。
- 用户下达指令：优化底部导航栏样式v2——强制5图标统一26px尺寸、蓝色竖线加粗3px高饱和#1a6fe8居中对齐、选中项图标+文字同步蓝色+浅蓝半透明背景+常驻POV动效、悬浮未激活项触发放大+竖线、全部0.25s过渡。已更新 global.scss 底部导航栏样式区块。构建成功。
- 用户下达指令：强化猜你想问与输入栏边框区分——猜你想问容器加浅灰边框rgba(180,185,195,0.45)+20rpx圆角+#FAFBFC极浅底色+四周内边距独立成块；输入栏.input-row加#CDD0D6边框+20rpx圆角+统一背景；chat-input去独立背景融入输入栏；两者间20rpx间距分割；标签边框加深至#D0D3D9；全部0.2s过渡。构建成功。
- 用户下达指令：底部导航栏v3融合版——图标统一26px+4px padding+contrast滤镜统一线条粗细；bd加padding:0 12px向外推竖线加宽间距；蓝色竖线加粗4px+高度36px+border-radius 2px+z-index 10+渐变12%-88%饱和区；激活态与悬浮态完全统一（POV放大1.2+竖线+蓝色文字#1a6fe8+浅蓝背景rgba(26,111,232,0.10)）；悬浮用:hover:not(.tab-active)精确区分；全部0.25s过渡。仅改 global.scss，构建成功。
- 用户下达指令：猜你想问模块拖拽滚动增强——改为document级mousemove/mouseup监听（解决快速拖拽离开容器丢失追踪）；添加惯性滑动（requestAnimationFrame+friction 0.93衰减+EMA速度平滑）；添加橡皮筋回弹（边缘0.35阻尼+释放后200ms ease-out回弹动画）；移除scroll-behavior:smooth（消除拖拽卡顿）；添加.suggest-dragging类控制拖拽时光标和滚动行为；onUnmounted清理RAF和document监听。仅改chat.vue拖拽逻辑和CSS，未动标签样式/文字/边框/排序。构建成功。
- 用户下达指令：底部导航栏v4精调版——图标缩至24px+5px padding+contrast(1.08) saturate(1.04)统一线条粗细；蓝色竖线粗细适中3px（原4px）+高度34px（原36px）+渐变8%-92%高饱和区+border-radius 1.5px；竖线left/right各2px偏移+bd padding加宽至0 16px使两线间距更宽；圆角14px；背景透明度0.09（低透浅蓝）；色调#1a6fe8与图标文字完全统一；竖线过渡增加width参数；全部0.25s过渡。仅改global.scss，构建成功。
- 用户下达指令：修复猜你想问拖拽滚动——根因是UniApp H5下<view>编译为<uni-view>自定义元素，display:flex容器会尝试撑开容纳全部子元素而非触发overflow。修复方案：拆为外层.suggest-scroll（width:100%+overflow-x:auto滚动视口）+内层.suggest-track（display:inline-flex+width:max-content自适应宽度轨道）两层结构；拖拽JS从offsetLeft改用getBoundingClientRect()精确定位；mousedown添加e.preventDefault()防止拖拽选中文本；CSS添加touch-action:pan-y允许纵向滚动横向捕获。仅改chat.vue模板（加track层）+CSS（拆scroll/track）+JS（getBoundingClientRect），标签样式/文字/边框/排序/点击逻辑全不变。构建成功。
- 用户下达指令：全局页面切换动画——0.3s淡入淡出+横向平移20px+ease-in-out缓动。实现方案：CSS层面给.uni-page添加page-enter动画（opacity 0→1+translateX 20px→0），page-leave动画（opacity 1→0+translateX 0→-20px）；JS层面在App.vue onLaunch中拦截uni.navigateTo/redirectTo/reLaunch/switchTab/navigateBack五个方法，离开页加page-leave类触发淡出，280ms后执行实际导航。仅新增CSS和JS动画逻辑，未改动任何模块。构建成功。
- 用户下达指令：美食/住宿页面1:1复刻灵山景点结构与功能——将原静态HTML(food.html/hotel.html)改造为Vue页面，复用景点页全套结构（搜索栏+左图右文卡片列表+详情页模板）。新增文件：data/foods.ts（15家美食数据+评价+特色标签+简介）、data/hotels.ts（16家酒店数据+评价+特色标签+简介）、pages/visitor/foods.vue（美食列表页，复刻spots.vue结构）、pages/visitor/food-detail.vue（美食详情页，复刻spot-detail.vue模板+预生成评价+特色标签+营业时间）、pages/visitor/hotels.vue（住宿列表页）、pages/visitor/hotel-detail.vue（住宿详情页）。更新pages.json注册4个新路由；更新index.vue将美食/住宿链接从静态HTML改为Vue路由（type:'vue'用uni.navigateTo）。保留原有基础数据（图片/店名/价格/距离），AI自动补充评价星级、用户评价文案、特色标签、营业时间、简介等配套内容。构建成功。
- 用户下达指令（两段合并）：①全局页面切换动画调整——0.3s→0.4s、缓动ease-in-out→ease-out（开头顺滑加速、收尾缓慢缓冲）、位移幅度20px→30px（适中）、添加0.05s延时缓冲（animation-delay）、JS延迟280ms→380ms配合新时长。②底部导航栏激活逻辑修复——废弃getComputedStyle颜色检测方案，改用精确路由匹配：定义TAB_ROUTES（5个tab页路由）+SUB_PAGE_TO_TAB映射（spot-detail→景点tab、foods/food-detail/hotels/hotel-detail→首页tab），通过window.location.hash解析当前路由匹配tab索引，监听hashchange事件+MutationObserver双重保障。③悬浮态降级——hover不再完全复刻激活态，改为短暂高亮（scale 1.08+rotateX 3deg+浅蓝背景0.05），无蓝色竖线无蓝色文字。④全部过渡函数统一为0.25s ease-in-out。改了global.scss（tabBar v5+动画参数）和App.vue（路由匹配JS+延迟380ms），构建成功。
- 用户下达指令：全品类详情页封面图样式+全屏预览一体化——景点/美食/住宿三个详情页统一改造。①封面图视觉：容器收窄（margin:24rpx 32rpx 左右留白）、object-fit从aspectFill改为aspectFit（完整展示无裁切）、高度440rpx→360rpx适度减小、圆角$border-radius-xl+box-shadow $shadow-md+overflow:hidden、上下间距由容器margin控制。②全屏预览交互：封面图绑定@click唤起全屏遮罩层（position:fixed+z-index:9999+rgba(0,0,0,0.92)黑底）、原图aspectFit等比例自适应屏幕、单击任意位置关闭、0.25s淡入淡出（opacity+visibility双transition）、swiper @change追踪currentSlide确保预览当前轮播图。三个文件改动完全一致（spot-detail.vue/food-detail.vue/hotel-detail.vue 各改4处：模板gallery→cover-wrap+预览遮罩、script加preview状态3ref+3方法、style替换gallery样式+新增preview-overlay/preview-img）。构建成功。

人类向的功能 / 结构 / 特性介绍见 `software/README.md`。
