# AI数字人景区导览系统

基于AI数字人的智能景区导览服务系统，采用UniApp + Vue3 + TypeScript技术栈开发。

## 项目简介

本系统旨在解决传统景区导游服务中存在的以下痛点：
- 导游资源稀缺 - AI数字人提供7x24小时服务
- 信息单向传递 - 多模态智能交互提升体验
- 缺乏情感连接 - 情感分析实现个性化服务
- 管理盲区 - 数据分析助力精准管理

## 功能模块

### 游客端
- **首页** - AI数字人形象展示、快捷功能入口、热门景点推荐
- **智能导览** - 多模态交互（文字/语音）、智能问答、情感识别
- **游览路线** - 个性化路线推荐、兴趣偏好选择、景点详情查看

### 管理端
- **管理后台** - 核心数据统计、热门问答排行、满意度趋势
- **知识库管理** - 知识文档的增删改查、分类标签管理
- **数字人管理** - 数字人形象配置、声音/表情/服装设置
- **数据报告** - 情感趋势分析、热门问答排行、服务建议
- **数据大屏** - 实时数据监控、服务趋势、情绪分布可视化

## 技术栈

### 前端
- **框架**: UniApp + Vue 3
- **语言**: TypeScript
- **状态管理**: Pinia
- **样式**: SCSS
- **构建工具**: Vite

### 数据
- **Mock数据**: 开发测试用模拟数据
- **API服务**: RESTful API接口设计

## 项目结构

```
src/
├── api/                  # API接口定义
│   └── index.ts
├── data/                 # Mock数据
│   └── mock.ts
├── pages/                # 页面组件
│   ├── admin/            # 管理端页面
│   │   ├── index.vue     # 管理后台首页
│   │   ├── knowledge.vue # 知识库管理
│   │   ├── avatar.vue    # 数字人管理
│   │   ├── report.vue    # 数据报告
│   │   ├── dashboard.vue  # 数据大屏
│   │   └── login.vue     # 管理员登录
│   └── visitor/          # 游客端页面
│       ├── index.vue     # 首页
│       ├── chat.vue      # 智能导览
│       └── routes.vue     # 游览路线
├── static/               # 静态资源
│   ├── icons/           # TabBar图标
│   └── avatars/          # 数字人头像
├── stores/               # Pinia状态管理
│   ├── chat.ts           # 聊天状态
│   └── user.ts           # 用户状态
├── styles/               # 全局样式
│   ├── variables.scss    # SCSS变量
│   └── global.scss       # 全局样式
├── types/                # TypeScript类型定义
│   └── index.ts
├── utils/                # 工具函数
│   └── request.ts        # HTTP请求封装
├── App.vue               # 应用入口
├── main.ts               # 主进程入口
├── pages.json            # 页面路由配置
└── manifest.json         # 应用配置
```

## 快速开始

### 安装依赖
```bash
npm install
```

### 开发模式
```bash
npm run dev:h5
```

### 构建生产版本
```bash
npm run build:h5
```

### 微信小程序
```bash
npm run dev:mp-weixin
npm run build:mp-weixin
```

## 访问地址

- H5: http://localhost:5173/
- 微信小程序: 需要在微信开发者工具中导入项目

## 默认账号

- 用户名: admin
- 密码: admin123

## 主要特性

1. **多模态交互** - 支持文字和语音两种交互方式
2. **情感识别** - 实时分析用户情感，提供个性化服务
3. **智能推荐** - 根据用户兴趣偏好推荐游览路线
4. **数据可视化** - 直观展示服务数据和用户反馈
5. **响应式设计** - 适配多种屏幕尺寸
6. **模块化架构** - 便于维护和扩展

## 开发说明

### 目录规范
- 使用 `@/` 别名指向 `src/` 目录
- 页面组件放在 `pages/` 目录下
- 公共组件放在uni-app组件目录
- 样式文件使用SCSS预处理器

### 状态管理
- 使用 Pinia 进行状态管理
- chat store: 管理聊天记录和消息发送
- user store: 管理用户登录状态

### API设计
- 基于 RESTful API 设计
- 使用 Promise 封装请求
- 集成 Token 认证

## 许可证

MIT License

## 环境配置（团队协作）

三人小组开发，每人本地需准备以下环境。**系统软件各装各的、不跟着代码走；项目依赖各自用命令生成，不要互相拷 `node_modules`。**

### 系统环境（每台电脑装一次）

| 软件 | 版本要求 | 谁需要 | 下载 |
|---|---|---|---|
| Node.js | **22 LTS**（≥18 可用；禁用 v16，会报 `crypto.getRandomValues` 错） | 改 / 构建前端的人 | https://nodejs.org |
| Python | **3.8+**（本项目开发用 3.13） | 跑后端 server.py 的人 | https://www.python.org |

> 只分工跑后端、不改前端的同学可以不装 Node；想预览前端成品时，让改前端的同学把构建好的 `dist/` 拷给你即可。

### 安装项目依赖

进入 `software/` 目录后执行：

```bash
# 前端依赖（会生成 node_modules，约 235MB，不要拷给别人）
npm install

# 后端依赖（edge-tts 是唯一的第三方 Python 包）
pip install -r requirements.txt
```

### 运行

| 命令 | 作用 | 地址 |
|---|---|---|
| `npm run dev:h5` | 前端开发服务器（热更新，改代码实时看效果） | http://localhost:5173 |
| `npm run build:h5` | 构建生产版本到 `dist/build/h5/` | — |
| `python server.py` | 后端服务器（发 dist + AI 对话 + TTS 语音） | http://localhost:8080 |

开发时建议同时跑 `npm run dev:h5`（5173）和 `python server.py`（8080）：前端改动实时生效，`/api` 会代理到 8080，AI 对话和语音也能调通。

### 对外分享（公网隧道）

双击根目录 `启动隧道.vbs`，会把 8080 暴露成一个临时公网网址，弹窗显示并复制到剪贴板。把网址 + 访问口令 `lingshan2026` 发给别人即可。停止用 `停止隧道.vbs`。

### 交接代码给队友

- ✅ 给：源码、`package.json`、`package-lock.json`、`requirements.txt`、`README.md`、`AI_CONTEXT.md`（根目录，给队友 AI 看的上下文）
- ❌ 不给：`node_modules/`（235MB，队友自己 `npm install`）、`dist/`（构建产物，各自 `npm run build:h5`）

