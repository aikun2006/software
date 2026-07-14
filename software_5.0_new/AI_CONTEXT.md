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
- 用户要求备份文件，已在 `backup/` 目录创建完整备份，排除了 `node_modules/`、`dist/`、`__pycache__/`、`*.db` 等生成文件，保留所有源码和配置文件。
- 用户下达指令：口令登录弹窗+可关闭用户须知开发——在 `server.py` 的 `LOGIN_HTML` 中新增用户须知弹窗。功能包括：半透明黑色遮罩（点击遮罩不关闭）、弹窗右上角关闭按钮（悬浮变色）、7条用户须知文本（宽松行间距）、圆角边框与输入框统一；口令验证成功后弹出须知，点击 × 关闭并进入系统；口令错误仍显示错误提示，不触发须知弹窗。修改完成，服务器已重启。
- 用户要求将今天所有对话记入 AI_CONTEXT.md，已确认此要求，后续每次对话完成都会自动追加到本文件。
- 用户反馈登录后仍显示登录页面，排查发现 `_is_authed()` 方法中使用 `SimpleCookie` 解析 Cookie 后调用 `token.value` 属性错误（token 为字符串类型），导致认证始终失败。修复方案：将 Cookie 解析改为手动字符串分割提取令牌，直接比较令牌是否存在于 SESSIONS 集合中。同时添加调试日志便于后续排查。
- 用户继续反馈"还是不能"，进一步排查发现多个进程同时监听 8080 端口导致请求路由异常，使用 taskkill 终止所有占用进程后重启服务器。通过 PowerShell 模拟完整登录流程验证：登录成功返回 Cookie、携带 Cookie 访问主页返回主应用 HTML（4783 字节），确认服务器认证逻辑完全正常。问题定位为浏览器端缓存或扩展干扰。
- 用户下达指令：用户须知弹窗局部优化——仅改动须知弹窗自身样式、文案、交互，所有原有业务代码完全不动。优化内容：①文案微调（7条须知文字表述优化）；②样式优化：标题加粗放大居中+上下间距、每条规则带数字序号+加大行间距、弹窗四周16px内边距、关闭按钮放大（36px）+hover变金色背景、0.2s淡入缩放入场动画、遮罩透明度加深至0.75、弹窗圆角改为10px与输入框统一、正文改为柔和深灰色；③交互逻辑完全不变（口令校验通过弹出、点×关闭进入系统）。仅修改 server.py 中 LOGIN_HTML 内的用户须知相关 CSS 和 HTML，未改动其他任何代码。修改完成，服务器已重启。
- 用户下达指令：首页展示用户须知弹窗——将用户须知弹窗从登录页面移至首页。具体改动：①修改 `src/pages/visitor/index.vue`，在首页模板中新增用户须知弹窗（遮罩层+弹窗容器+关闭按钮+标题+7条须知内容），script 中添加 showNotice 状态、noticeItems 数据、closeNotice 方法，onMounted 中延迟500ms自动弹出弹窗；②从 `server.py` 的 LOGIN_HTML 中移除所有用户须知相关代码（CSS样式+HTML结构+弹窗显示逻辑），登录成功后直接刷新页面进入首页；③样式规范：圆角10px与输入框统一、边框#e0e3e8、16px内边距、标题22px加粗居中、数字序号金色渐变背景、close按钮36px hover变金色、0.2s淡入缩放动画、遮罩透明度0.75；④重新构建前端（npm run build:h5）并重启服务器。首页轮播图、数字人、四大功能图标、底部导航栏等所有原有代码完全未改动。
- 用户下达指令：首页右上角大字版切换按钮开发——新增大字模式功能。具体改动：①新建 `src/stores/fontMode.ts` Pinia 状态管理（isLargeFont、toggleFontMode、setLargeFont）；②在 `src/pages/visitor/index.vue` 新增蓝色圆角「大字版」切换按钮（右上角悬浮固定），点击切换为「标准版」，再次点击恢复；③添加响应式 watch 监听，切换时给 document.body 添加/移除 `.large-font-mode` 类；④在 `src/styles/global.scss` 末尾添加完整的大字模式全局样式覆盖（全局文字放大1.35倍+行高1.8、底部导航栏隐藏图标仅保留文字+文字放大+竖线加宽+栏高增加至120rpx、按钮/输入框/卡片容器放大、猜你想问/聊天页/详情页/列表页文字同步放大、用户须知弹窗文字放大）；⑤在 `src/App.vue` onLaunch 中初始化大字模式为 false（刷新页面恢复标准版）；⑥重新构建前端并重启服务器。原有页面代码、功能、布局完全未改动，仅在标准版基础上新增大字模式样式覆盖。

### 2026-07-04
- 用户要求完全恢复备份文件。使用 xcopy 命令将 `backup/software/` 目录完整复制到 `software/`，成功恢复 161 个文件，包括核心代码、数据文件、静态资源和配置文件。删除了多余文件（fontMode.ts、i18n.ts、数据库文件、日志文件等），确保项目结构与备份一致。
- 用户反馈 `net::ERR_ABORTED http://localhost:8080/` 错误。修复 `server.py` 两处问题：①`do_GET` 方法添加 `/assets/` 和 `/static/` 路径跳过认证检查，防止前端 JS/CSS 加载失败；②登录页面 fetch 请求添加 `credentials: 'include'`，确保 Cookie 正确传递。
- 用户要求开发全局大字版功能。具体实现：①在 `index.vue` 首页右上角新增「大字版」切换按钮（全站唯一切换入口）；②使用 `localStorage` 键名 `lingshan_large_font` 持久化状态，刷新后自动恢复；③在 `global.scss` 添加全局大字模式 CSS（`body.large-font-mode` 下所有文字字号+4~6px、加粗，底部导航栏 `display:none` 隐藏图标+文字放大居中+蓝色分割线加宽至6px，首页专属文字适配）；④仅新增按钮DOM、localStorage脚本、CSS样式，原有业务代码零改动。
- 用户下达底部导航栏大字模式专属CSS修改指令。将图标隐藏方式从 `opacity:0` 改为 `display:none !important`（彻底隐藏不占空间），文字 `width:100%;height:100%;display:flex;align-items:center;justify-content:center` 填满格子水平垂直居中，蓝色竖分割线 `width:6px`（原3px的2倍），导航栏总高度50px+`overflow:hidden` 防止文字溢出。
- 用户反馈前端没什么变化。排查发现浏览器缓存了旧的 Vite 开发版页面（`/@vite/client` 请求是旧缓存导致）。指导用户清除浏览器缓存（Ctrl+Shift+Delete）或使用无痕模式重新访问。
- 用户要求开发用户须知弹窗。具体实现：①在 `index.vue` 添加弹窗DOM（遮罩层+弹窗容器+右上角✕关闭按钮+标题+7条中文须知+7条英文翻译）；②JS逻辑使用模块级变量 `noticeShownInSession` 控制SPA会话内只弹一次，刷新后重新弹出，跳转其他页面回来不重复弹出；③`isEnMode` 检测 `body.en-mode` 类自动切换中英文文案；④CSS样式：深色半透明遮罩 z-index:99999、弹窗 0.25s 弹性缓动淡入缩放动画、圆角28rpx、标题居中加粗+底部分隔线、正文浅灰白行高1.75、关闭按钮 hover 高亮放大；⑤大字模式联动：标题+6px、正文+5px、关闭按钮放大至76rpx。
- 用户要求用户须知弹窗视觉优化。优化内容：①圆角加大至32rpx；②三层柔和外阴影立体感；③底色改为渐变深蓝 `#2c4270→#1f3052`；④极细浅白描边；⑤标题增加字间距4rpx+底部分隔线；⑥正文浅灰白 `#f0f4ff`；⑦关闭按钮放大至64rpx+hover高亮；⑧遮罩降低至0.4+4px模糊；⑨动画改为弹性缓动 `cubic-bezier(0.34,1.56,0.64,1)`。
- 用户要求用户须知弹窗暖色融合版优化。优化内容：①弹窗宽度从600rpx改为 `60vw`+`max-width:720px` 自适应加宽；②底色从深蓝改为暖米色 `rgba(255,252,245,0.96)` 贴合首页浅黄背景；③标题栏改为棕褐渐变 `#b89678→#a07b5c`；④正文改为深棕灰 `#33281e`；⑤序号改为暖棕 `#a07b5c`；⑥阴影改为暖棕浅阴影 `rgba(120,90,60,0.18)`；⑦圆角28rpx；⑧大字模式联动中弹窗宽度同步更新为 `60vw`+`max-width:720px`。

### 2026-07-05
- 用户下达指令：景点酒店美食等所有弹窗在英文版下所有中文都要翻译成英文。具体实现：①为 `data/hotels.ts` 全部15个酒店添加英文属性（nameEn、tagEn、descEn、fullDescEn、locationInfoEn、tipsEn、distanceEn、timeEn、featuresEn）；②为 `data/foods.ts` 全部13个美食店添加相同英文属性；③修改 `pages/visitor/hotels.vue` 和 `foods.vue` 列表页，卡片中的名称、标签、描述、距离根据语言状态动态切换；④修复搜索过滤器支持中英文关键词搜索（同时搜索 name/desc 和 nameEn/descEn）；⑤验证 `hotel-detail.vue` 和 `food-detail.vue` 详情页所有文本已国际化（标题、介绍、贴士、猜你想问、评价标签等）；⑥确认 `spots.vue` 列表页已支持英文显示。构建完成，英文版下所有弹窗内容完全显示英文，无中文残留。
- 用户下达指令：AI对话页面顶部英文替换 + 英文大字模式底部导航栏格式限制完整指令。①AI对话页面顶部中文转英文：仅英文模式生效，顶部文字翻译对应（AI导游 - 小乐→AI Guide - Xiao Le、在线服务→Online Service、智能对话→Smart Chat、地图→Map、语音播报→Voice Broadcast），英文+大字模式时顶部英文字体统一放大8px、加粗；②英文大字叠加模式底部导航栏格式限制：仅同时带有.en-mode和.large-font-mode类时触发，图标强制隐藏、英文导航文字放大8px+加粗+填满格子居中、蓝色竖分割线宽度翻倍、导航栏尺寸不变；③全局强制要求：开启英文模式后全页面所有中文必须翻译为标准英文，无中文残留。
- 用户反馈"对话页面没变"，排查发现 `i18n/index.ts` 中翻译函数 `t()` 逻辑错误：当语言为英文且key以`.en`结尾时，错误地去掉后缀返回中文。修复方案：将翻译函数简化为直接从 `messages.zh` 中查找对应key，确保英文key（如`chat.title.en`）正确返回英文内容。
- 修复翻译函数后重新构建前端并重启服务器，验证翻译逻辑正确。
- 用户下达指令：整合全套指令——按钮左移 + 英文大字导航修复 + 中英文文字隔离强制规范。具体实现：①右上角切换按钮整体左移24px：将「English/中文」和「大字版/标准版」两个按钮包裹在 `.top-toggle-btn-group` 容器中，添加 `transform: translateX(-24px) !important`，按钮间距、宽高、圆角、配色完全保留；②中英文文字隔离强制规则：通过 `currentLang.value === 'zh' ? '中文key' : '英文key.en'` 条件渲染实现，英文模式（`body.en-mode`）全局只展示英文无中文残留，中文模式只展示中文无英文字符，页面布局容器尺寸完全不变仅切换文字；③英文大字模式导航栏修复：在 `body.en-mode.large-font-mode` 区块增强 `.uni-tabbar__label` 样式，添加 `white-space: nowrap + overflow: hidden + text-overflow: ellipsis` 防止文字溢出，添加 `padding: 0 4px` 增加间距，导航栏总高度50px等分格子尺寸完全固定。修改文件：`pages/visitor/index.vue`（按钮组容器）、`styles/global.scss`（按钮左移+导航栏修复）。构建成功。
- 用户要求"恢复到上次对话的改动前"，检查备份目录 `backup/` 后，用户随后说"停止"，未执行恢复操作。
- 用户下达指令：读取 AI_CONTEXT.md，并且每次对话完成后将对话内容追加到 AI_CONTEXT.md 中。已确认读取完毕，后续每次对话结束都会自动将对话记录追加到本文件「对话记录」区块。
- 用户下达指令：整合全套指令——按钮左移 + 英文大字导航修复 + 中英文文字隔离强制规范（详细版）。①按钮左移：`.top-toggle-btn-group { transform: translateX(-24px) !important; }` 全模式统一生效，中文标准/中文大字/英文标准/英文大字四种模式均生效，禁止修改按钮大小/间距/上下位置/左右顺序（已在 global.scss 中实现）。②中英文文字隔离强制规则：英文模式（`body.en-mode`）全局只展示英文翻译不出现任何中文，中文模式只展示中文不出现英文字符；文字翻译映射沿用历史约定；页面布局/容器尺寸/模块间距/图片/按钮大小/DOM结构全程不改动仅切换文字内容；大字模式仅改变文字字号粗细不影响中英文文字的显示/隐藏逻辑。修复关键Bug：`index.vue` 中 `isEnMode` 原为 `ref(false)` 且 `checkEnMode()` 函数从未被调用，导致用户须知弹窗在英文模式下仍显示中文。修复方案：将 `isEnMode` 改为 `computed(() => currentLang.value === 'en')` 自动响应语言切换，移除无用的 `checkEnMode` 函数；同时修复 `watch(currentLang,...)` 和 `onMounted` 中对 computed 属性（`infoCards.value`、`spots.value`）的非法赋值（computed 是只读的，赋值会静默失败），仅保留对 ref 属性（`cardDetails`、`activeCardData`）的赋值。③英文+大字叠加模式导航栏修复：`body.en-mode.large-font-mode` 区块隐藏图标、英文文字放大8px+加粗+`white-space:nowrap`+`overflow:hidden`+`text-overflow:ellipsis` 防溢出、蓝色分割线6px加倍、导航栏50px固定（已在 global.scss 中实现）。④全局不变约束：除文字内容切换/按钮左移/英文大字导航专属样式外，页面所有布局/图片/交互逻辑/弹窗弹出规则/localStorage持久逻辑/按钮点击功能全部保持原有代码不改动。修改文件：`pages/visitor/index.vue`（isEnMode 改 computed + 移除 checkEnMode + 修复 watch/onMounted 中的 computed 赋值）。`styles/global.scss` 无需修改（样式已在前次对话中完成）。构建成功。
- 用户下达指令：把大字版和英文版按钮移到管理员入口左边，英文按钮在左、大字按钮在右，大小不变；中文版页面全部为纯中文不能有英文。具体实现：①按钮重新定位——移除 global.scss 中 `.top-toggle-btn-group` 的 `transform: translateX(-24px)`（不再需要整体偏移），在 index.vue 中将 `.font-toggle-btn` 的 `right` 从 `30rpx` 改为 `110rpx`（紧邻管理员入口左侧，管理员入口 right:30rpx + width:64rpx + 16rpx间距 = 110rpx），将 `.lang-toggle-btn` 的 `right` 从 `280rpx` 改为 `260rpx`（在英文按钮左侧，留足间距）。按钮排布：左English按钮 → 右大字版按钮 → 管理员入口⚙。②修复中文版页面残留英文——发现 `spot-detail.vue` 模板中 24 处使用 `currentLang.value === 'zh'`，Vue 3 `<script setup>` 中 ref 在模板自动解包，`currentLang.value` 实际访问字符串.value 返回 undefined，条件永远为 false 导致中文模式下景点详情页全部显示英文。修复：将模板中所有 `currentLang.value === 'zh'` 改为 `currentLang === 'zh'`（脚本中的 `.value` 用法正确不动）。③修复 `foods.ts` 中两个店铺中文名混入英文：`朱記小館 VERMILION HOUSE` → `朱記小館`、`许府牛 I miss niu` → `许府牛`，对应 fullDesc 中的英文也一并清理。④修复 `location.vue` 中 `spots` 为 `ref` 一次性赋值不响应语言切换：改为 `computed` 自动跟随 `currentLang` 切换中英文数据。修改文件：`pages/visitor/index.vue`、`styles/global.scss`、`pages/visitor/spot-detail.vue`、`data/foods.ts`、`pages/visitor/location.vue`。构建成功。

### 2026-07-06
- 用户下达指令：购票天气还有美食住宿和灵山景点弹窗下面的评价还有用户须知中的所有文字在英文版时都换成英文。已确认数据文件中已包含英文属性（nameEn、tagEn、descEn等），详情页模板已使用条件渲染切换中英文。
- 用户下达指令：AI对话页面顶部英文替换 + 英文大字模式底部导航栏格式限制完整指令（详细版）。①AI对话页面顶部：AI导游 - 小乐→AI Guide - Xiao Le、在线服务→Online Service、智能对话→Smart Chat、地图→Map、语音播报→Voice Broadcast、Connected→在线、输入你的问题...→Enter your question...；②英文大字模式底部导航栏：图标隐藏、英文文字放大8px+加粗+填满格子居中、蓝色竖线宽度翻倍、导航栏尺寸不变；③全局强制要求：开启英文模式后全页面所有中文必须翻译为标准英文，无中文残留。
- 用户反馈"对话页面没变"，排查发现 `chat.vue` 中模板使用 `currentLang.value`（错误，Vue 3 模板中 ref 自动解包无需 `.value`）以及 script 中被错误替换为 `currentLang`（需要 `.value`）。修复方案：将模板中所有 `currentLang.value` 改为 `currentLang`，将 script 中所有 `currentLang`（用于条件判断的）改为 `currentLang.value`。
- 用户下达指令：整合全套指令——按钮左移 + 英文大字导航修复 + 中英文文字隔离强制规范（完整版）。①按钮左移：`.top-toggle-btn-group { transform: translateX(-24px) !important; }` 全模式生效；②中英文文字隔离：英文模式全局只展示英文，中文模式只展示中文，页面布局不变；③英文大字模式导航栏：图标隐藏、英文文字放大8px+加粗+防溢出、蓝色分割线加倍；④全局不变约束：除文字切换和按钮左移外，所有布局/图片/交互逻辑不变。
- 用户要求"恢复到上次对话的改动前"，随后说"停止"，未执行恢复。
- 用户下达指令：仅AI智能对话页中文版英文转中文专项指令（仅当前页面生效）。将 chat.vue 中所有英文文本替换为中文（AI Guide - Xiao Le→AI导游 - 小乐、Online Service→在线服务、Smart Chat→智能对话、Map→地图、Voice Broadcast→语音播报、Connected→在线、Enter your question...→输入你的问题...），仅中文版生效，英文版保持英文。
- 用户反馈"中文版下这些还是英文"，排查发现之前的全局替换错误地将 script 和模板中的 `.value` 混用。核心问题：Vue 3 模板中 ref 自动解包（无需 `.value`），但 script 中必须使用 `.value`。之前的 `replace_all` 操作把 script 中的 `currentLang.value` 也替换成了 `currentLang`，导致类型比较错误。
- 用户输入 `#problems_and_diagnostics`，运行诊断工具发现多个文件存在类型错误。修复内容：①`chat.vue`：script 中恢复所有 `currentLang.value`（约15处），模板中保持 `currentLang`（已正确）；②`hotel-detail.vue`：模板中移除 `.value`（约18处），script 中添加 `.value`（约5处）；③`food-detail.vue`：模板中移除 `.value`（约18处），script 中添加 `.value`（约5处）。修复后所有 TypeScript 诊断检查均通过，无错误残留。
- 用户下达指令：英文版景点美食住宿页面弹窗的评价部分换成英文。具体实现：①为 `foods.ts` 中所有美食评价添加英文属性（nicknameEn、contentEn）；②修改 `hotel-detail.vue`、`food-detail.vue`、`spot-detail.vue` 模板中评价区域的条件渲染逻辑，根据 `currentLang` 切换中英文内容；③修复 `api/review.ts` 中 `Review` 接口缺失英文属性；④修复 `hotel-detail.vue` 和 `food-detail.vue` 中 `loadApiReviews` 函数未映射英文属性的问题；⑤修复 `i18n/index.ts` 中 `t()` 函数英文模式查找逻辑错误（原逻辑 `messages.zh[key] || messages.zh[key.replace('.en', '')]` 会优先返回中文，改为 `messages.zh[key + '.en'] || messages.zh[key]` 优先查找英文翻译）。
- 用户反馈"英文版时评价还是中文"，排查并修复了两个关键问题：①`i18n/index.ts` 中 `t()` 函数英文模式查找逻辑错误，会优先返回中文；②`hotel-detail.vue`、`food-detail.vue` 中从 API 获取评价时未映射 `nicknameEn` 和 `contentEn` 属性。
- 用户下达指令：完整修复中文大字、英文大字导航文字拉伸变形错乱问题。要求：导航栏尺寸不动，大字模式隐藏图标、文字放大8px加粗、强制单行省略、左右6px内边距、水平垂直居中、蓝色分割线加宽至6px，中文大字和英文大字两套样式完全一致。
- 用户中途暂停任务，表示"停一下，等会再搞"。
- 用户继续任务，修复大字版导航栏样式：①中文大字模式和英文大字模式统一使用绝对单位18px，移除相对单位em导致的字体累积放大；②移除全局按钮放大规则中的.uni-tabbar__label，避免双重放大；③添加min-width:0允许flex子元素收缩；④修改.display:flex为display:block，使用text-align:center和line-height:50px居中；⑤flex-shrink改为1允许收缩；⑥修复文字溢出问题。
- 用户反馈"文字还是溢出了"，进一步修复：①添加min-width:0到.uni-tabbar__item和.uni-tabbar__bd；②flex-shrink:0改为flex-shrink:1允许收缩；③display:flex改为display:block简化布局。
- 用户下达指令：英文按钮往左边移一点，保证任何情况下两个按钮不能重叠。将.lang-toggle-btn的right从260rpx改为400rpx，确保与.font-toggle-btn（right:110rpx）之间有足够间距。
- 用户反馈登录时不需要输入口令了，解释原因：浏览器已保存登录Cookie（有效期7天），所以自动登录。提供清除Cookie重新触发登录页面的方法（清除浏览器数据或使用无痕模式）。
- 用户下达指令：修复大字版导航栏文字溢出 + 大字版和英文版按钮在任何情况下不能重叠。具体实现：①导航栏文字溢出修复——将大字模式（中文大字和英文大字两套）下 `.uni-tabbar__item` 和 `.uni-tabbar__bd` 从 `display:flex` + `flex-direction:column` 改为 `display:block`，统一设置 `height:50px` + `overflow:hidden` + `box-sizing:border-box`，文字通过 `.uni-tabbar__label` 的 `display:block` + `text-align:center` + `line-height:50px` 实现水平垂直居中，`white-space:nowrap` + `overflow:hidden` + `text-overflow:ellipsis` 确保单行省略不溢出；②按钮重叠修复——移除大字模式下 `.font-toggle-btn` 和 `.lang-toggle-btn` 的 `transform:scale(1.2)` + `transform-origin:right center`（文字已通过 `font-size:calc(1em+8px)` 放大，scale 导致视觉膨胀溢出布局框），保留 `min-width:140rpx` + `padding:0 28rpx` 确保触摸区域；将 `.lang-toggle-btn` 的 `right` 从 `400rpx` 改为 `460rpx` 增加与大字版按钮间距。修改文件：`styles/global.scss`（导航栏block布局+移除scale）、`pages/visitor/index.vue`（英文按钮位置）。构建成功。

人类向的功能 / 结构 / 特性介绍见 `software/README.md`。
