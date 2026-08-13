# 英语学习助手智能体 (English Learning Agent)

本地优先、AI 增强的英语学习 Web 应用。核心思路：**简单功能本地实现（0 token），复杂对话才调用大模型**；单词学习采用**词根词源 + 场景记忆**（替代死记硬背）。

## 核心功能

### 四大学习模式

1. **单词学习** — 词根词源拆解 + 词族串记 + 场景例句 + 艾宾浩斯复习（本地）
2. **场景口语训练** — 内置场景对话模板（本地）+ 自由对话纠错（AI）
3. **错题专项复习** — 错题本归档 + 遗忘曲线定时重测（本地）
4. **英语能力测评** — 本地词根词源题库判分 + 能力分析（本地）

### 本地 vs AI 分工

| 能力 | 本地（0 token） | AI（deepseek-v4-flash） |
|------|----------------|------------------------|
| 单词记忆 | 词根词源库、词族、场景例句、艾宾浩斯调度 | 个性化场景故事、记忆梗 |
| 口语 | 固定场景对话模板 | 自由对话、语法纠错 |
| 错题 | 错题本、分类统计、定时重测 | 同类变式题生成 |
| 测评 | 客观题库判分、能力雷达 | 主观题评分、个性化建议 |

## 技术架构

- **前端**：React 18 + TypeScript + TDesign React + Vite
- **后端**：Express + SSE 流式响应
- **AI**：deepseek-v4-flash（OpenAI 兼容协议，用户自带 API Key）
- **数据库**：SQLite（会话 / 消息 / 词库 / 记忆状态 / 错题 / API 配置）

### 后端模块

```
server/
├── index.ts   # 路由 + 意图分流（本地 / deepseek / 降级）
├── ai.ts      # deepseek 直连（流式 + 超时）
├── local.ts   # 本地能力层（意图分类 + 查词 + 复习 + 场景 + 测评）
├── memory.ts  # 改良艾宾浩斯遗忘曲线算法
├── seed.ts    # 内置词根库示范数据（约 30 词，12 个词根）
└── db.ts      # SQLite（words / word_memory / mistakes / api_config）
```

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 构建并启动

```bash
npm run build
npm run server
```

浏览器访问 **http://localhost:3000**（后端同时托管前端，单进程运行）。

> 也可双击项目根目录的 `start.bat` 一键启动。

### 3. 配置 API Key（可选）

进入应用右上角「设置」，填入你的 DeepSeek API Key（`sk-...`），点击「测试连接」验证。

- **不配置 key**：所有本地功能可用（词根查词、复习、场景口语、测评）
- **配置 key**：解锁自由对话、个性化讲解、语法纠错等 AI 增强功能

Key 保存在后端 SQLite，前端仅显示脱敏形式（`sk-****abcd`）。

## 使用方式

1. 输入一个英文单词（如 `transport`）→ 词根词源拆解 + 词族 + 场景例句
2. 输入「复习」→ 查看今日待复习单词（艾宾浩斯调度）
3. 输入「口语」→ 场景对话模板
4. 输入「测评」→ 词根词源能力测评题
5. 其他输入 → 自由对话（需配置 API Key）

## 项目结构

```
english-learning-agent/
├── server/                 # 后端
│   ├── index.ts           # 路由 + 意图分流
│   ├── ai.ts              # deepseek 直连
│   ├── local.ts           # 本地能力层
│   ├── memory.ts          # 艾宾浩斯算法
│   ├── seed.ts            # 词根库种子数据
│   └── db.ts              # SQLite
├── src/                    # 前端
│   ├── components/        # UI 组件
│   ├── hooks/             # React Hooks
│   └── pages/             # 页面
├── data/                   # SQLite 数据存储
└── dist/                   # 前端构建产物
```

## 技术文档

- [DeepSeek API 文档](https://api-docs.deepseek.com)
- [TDesign React](https://tdesign.tencent.com/react/overview)
