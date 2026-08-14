import express from "express";
import { v4 as uuidv4 } from "uuid";
import path from "path";
import { fileURLToPath } from "url";
import * as db from "./db.js";
import * as local from "./local.js";
import { streamChat, testApiKey, hasApiKey, getAiConfig, ChatMessage } from "./ai.js";
import { seedWords } from "./seed.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(express.json());

// 初始化词库（幂等）
seedWords();

const MODEL = "deepseek-v4-flash";

const SYSTEM_PROMPT = `你是专业的英语学习助手，擅长词根词源讲解、场景化口语陪练、错题分析和能力测评。
回答用中英结合，英语内容附中文释义，语气鼓励。
针对用户水平（K12/大学生/职场）自动调整难度，回复简洁、聚焦学习目标。`;

function mask(key: string): string {
  if (key.length <= 8) return "****";
  return key.slice(0, 4) + "****" + key.slice(-4);
}

function sse(res: express.Response, obj: Record<string, unknown>): void {
  res.write(`data: ${JSON.stringify(obj)}\n\n`);
}

// ============= 健康检查 =============
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// ============= 模型（固定 deepseek-v4-flash） =============
app.get("/api/models", (req, res) => {
  res.json({ models: [{ modelId: MODEL, name: "DeepSeek V4 Flash" }], defaultModel: MODEL });
});

// ============= API 配置（用户自带 key） =============
app.get("/api/config/ai", (req, res) => {
  const cfg = getAiConfig();
  res.json({
    hasKey: !!cfg.apiKey,
    model: cfg.model,
    baseUrl: cfg.baseUrl,
    apiKeyMasked: cfg.apiKey ? mask(cfg.apiKey) : null,
  });
});

app.post("/api/config/ai", (req, res) => {
  const { apiKey, baseUrl, model } = req.body;
  if (apiKey) db.setApiConfig("deepseek_api_key", apiKey);
  if (baseUrl) db.setApiConfig("deepseek_base_url", baseUrl);
  if (model) db.setApiConfig("deepseek_model", model);
  res.json({ success: true });
});

app.delete("/api/config/ai", (req, res) => {
  db.deleteApiConfig("deepseek_api_key");
  db.deleteApiConfig("deepseek_base_url");
  db.deleteApiConfig("deepseek_model");
  res.json({ success: true });
});

app.post("/api/config/ai/test", async (req, res) => {
  const { apiKey, baseUrl } = req.body;
  if (!apiKey) return res.status(400).json({ error: "请先填写 API Key" });
  const r = await testApiKey(apiKey, baseUrl);
  res.json(r);
});

// ============= 会话 =============
app.get("/api/sessions", (req, res) => {
  const sessions = db.getAllSessions();
  const withCount = sessions.map(s => ({
    ...s,
    messageCount: db.getMessagesBySession(s.id).length,
  }));
  res.json({ sessions: withCount });
});

app.get("/api/sessions/:sessionId", (req, res) => {
  const { sessionId } = req.params;
  const session = db.getSession(sessionId);
  if (!session) return res.status(404).json({ error: "会话不存在" });
  const messages = db.getMessagesBySession(sessionId).map(m => ({
    ...m,
    tool_calls: m.tool_calls ? JSON.parse(m.tool_calls) : null,
  }));
  res.json({ session, messages });
});

app.post("/api/sessions", (req, res) => {
  const { model = MODEL, title = "新对话" } = req.body;
  const now = new Date().toISOString();
  const session = db.createSession({
    id: uuidv4(),
    title,
    model,
    sdk_session_id: null,
    created_at: now,
    updated_at: now,
  });
  res.json({ session });
});

app.patch("/api/sessions/:sessionId", (req, res) => {
  const { sessionId } = req.params;
  const { title, model } = req.body;
  const ok = db.updateSession(sessionId, { title, model });
  if (!ok) return res.status(404).json({ error: "会话不存在" });
  res.json({ success: true });
});

app.delete("/api/sessions/:sessionId", (req, res) => {
  const { sessionId } = req.params;
  const ok = db.deleteSession(sessionId);
  if (!ok) return res.status(404).json({ error: "会话不存在" });
  res.json({ success: true });
});

// ============= 本地能力 =============
app.get("/api/words/lookup", (req, res) => {
  const word = String(req.query.word || "");
  const r = local.lookupWord(word);
  if (r.found && r.word) {
    const w = db.getWord(r.word.word);
    if (w) local.addWordToMemory(w.id);
  }
  res.json(r);
});

// 单词库：按词根分组
app.get("/api/words/list", (req, res) => {
  const book = req.query.book ? String(req.query.book) : null;
  const words = book ? db.getWordsByBook(book) : db.getAllWords();
  // 已学状态映射
  const learnedMap = new Map<string, number>();
  for (const m of db.getAllWordMemory()) {
    learnedMap.set(m.word_id, m.level);
  }
  const groups = new Map<string, { root: string; rootMeaning: string; words: any[] }>();
  for (const w of words) {
    const key = w.root || '其他';
    if (!groups.has(key)) {
      groups.set(key, { root: key, rootMeaning: w.root_meaning || '', words: [] });
    }
    groups.get(key)!.words.push({
      ...w,
      learned: learnedMap.has(w.id),
      level: learnedMap.get(w.id) ?? 0,
    });
  }
  res.json({ groups: Array.from(groups.values()), total: words.length });
});

// 词库列表（Phase 3 分库）
app.get("/api/books", (_req, res) => {
  const books = db.listBooks();
  const counts = new Map(db.getBookWordCounts().map(c => [c.book_id, c.count]));
  res.json({
    books: books.map(b => ({ ...b, count: counts.get(b.id) ?? 0 })),
  });
});

// 单词库：搜索
app.get("/api/words/search", (req, res) => {
  const q = String(req.query.q || '');
  if (!q) return res.json({ words: [] });
  res.json({ words: db.searchWords(q) });
});

// 单词库：加入学习计划（记忆库）
app.post("/api/words/learn", (req, res) => {
  const { wordId } = req.body;
  if (!wordId) return res.status(400).json({ error: "参数错误" });
  local.addWordToMemory(wordId);
  res.json({ success: true });
});

// 学习中心统计
app.get("/api/stats", (req, res) => {
  const now = new Date().toISOString();
  const totalWords = db.getWordCount();
  const allMemory = db.getAllWordMemory();
  const learnedCount = allMemory.length;
  const dueWords = db.getDueWords(now).length;
  const dueMistakes = db.getDueMistakes(now).length;
  const mistakeCount = db.getMistakes().length;
  const newWordsCount = Math.max(0, totalWords - learnedCount);

  // 掌握度分布（0-5）
  const levelDist = [0, 0, 0, 0, 0, 0];
  for (const m of allMemory) {
    const lv = Math.min(5, Math.max(0, m.level || 0));
    levelDist[lv] += 1;
  }

  res.json({
    totalWords,
    learnedCount,
    dueCount: dueWords + dueMistakes,
    dueWords,
    dueMistakes,
    mistakeCount,
    newWordsCount,
    levelDist,
  });
});

// 重置学习进度（清空记忆库与错题本）
app.post("/api/reset-progress", (req, res) => {
  db.resetProgress();
  res.json({ success: true });
});

app.get("/api/review/today", (req, res) => {
  res.json({ items: local.getTodayReview() });
});

// 背单词队列：到期复习词 + 新词
app.get("/api/recite/queue", (req, res) => {
  const now = new Date().toISOString();
  const due = db.getDueWords(now).map(w => ({
    id: w.word_id,
    word: w.word,
    meaning: w.meaning,
    level: w.level,
  }));
  const learnedIds = new Set(db.getAllWordMemory().map(m => m.word_id));
  const newWords = db.getAllWords()
    .filter(w => !learnedIds.has(w.id))
    .slice(0, 10)
    .map(w => ({
      id: w.id,
      word: w.word,
      phonetic: w.phonetic,
      meaning: w.meaning,
      root: w.root,
      root_meaning: w.root_meaning,
      etymology: w.etymology,
      scene_tag: w.scene_tag,
      scene_example: w.scene_example,
    }));
  res.json({ due, newWords });
});

app.post("/api/review/record", (req, res) => {
  const { type = 'word', id, result } = req.body;
  if (!id) return res.status(400).json({ error: "参数错误" });

  if (type === 'mistake') {
    if (!["remember", "forget"].includes(result)) {
      return res.status(400).json({ error: "错题自评只支持 remember / forget" });
    }
    const outcome = local.recordMistakeReview(id, result);
    if (!outcome) return res.status(404).json({ error: "错题不存在" });
    return res.json({ success: true, outcome });
  }

  if (!["remember", "fuzzy", "forget"].includes(result)) {
    return res.status(400).json({ error: "参数错误" });
  }
  const outcome = local.recordReview(id, result);
  res.json({ success: true, outcome });
});

app.get("/api/scenes", (req, res) => {
  res.json({ scenes: local.getSceneTemplates() });
});

app.get("/api/scenes/:tag", (req, res) => {
  const scene = local.getSceneTemplate(decodeURIComponent(req.params.tag));
  if (!scene) return res.status(404).json({ error: "场景不存在" });
  res.json({ scene });
});

app.get("/api/assessment/questions", (req, res) => {
  res.json(local.getAssessmentQuestions());
});

app.post("/api/assessment/grade", (req, res) => {
  const { sessionId, answers } = req.body;
  if (!sessionId) return res.status(400).json({ error: "缺少 sessionId" });
  res.json(local.gradeAssessment(sessionId, answers || []));
});

app.get("/api/mistakes", (req, res) => {
  res.json({ mistakes: local.listMistakes() });
});

// ============= 聊天（意图分流：本地 / deepseek / 降级） =============
app.post("/api/chat", async (req, res) => {
  const { sessionId, message, agentId } = req.body;

  if (!message) return res.status(400).json({ error: "消息不能为空" });

  const now = new Date().toISOString();
  let session = sessionId ? db.getSession(sessionId) : null;
  if (!session) {
    session = db.createSession({
      id: sessionId || uuidv4(),
      title: message.slice(0, 30) + (message.length > 30 ? "..." : ""),
      model: MODEL,
      sdk_session_id: null,
      created_at: now,
      updated_at: now,
    });
  }

  const userMessageId = uuidv4();
  const assistantMessageId = uuidv4();

  db.createMessage({
    id: userMessageId,
    session_id: session.id,
    role: "user",
    content: message,
    model: null,
    created_at: now,
    tool_calls: null,
  });

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  sse(res, { type: "init", sessionId: session.id, userMessageId, assistantMessageId, model: MODEL });

  const intent = local.classifyIntent(message, agentId);
  console.log(`[Chat] intent=${intent}, agentId=${agentId || "default"}`);

  let assistantContent = "";
  let cardType: "review" | "assessment" | null = null;

  try {
    if (intent === "lookup") {
      // 本地查词（词根词源 + 词族 + 场景）
      const match = message.trim().match(/[a-zA-Z]+/);
      const target = match ? match[0] : message.trim();
      const result = local.lookupWord(target);
      if (result.found && result.word) {
        const w = db.getWord(result.word.word);
        if (w) local.addWordToMemory(w.id);
      }
      assistantContent = local.formatWordCard(result);
    } else if (intent === "review") {
      const due = local.getTodayReview();
      if (due.length === 0) {
        assistantContent = "🎉 今天没有到期的单词，复习计划已完成。你可以继续学习新词，或输入一个英文单词让我为你讲解词根词源。";
      } else {
        cardType = "review";
        sse(res, { type: "review_card", items: due });
        assistantContent = `今日待复习 ${due.length} 项`;
      }
    } else if (intent === "oral") {
      const scene = local.getSceneTemplate();
      assistantContent = scene ? local.formatScene(scene) : "暂无场景模板，可在设置中配置 API Key 后进行自由口语对话。";
    } else if (intent === "assessment") {
      const { sessionId, questions } = local.getAssessmentQuestions();
      cardType = "assessment";
      sse(res, { type: "assessment_card", sessionId, questions });
      assistantContent = "词根词源能力测评";
    } else if (intent === "mistake") {
      const mistakes = local.listMistakes();
      if (mistakes.length === 0) {
        assistantContent = "📒 错题本还是空的。做几道测评题，答错的会自动归档到这里。";
      } else {
        const lines = [`📒 错题本共 ${mistakes.length} 道：`];
        for (const m of mistakes.slice(0, 20)) {
          lines.push(`• ${m.question}（正确答案：${m.answer || "—"}，你的答案：${m.user_answer || "—"}）`);
        }
        assistantContent = lines.join("\n");
      }
    } else {
      // chat → AI（deepseek）
      if (!hasApiKey()) {
        assistantContent = "⚠️ 尚未配置 API Key，AI 自由对话暂不可用。\n\n你可以使用左侧的本地功能（无需 key）：\n• 「单词库」→ 词根词源查词 + 词族 + 场景\n• 「复习」→ 艾宾浩斯记忆巩固\n• 「测评」→ 词根词源能力测评\n• 「场景口语」→ 情景对话练习\n\n如需自由问答 / 个性化讲解，请在右上角「设置」中填入你的 DeepSeek API Key。";
      } else {
        // 知识注入：提取消息中的英文单词，检索本地词库，命中则注入词根词源上下文
        const englishWords = message.match(/[a-zA-Z]{3,}/g) || [];
        const contexts: string[] = [];
        const seen = new Set<string>();
        for (const w of englishWords) {
          const lw = w.toLowerCase();
          if (seen.has(lw)) continue;
          seen.add(lw);
          const r = local.lookupWord(lw);
          if (r.found && r.word) {
            const parts = r.word.parts.map(p => p.text + (p.meaning ? `(${p.meaning})` : '')).join(' + ');
            contexts.push(`- ${r.word.word}：${r.word.meaning}（拆解：${parts}；词族：${r.word.family.join(' / ')}）`);
          }
        }
        const systemPrompt = SYSTEM_PROMPT + (contexts.length
          ? `\n\n## 本地词库参考（用户消息命中的单词）\n${contexts.join('\n')}\n请优先基于以上本地词库的准确词根词源讲解，保持与词库一致。`
          : '');

        const history = db.getMessagesBySession(session.id);
        const messages: ChatMessage[] = [
          { role: "system", content: systemPrompt },
          ...history
            .filter(m => m.id !== userMessageId)
            .map(m => ({ role: m.role as "user" | "assistant", content: m.content })),
        ];
        await streamChat(messages, delta => {
          assistantContent += delta;
          sse(res, { type: "text", content: delta });
        });
        // 流式已发送完文本，直接落库并结束
        db.createMessage({
          id: assistantMessageId,
          session_id: session.id,
          role: "assistant",
          content: assistantContent,
          model: MODEL,
          created_at: new Date().toISOString(),
          tool_calls: null,
        });
        sse(res, { type: "done" });
        return res.end();
      }
    }

    if (cardType) {
      // 结构化卡片：不发 text，落库摘要后结束
      db.createMessage({
        id: assistantMessageId,
        session_id: session.id,
        role: "assistant",
        content: assistantContent,
        model: "local",
        created_at: new Date().toISOString(),
        tool_calls: null,
      });
      sse(res, { type: "done" });
      return res.end();
    }

    if (!assistantContent) assistantContent = "抱歉，暂时无法处理该请求。";
    sse(res, { type: "text", content: assistantContent });

    db.createMessage({
      id: assistantMessageId,
      session_id: session.id,
      role: "assistant",
      content: assistantContent,
      model: intent === "chat" ? MODEL : "local",
      created_at: new Date().toISOString(),
      tool_calls: null,
    });

    sse(res, { type: "done" });
    res.end();
  } catch (error: any) {
    console.error("[Chat] Error:", error?.message || error);
    sse(res, { type: "error", message: error?.message || "处理请求时发生错误" });
    res.end();
  }
});

// ============= 生产模式：托管前端构建产物 =============
const distPath = path.join(__dirname, "..", "dist");
app.use(express.static(distPath));

app.get("*", (req, res) => {
  if (req.path.startsWith("/api")) {
    return res.status(404).json({ error: "Not found" });
  }
  res.sendFile(path.join(distPath, "index.html"));
});

// Phase 0 账号体系：播种默认本地用户（登录上线前，所有学习数据归属该账号）
db.ensureDefaultUser();

// Phase 3 词库分库：播种词库元数据（幂等）
{
  const now = new Date().toISOString();
  db.upsertBook({ id: 'cet4', name: '四级核心', category: '大学英语四级', description: '四六级词频排序前 600 高频词', created_at: now });
  db.upsertBook({ id: 'cet6', name: '六级核心', category: '大学英语六级', description: '四六级词频排序前 400 六级词', created_at: now });
}

app.listen(PORT, "0.0.0.0", () => {
  console.log(`
╔════════════════════════════════════════════╗
║      ◉ 英语学习助手 API 已启动               ║
║      地址: http://localhost:${PORT}           ║
║      模式: 本地优先 + deepseek-v4-flash      ║
║      数据库: SQLite (data/chat.db)          ║
╚════════════════════════════════════════════╝
  `);
});
