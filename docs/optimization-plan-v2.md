# 产品优化方案 · 第二版

> 本版在「开发方案 v1（Phase 0-5）」基础上，叠加了**真实可用性测试**发现的问题与修复，作为下一阶段的执行依据。

## 一、当前进度回顾

| 阶段 | 状态 | 产出 |
|------|------|------|
| Phase 0 工程地基 | ✅ 完成 | 共享服务层（shared/）+ 账号体系（users/books/user_id）+ 词库分库 schema |
| Phase 1 手机端适配 | ✅ 完成 | 底部 TabBar + 响应式 + PWA（manifest/sw/图标） |
| 可用性测试 | ✅ 完成 | CDP 浏览器驱动逐页走查，发现 6 个问题 |
| 可用性修复 | ✅ 完成 4 项 | 测评题号跳号、背单词空态引导、首页按钮/掌握度、单词库筛选、重置进度 |

**待修复的小项**：AI 对话页遗留会话「nihao」清理（数据残留，无代码问题）。

## 二、短期（可用性再打磨，无重大决策）

1. 清理遗留测试会话（「nihao」）。
2. 「重置学习进度」后引导用户进入首轮学习（避免又回到空壳）。
3. 补一张「空状态」图：当词库为空/全学完时，各页给出明确引导而非空白。
4. 前端严格类型检查：清理 4 个既有 TDesign `theme` 类型不匹配（可选，运行时无影响）。

## 三、中期（Phase 2-4，需决策项见 decision-list.md）

| Phase | 核心任务 | 关键技术 |
|-------|---------|---------|
| Phase 2 微信小程序 | Taro 复用 shared + 登录 + 核心三页 | Taro + wx.login + 后端 HTTPS |
| Phase 3 词库扩充 | 开源词库 + 词根标注 Pipeline + 分场景库 | ECDICT/COCA + 标注脚本 |
| Phase 4 学习能力增强 | 选择题型 + 发音评测 + 每日目标 | 本地干扰项生成 + ASR |

## 四、长期（Phase 5，需决策项见 decision-list.md）

- 云部署 + 跨端数据同步（账号体系已就绪，就差云数据库 + 部署）。

## 五、技术债清单（建议择机处理）

1. **node_modules 稳定性**：本机 npm 受 safe-delete 拦截，装包需用 `command rm` + `env -u NODE_OPTIONS -u CODEBUDDY_TOOL_CALL_ID node npm-cli.js`（方法已记录在项目日志，供后续复用）。
2. **构建命令**：`npm run build` 的 dist 清空同样受拦截，需 `command rm -rf dist && env -u NODE_OPTIONS node node_modules/vite/bin/vite.js build`。
3. **词库规模**：当前 30 词，词根分组 13 个，测评动态题基于已学词生成（已学 0 时动态题为空，需在词库扩充后才有量）。
4. **数据隔离**：账号体系 schema 已就绪，但查询默认单用户（`user_id` 过滤已实现，登录接入即可多用户）。

## 六、推荐执行顺序

1. 短期可用性打磨（遗留会话 + 空状态引导）。
2. 按 decision-list 的答复，推进 Phase 2 → 3 → 4 → 5。
3. 每阶段完成后，用 `web-usability-tool`（已打包到桌面）做一轮可用性回归。
