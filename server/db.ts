import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 数据库文件路径
const dbPath = path.join(__dirname, '..', 'data', 'chat.db');

// 确保 data 目录存在
import fs from 'fs';
const dataDir = path.dirname(dbPath);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// 创建数据库连接
const db = new Database(dbPath);

// 启用 WAL 模式以提高性能
db.pragma('journal_mode = WAL');

// 初始化数据库表
db.exec(`
  -- 会话表
  CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    model TEXT NOT NULL,
    sdk_session_id TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  -- 消息表
  CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
    content TEXT NOT NULL,
    model TEXT,
    created_at TEXT NOT NULL,
    tool_calls TEXT,
    FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
  );

  -- 为会话 ID 创建索引
  CREATE INDEX IF NOT EXISTS idx_messages_session_id ON messages(session_id);

  -- 词库表（词根词源 + 场景，静态共享数据）
  CREATE TABLE IF NOT EXISTS words (
    id TEXT PRIMARY KEY,
    word TEXT NOT NULL UNIQUE,
    phonetic TEXT,
    meaning TEXT NOT NULL,
    prefix TEXT,
    prefix_meaning TEXT,
    root TEXT,
    root_meaning TEXT,
    suffix TEXT,
    suffix_meaning TEXT,
    etymology TEXT,
    root_family TEXT,
    scene_tag TEXT,
    scene_example TEXT,
    scene_dialogue TEXT
  );

  -- 单词记忆状态表（用户进度，艾宾浩斯调度）
  CREATE TABLE IF NOT EXISTS word_memory (
    id TEXT PRIMARY KEY,
    word_id TEXT NOT NULL,
    level INTEGER DEFAULT 0,
    review_count INTEGER DEFAULT 0,
    lapse_count INTEGER DEFAULT 0,
    next_review_at TEXT,
    last_review_at TEXT,
    created_at TEXT NOT NULL,
    FOREIGN KEY (word_id) REFERENCES words(id) ON DELETE CASCADE
  );

  -- 错题本表
  CREATE TABLE IF NOT EXISTS mistakes (
    id TEXT PRIMARY KEY,
    question TEXT NOT NULL,
    answer TEXT,
    user_answer TEXT,
    knowledge_point TEXT,
    wrong_count INTEGER DEFAULT 1,
    next_review_at TEXT,
    created_at TEXT NOT NULL
  );

  -- API 配置表（用户 API Key 等，key-value 结构）
  CREATE TABLE IF NOT EXISTS api_config (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );

  -- 用户表（账号体系：跨端数据同步的锚点，Phase 0）
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    nickname TEXT,
    avatar TEXT,
    openid TEXT,
    provider TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  -- 词库分库表（词库扩充的锚点，Phase 3 分场景词库）
  CREATE TABLE IF NOT EXISTS books (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    category TEXT,
    description TEXT,
    created_at TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_word_memory_word_id ON word_memory(word_id);
  CREATE INDEX IF NOT EXISTS idx_word_memory_next_review ON word_memory(next_review_at);
`);

// 数据库迁移：添加 sdk_session_id 列（如果不存在）
try {
  const tableInfo = db.prepare("PRAGMA table_info(sessions)").all() as Array<{ name: string }>;
  const hasColumn = tableInfo.some(col => col.name === 'sdk_session_id');
  if (!hasColumn) {
    db.exec("ALTER TABLE sessions ADD COLUMN sdk_session_id TEXT");
    console.log("[DB] Added sdk_session_id column to sessions table");
  }
} catch (e) {
  // 忽略错误（列可能已存在）
}

// 通用迁移工具：列不存在时添加（Phase 0 账号体系 + 词库分库准备）
function addColumnIfMissing(table: string, column: string, ddl: string): void {
  try {
    const cols = db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
    if (!cols.some(c => c.name === column)) {
      db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${ddl}`);
      console.log(`[DB] Added ${column} column to ${table} table`);
    }
  } catch (e) {
    // 忽略错误（列可能已存在）
  }
}

// 账号体系：学习进度 / 错题本挂到用户维度（默认 null = 本地单用户，向后兼容）
addColumnIfMissing('word_memory', 'user_id', 'TEXT');
addColumnIfMissing('mistakes', 'user_id', 'TEXT');

// 词库扩充：words 表支持分库 + 词频 + 例句
addColumnIfMissing('words', 'book_id', 'TEXT');
addColumnIfMissing('words', 'frequency', 'INTEGER');
addColumnIfMissing('words', 'example', 'TEXT');

// 用户维度索引（列已存在后创建）
try {
  db.exec('CREATE INDEX IF NOT EXISTS idx_word_memory_user_id ON word_memory(user_id)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_mistakes_user_id ON mistakes(user_id)');
} catch (e) {
  // 忽略（列可能存在异常）
}

// 类型定义
export interface DbSession {
  id: string;
  title: string;
  model: string;
  sdk_session_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface DbMessage {
  id: string;
  session_id: string;
  role: 'user' | 'assistant';
  content: string;
  model: string | null;
  created_at: string;
  tool_calls: string | null;
}

// ============= 会话操作 =============

// 获取所有会话
export function getAllSessions(): DbSession[] {
  const stmt = db.prepare('SELECT * FROM sessions ORDER BY updated_at DESC');
  return stmt.all() as DbSession[];
}

// 获取单个会话
export function getSession(id: string): DbSession | undefined {
  const stmt = db.prepare('SELECT * FROM sessions WHERE id = ?');
  return stmt.get(id) as DbSession | undefined;
}

// 创建会话
export function createSession(session: DbSession): DbSession {
  const stmt = db.prepare(`
    INSERT INTO sessions (id, title, model, sdk_session_id, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  stmt.run(session.id, session.title, session.model, session.sdk_session_id, session.created_at, session.updated_at);
  return session;
}

// 更新会话
export function updateSession(id: string, updates: Partial<Pick<DbSession, 'title' | 'model' | 'sdk_session_id'>>): boolean {
  const fields: string[] = [];
  const values: any[] = [];
  
  if (updates.title !== undefined) {
    fields.push('title = ?');
    values.push(updates.title);
  }
  if (updates.model !== undefined) {
    fields.push('model = ?');
    values.push(updates.model);
  }
  if (updates.sdk_session_id !== undefined) {
    fields.push('sdk_session_id = ?');
    values.push(updates.sdk_session_id);
  }
  
  if (fields.length === 0) return false;
  
  fields.push('updated_at = ?');
  values.push(new Date().toISOString());
  values.push(id);
  
  const stmt = db.prepare(`UPDATE sessions SET ${fields.join(', ')} WHERE id = ?`);
  const result = stmt.run(...values);
  return result.changes > 0;
}

// 删除会话
export function deleteSession(id: string): boolean {
  const stmt = db.prepare('DELETE FROM sessions WHERE id = ?');
  const result = stmt.run(id);
  return result.changes > 0;
}

// ============= 消息操作 =============

// 获取会话的所有消息
export function getMessagesBySession(sessionId: string): DbMessage[] {
  const stmt = db.prepare('SELECT * FROM messages WHERE session_id = ? ORDER BY created_at ASC');
  return stmt.all(sessionId) as DbMessage[];
}

// 创建消息
export function createMessage(message: DbMessage): DbMessage {
  const stmt = db.prepare(`
    INSERT INTO messages (id, session_id, role, content, model, created_at, tool_calls)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  stmt.run(
    message.id,
    message.session_id,
    message.role,
    message.content,
    message.model,
    message.created_at,
    message.tool_calls
  );
  
  // 更新会话的 updated_at
  const updateStmt = db.prepare('UPDATE sessions SET updated_at = ? WHERE id = ?');
  updateStmt.run(new Date().toISOString(), message.session_id);
  
  return message;
}

// 更新消息内容
export function updateMessage(id: string, updates: Partial<Pick<DbMessage, 'content' | 'tool_calls'>>): boolean {
  const fields: string[] = [];
  const values: any[] = [];
  
  if (updates.content !== undefined) {
    fields.push('content = ?');
    values.push(updates.content);
  }
  if (updates.tool_calls !== undefined) {
    fields.push('tool_calls = ?');
    values.push(updates.tool_calls);
  }
  
  if (fields.length === 0) return false;
  
  values.push(id);
  
  const stmt = db.prepare(`UPDATE messages SET ${fields.join(', ')} WHERE id = ?`);
  const result = stmt.run(...values);
  return result.changes > 0;
}

// 删除消息
export function deleteMessage(id: string): boolean {
  const stmt = db.prepare('DELETE FROM messages WHERE id = ?');
  const result = stmt.run(id);
  return result.changes > 0;
}

// 批量创建消息（用于保存对话）
export function createMessages(messages: DbMessage[]): void {
  const stmt = db.prepare(`
    INSERT INTO messages (id, session_id, role, content, model, created_at, tool_calls)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  
  const insertMany = db.transaction((msgs: DbMessage[]) => {
    for (const msg of msgs) {
      stmt.run(msg.id, msg.session_id, msg.role, msg.content, msg.model, msg.created_at, msg.tool_calls);
    }
  });
  
  insertMany(messages);
}

// 清空所有数据
export function clearAllData(): void {
  db.exec('DELETE FROM messages');
  db.exec('DELETE FROM sessions');
}

// 重置学习进度：清空记忆库与错题本（保留词库、会话、配置）
export function resetProgress(): void {
  db.exec('DELETE FROM word_memory');
  db.exec('DELETE FROM mistakes');
}

// ============= 词库（词根词源 + 场景） =============

export interface DbWord {
  id: string;
  word: string;
  phonetic: string | null;
  meaning: string;
  prefix: string | null;
  prefix_meaning: string | null;
  root: string | null;
  root_meaning: string | null;
  suffix: string | null;
  suffix_meaning: string | null;
  etymology: string | null;
  root_family: string | null;
  scene_tag: string | null;
  scene_example: string | null;
  scene_dialogue: string | null;
  book_id?: string | null;
  frequency?: number | null;
  example?: string | null;
}

// 按单词精确查询
export function getWord(word: string): DbWord | undefined {
  const stmt = db.prepare('SELECT * FROM words WHERE word = ?');
  return stmt.get(word.toLowerCase()) as DbWord | undefined;
}

// 按词根查询词族
export function getWordsByRoot(root: string): DbWord[] {
  const stmt = db.prepare("SELECT * FROM words WHERE root = ? OR root_family LIKE ?");
  return stmt.all(root.toLowerCase(), `%${root.toLowerCase()}%`) as DbWord[];
}

// 词库总数
export function getWordCount(): number {
  const stmt = db.prepare('SELECT COUNT(*) as c FROM words');
  return (stmt.get() as { c: number }).c;
}

// 获取全部词
export function getAllWords(): DbWord[] {
  const stmt = db.prepare('SELECT * FROM words ORDER BY word ASC');
  return stmt.all() as DbWord[];
}

// 模糊搜索（单词 / 词义 / 词根）
export function searchWords(q: string): DbWord[] {
  const kw = `%${q.toLowerCase()}%`;
  const stmt = db.prepare(
    'SELECT * FROM words WHERE word LIKE ? OR meaning LIKE ? OR root LIKE ? OR root_meaning LIKE ? ORDER BY word ASC'
  );
  return stmt.all(kw, kw, kw, kw) as DbWord[];
}

// 批量导入词库（种子数据）
export function upsertWords(words: DbWord[]): number {
  const stmt = db.prepare(`
    INSERT INTO words (id, word, phonetic, meaning, prefix, prefix_meaning, root, root_meaning, suffix, suffix_meaning, etymology, root_family, scene_tag, scene_example, scene_dialogue, book_id, frequency, example)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(word) DO UPDATE SET
      meaning = excluded.meaning,
      prefix = excluded.prefix,
      prefix_meaning = excluded.prefix_meaning,
      root = excluded.root,
      root_meaning = excluded.root_meaning,
      suffix = excluded.suffix,
      suffix_meaning = excluded.suffix_meaning,
      etymology = excluded.etymology,
      root_family = excluded.root_family,
      scene_tag = excluded.scene_tag,
      scene_example = excluded.scene_example,
      scene_dialogue = excluded.scene_dialogue,
      book_id = excluded.book_id,
      frequency = excluded.frequency,
      example = excluded.example
  `);
  const insertMany = db.transaction((items: DbWord[]) => {
    for (const w of items) {
      stmt.run(w.id, w.word.toLowerCase(), w.phonetic, w.meaning, w.prefix, w.prefix_meaning, w.root, w.root_meaning, w.suffix, w.suffix_meaning, w.etymology, w.root_family, w.scene_tag, w.scene_example, w.scene_dialogue, w.book_id, w.frequency, w.example);
    }
  });
  insertMany(words);
  return words.length;
}

// ============= 单词记忆状态（艾宾浩斯） =============

export interface DbWordMemory {
  id: string;
  word_id: string;
  user_id?: string | null;
  level: number;
  review_count: number;
  lapse_count: number;
  next_review_at: string | null;
  last_review_at: string | null;
  created_at: string;
}

export function getWordMemory(wordId: string, userId?: string): DbWordMemory | undefined {
  const uid = userId ?? DEFAULT_USER_ID;
  const stmt = db.prepare('SELECT * FROM word_memory WHERE word_id = ? AND (user_id = ? OR user_id IS NULL)');
  return stmt.get(wordId, uid) as DbWordMemory | undefined;
}

export function upsertWordMemory(mem: DbWordMemory): DbWordMemory {
  const userId = mem.user_id ?? DEFAULT_USER_ID;
  const stmt = db.prepare(`
    INSERT INTO word_memory (id, word_id, user_id, level, review_count, lapse_count, next_review_at, last_review_at, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      level = excluded.level,
      review_count = excluded.review_count,
      lapse_count = excluded.lapse_count,
      next_review_at = excluded.next_review_at,
      last_review_at = excluded.last_review_at
  `);
  stmt.run(mem.id, mem.word_id, userId, mem.level, mem.review_count, mem.lapse_count, mem.next_review_at, mem.last_review_at, mem.created_at);
  return mem;
}

// 待复习单词（next_review_at <= now）
export function getDueWords(now: string, userId?: string): Array<DbWordMemory & { word: string; meaning: string }> {
  const uid = userId ?? DEFAULT_USER_ID;
  const stmt = db.prepare(`
    SELECT wm.*, w.word, w.meaning FROM word_memory wm
    JOIN words w ON w.id = wm.word_id
    WHERE wm.next_review_at IS NOT NULL AND wm.next_review_at <= ?
      AND (wm.user_id = ? OR wm.user_id IS NULL)
    ORDER BY wm.next_review_at ASC
  `);
  return stmt.all(now, uid) as Array<DbWordMemory & { word: string; meaning: string }>;
}

// 所有记忆中的单词（含词库信息）
export function getAllWordMemory(userId?: string): Array<DbWordMemory & { word: string; meaning: string }> {
  const uid = userId ?? DEFAULT_USER_ID;
  const stmt = db.prepare(`
    SELECT wm.*, w.word, w.meaning FROM word_memory wm
    JOIN words w ON w.id = wm.word_id
    WHERE (wm.user_id = ? OR wm.user_id IS NULL)
    ORDER BY wm.next_review_at ASC
  `);
  return stmt.all(uid) as Array<DbWordMemory & { word: string; meaning: string }>;
}

// ============= 错题本 =============

export interface DbMistake {
  id: string;
  question: string;
  answer: string | null;
  user_answer: string | null;
  knowledge_point: string | null;
  wrong_count: number;
  next_review_at: string | null;
  created_at: string;
  user_id?: string | null;
}

export function addMistake(m: DbMistake): DbMistake {
  const userId = m.user_id ?? DEFAULT_USER_ID;
  const stmt = db.prepare(`
    INSERT INTO mistakes (id, question, answer, user_answer, knowledge_point, wrong_count, next_review_at, created_at, user_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  stmt.run(m.id, m.question, m.answer, m.user_answer, m.knowledge_point, m.wrong_count, m.next_review_at, m.created_at, userId);
  return m;
}

export function getMistakes(userId?: string): DbMistake[] {
  const uid = userId ?? DEFAULT_USER_ID;
  const stmt = db.prepare('SELECT * FROM mistakes WHERE (user_id = ? OR user_id IS NULL) ORDER BY created_at DESC');
  return stmt.all(uid) as DbMistake[];
}

export function getDueMistakes(now: string, userId?: string): DbMistake[] {
  const uid = userId ?? DEFAULT_USER_ID;
  const stmt = db.prepare('SELECT * FROM mistakes WHERE next_review_at IS NOT NULL AND next_review_at <= ? AND (user_id = ? OR user_id IS NULL) ORDER BY next_review_at ASC');
  return stmt.all(now, uid) as DbMistake[];
}

export function updateMistakeReview(id: string, updates: Partial<Pick<DbMistake, 'wrong_count' | 'next_review_at' | 'user_answer'>>): boolean {
  const fields: string[] = [];
  const values: any[] = [];
  if (updates.wrong_count !== undefined) { fields.push('wrong_count = ?'); values.push(updates.wrong_count); }
  if (updates.next_review_at !== undefined) { fields.push('next_review_at = ?'); values.push(updates.next_review_at); }
  if (updates.user_answer !== undefined) { fields.push('user_answer = ?'); values.push(updates.user_answer); }
  if (fields.length === 0) return false;
  values.push(id);
  const stmt = db.prepare(`UPDATE mistakes SET ${fields.join(', ')} WHERE id = ?`);
  const result = stmt.run(...values);
  return result.changes > 0;
}

// ============= API 配置（用户 API Key） =============

export function getApiConfig(key: string): string | undefined {
  const stmt = db.prepare('SELECT value FROM api_config WHERE key = ?');
  const row = stmt.get(key) as { value: string } | undefined;
  return row?.value;
}

export function setApiConfig(key: string, value: string): void {
  const stmt = db.prepare('INSERT INTO api_config (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value');
  stmt.run(key, value);
}

export function deleteApiConfig(key: string): boolean {
  const stmt = db.prepare('DELETE FROM api_config WHERE key = ?');
  return stmt.run(key).changes > 0;
}

export function getAllApiConfig(): Record<string, string> {
  const stmt = db.prepare('SELECT key, value FROM api_config');
  const rows = stmt.all() as Array<{ key: string; value: string }>;
  const out: Record<string, string> = {};
  for (const r of rows) out[r.key] = r.value;
  return out;
}

// ============= 用户（账号体系，Phase 0） =============

export interface DbUser {
  id: string;
  nickname: string | null;
  avatar: string | null;
  openid: string | null;
  provider: string | null;
  created_at: string;
  updated_at: string;
}

export function getUserById(id: string): DbUser | undefined {
  const stmt = db.prepare('SELECT * FROM users WHERE id = ?');
  return stmt.get(id) as DbUser | undefined;
}

export function getUserByOpenId(openid: string, provider: string): DbUser | undefined {
  const stmt = db.prepare('SELECT * FROM users WHERE openid = ? AND provider = ?');
  return stmt.get(openid, provider) as DbUser | undefined;
}

export function upsertUser(user: DbUser): DbUser {
  const stmt = db.prepare(`
    INSERT INTO users (id, nickname, avatar, openid, provider, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      nickname = excluded.nickname,
      avatar = excluded.avatar,
      openid = excluded.openid,
      provider = excluded.provider,
      updated_at = excluded.updated_at
  `);
  stmt.run(user.id, user.nickname, user.avatar, user.openid, user.provider, user.created_at, user.updated_at);
  return user;
}

// 本地单用户默认账号 ID（登录体系上线前，所有数据归属此账号；Phase 2 起由 openid 解析真实用户）
export const DEFAULT_USER_ID = 'local-default';

export function getDefaultUserId(): string {
  return DEFAULT_USER_ID;
}

// 确保默认账号存在（服务启动时调用），返回其 ID
export function ensureDefaultUser(): string {
  const now = new Date().toISOString();
  upsertUser({
    id: DEFAULT_USER_ID,
    nickname: '本地用户',
    avatar: null,
    openid: null,
    provider: 'local',
    created_at: now,
    updated_at: now,
  });
  return DEFAULT_USER_ID;
}

// ============= 词库分库（Phase 3 分场景词库） =============

export interface DbBook {
  id: string;
  name: string;
  category: string | null;
  description: string | null;
  created_at: string;
}

export function listBooks(): DbBook[] {
  const stmt = db.prepare('SELECT * FROM books ORDER BY created_at ASC');
  return stmt.all() as DbBook[];
}

export function getBookByName(name: string): DbBook | undefined {
  const stmt = db.prepare('SELECT * FROM books WHERE name = ?');
  return stmt.get(name) as DbBook | undefined;
}

export function upsertBook(book: DbBook): DbBook {
  const stmt = db.prepare(`
    INSERT INTO books (id, name, category, description, created_at)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(name) DO UPDATE SET
      category = excluded.category,
      description = excluded.description
  `);
  stmt.run(book.id, book.name, book.category, book.description, book.created_at);
  return book;
}
