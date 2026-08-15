// 本地能力层：意图分类 + 词根词源查词 + 艾宾浩斯复习 + 场景口语 + 本地测评
// 全部确定性逻辑，0 token 消耗

import { v4 as uuidv4 } from 'uuid';
import {
  getWord,
  getWordById,
  getWordMemory,
  getDueWords,
  upsertWordMemory,
  addMistake,
  getMistakes,
  getDueMistakes,
  updateMistakeReview,
  getAllWords,
  getAllWordMemory,
} from './db.js';
import { scheduleReview, ReviewResult, initialMemory } from './memory.js';
import { classifyIntent as classifyIntentPure } from '../shared/intent.js';
import type { Intent } from '../shared/intent.js';
import { buildDynamicQuestions as buildDynamicQuestionsPure } from '../shared/assessment.js';
import type { AssessmentQuestion, WordRef } from '../shared/assessment.js';

// ============= 意图分类 =============

export type { Intent };

// 本地包装：注入词库查询能力（自然语言查词需判断是否命中词库）
export function classifyIntent(text: string, agentId?: string): Intent {
  return classifyIntentPure(text, { agentId, wordExists: (w) => !!getWord(w) });
}

// ============= 词根词源查词 =============

export interface WordLookupResult {
  found: boolean;
  word?: {
    id: string;
    word: string;
    phonetic: string | null;
    meaning: string;
    parts: Array<{ type: 'prefix' | 'root' | 'suffix'; text: string; meaning: string | null }>;
    etymology: string | null;
    family: string[];
    scene: { tag: string | null; example: string | null };
  };
  query?: string;
}

export function lookupWord(input: string): WordLookupResult {
  const w = getWord(input.trim());
  if (!w) return { found: false, query: input.trim() };

  const parts: NonNullable<WordLookupResult['word']>['parts'] = [];
  if (w.prefix) parts.push({ type: 'prefix', text: w.prefix, meaning: w.prefix_meaning });
  if (w.root) parts.push({ type: 'root', text: w.root, meaning: w.root_meaning });
  if (w.suffix) parts.push({ type: 'suffix', text: w.suffix, meaning: w.suffix_meaning });

  let family: string[] = [];
  try {
    if (w.root_family) family = JSON.parse(w.root_family);
  } catch {
    family = [];
  }

  return {
    found: true,
    word: {
      id: w.id,
      word: w.word,
      phonetic: w.phonetic,
      meaning: w.meaning,
      parts,
      etymology: w.etymology,
      family,
      scene: { tag: w.scene_tag, example: w.scene_example },
    },
  };
}

// 生成查词的文本展示（用于 SSE 返回）
export function formatWordCard(r: WordLookupResult): string {
  if (!r.found || !r.word) return `词库中暂时没有「${r.query}」，可在设置中配置 API Key 后让 AI 为你讲解该词。`;

  const w = r.word;
  const parts = w.parts
    .map(p => `${p.text}${p.meaning ? `（${p.meaning}）` : ''}`)
    .join(' + ');

  const lines: string[] = [];
  lines.push(`📖 **${w.word}** ${w.phonetic || ''}`);
  lines.push(`释义：${w.meaning}`);
  if (parts) lines.push(`\n🔬 词根拆解：${parts}`);
  if (w.etymology) lines.push(`词源：${w.etymology}`);
  if (w.family.length > 1) lines.push(`\n🌳 词族：${w.family.join(' · ')}`);
  if (w.scene.tag || w.scene.example) {
    lines.push(`\n🎬 场景（${w.scene.tag || '通用'}）：`);
    if (w.scene.example) lines.push(`　"${w.scene.example}"`);
  }
  lines.push(`\n💡 已为你加入记忆库，稍后会自动安排复习。`);
  return lines.join('\n');
}

// ============= 艾宾浩斯复习 =============

// 复习队列类型：单词 + 错题 合并
export type ReviewItemType =
  | {
      type: 'word';
      id: string;
      word: string;
      meaning: string;
      level: number;
      phonetic?: string | null;
      prefix?: string | null;
      prefix_meaning?: string | null;
      root?: string | null;
      root_meaning?: string | null;
      suffix?: string | null;
      suffix_meaning?: string | null;
      etymology?: string | null;
      example?: string | null;
    }
  | { type: 'mistake'; id: string; question: string; answer: string | null; point: string | null };

export function getTodayReview(): ReviewItemType[] {
  const now = new Date().toISOString();
  const words: ReviewItemType[] = getDueWords(now).map(w => ({
    type: 'word',
    id: w.word_id,
    word: w.word,
    meaning: w.meaning,
    level: w.level,
    phonetic: w.phonetic,
    prefix: w.prefix,
    prefix_meaning: w.prefix_meaning,
    root: w.root,
    root_meaning: w.root_meaning,
    suffix: w.suffix,
    suffix_meaning: w.suffix_meaning,
    etymology: w.etymology,
    example: w.example,
  }));
  const mistakes: ReviewItemType[] = getDueMistakes(now).map(m => ({
    type: 'mistake',
    id: m.id,
    question: m.question,
    answer: m.answer,
    point: m.knowledge_point,
  }));
  return [...words, ...mistakes];
}

export function recordReview(wordId: string, result: ReviewResult) {
  const mem = getWordMemory(wordId);
  const outcome = scheduleReview(mem?.review_count ?? 0, mem?.lapse_count ?? 0, result);
  const init = initialMemory();
  upsertWordMemory({
    id: mem?.id || uuidv4(),
    word_id: wordId,
    level: outcome.level,
    review_count: outcome.reviewCount,
    lapse_count: outcome.lapseCount,
    next_review_at: outcome.nextReviewAt.toISOString(),
    last_review_at: new Date().toISOString(),
    created_at: mem?.created_at || init.nextReviewAt.toISOString(),
  });

  // 忘记 → 记入错题本（去重：已存在则 wrong_count 递增）
  if (result === 'forget') {
    const w = getWordById(wordId);
    if (w) {
      const existing = getMistakes().find(m => m.question === w.word);
      if (existing) {
        updateMistakeReview(existing.id, { wrong_count: (existing.wrong_count ?? 0) + 1 });
      } else {
        addMistake({
          id: uuidv4(),
          question: w.word,
          answer: w.meaning,
          user_answer: null,
          knowledge_point: w.root ? `词根 ${w.root}` : '词汇',
          wrong_count: 1,
          next_review_at: null,
          created_at: new Date().toISOString(),
          user_id: null,
        });
      }
    }
  }
  return outcome;
}

// 错题复习自评：会了（remember）→ 间隔进阶；不会（forget）→ 保持/退档
export function recordMistakeReview(mistakeId: string, result: 'remember' | 'forget') {
  const mistake = getMistakes().find(m => m.id === mistakeId);
  if (!mistake) return null;
  const rc = Math.max(0, mistake.wrong_count);
  const nextDays = result === 'remember' ? 4 : 1;
  const newWrongCount = result === 'remember' ? Math.max(0, rc - 1) : rc + 1;
  updateMistakeReview(mistakeId, {
    wrong_count: newWrongCount,
    next_review_at: new Date(Date.now() + nextDays * 24 * 60 * 60 * 1000).toISOString(),
  });
  return { wrongCount: newWrongCount, nextDays };
}

// 将查词结果加入记忆库（首次学习）
export function addWordToMemory(wordId: string) {
  const existing = getWordMemory(wordId);
  if (existing) return existing;
  const init = initialMemory();
  return upsertWordMemory({
    id: uuidv4(),
    word_id: wordId,
    level: init.level,
    review_count: init.reviewCount,
    lapse_count: init.lapseCount,
    next_review_at: init.nextReviewAt.toISOString(),
    last_review_at: null,
    created_at: new Date().toISOString(),
  });
}

// ============= 场景口语模板 =============

export interface SceneTemplate {
  tag: string;
  title: string;
  intro: string;
  lines: Array<{ role: 'A' | 'B'; text: string; note?: string }>;
}

const SCENE_TEMPLATES: SceneTemplate[] = [
  {
    tag: '机场出行',
    title: 'At the Airport 机场值机',
    intro: '场景：办理登机手续（Check-in）',
    lines: [
      { role: 'A', text: 'Good morning! Where are you flying today?', note: '早上好，您今天飞哪里？' },
      { role: 'B', text: 'To Shanghai. Here is my passport.', note: '去上海，这是我的护照。' },
      { role: 'A', text: 'Would you like a window seat or an aisle seat?', note: '您要靠窗还是靠过道？' },
      { role: 'B', text: 'A window seat, please. And where is the boarding gate?', note: '靠窗，登机口在哪？' },
      { role: 'A', text: 'Gate B12. Boarding starts at 2:30 pm.', note: 'B12 登机口，下午 2:30 开始登机。' },
    ],
  },
  {
    tag: '餐厅点餐',
    title: 'Ordering Food 餐厅点餐',
    intro: '场景：在餐厅点餐',
    lines: [
      { role: 'A', text: 'Are you ready to order, sir?', note: '先生，可以点餐了吗？' },
      { role: 'B', text: 'Yes, I\'ll have the grilled salmon, please.', note: '好的，我要烤三文鱼。' },
      { role: 'A', text: 'Would you like anything to drink?', note: '需要喝点什么吗？' },
      { role: 'B', text: 'A glass of water, no ice. Thanks.', note: '一杯水，不加冰，谢谢。' },
    ],
  },
  {
    tag: '商务会议',
    title: 'Business Meeting 商务会议',
    intro: '场景：与客户开项目启动会',
    lines: [
      { role: 'A', text: 'Thanks for joining. Let\'s go over the project timeline.', note: '感谢参会，我们过一下项目时间线。' },
      { role: 'B', text: 'Sure. We plan to launch the product next quarter.', note: '好的，我们计划下季度发布产品。' },
      { role: 'A', text: 'Could you share the budget breakdown with us?', note: '能分享一下预算明细吗？' },
      { role: 'B', text: 'Of course. I\'ll send the document after the meeting.', note: '当然，会后我把文档发给你。' },
    ],
  },
];

export function getSceneTemplates(): Array<{ tag: string; title: string }> {
  return SCENE_TEMPLATES.map(s => ({ tag: s.tag, title: s.title }));
}

export function getSceneTemplate(tag?: string): SceneTemplate | undefined {
  if (!tag) return SCENE_TEMPLATES[0];
  return SCENE_TEMPLATES.find(s => s.tag === tag || s.title.includes(tag));
}

export function formatScene(scene: SceneTemplate): string {
  const lines: string[] = [];
  lines.push(`🎭 **${scene.title}**`);
  lines.push(scene.intro);
  lines.push('');
  for (const l of scene.lines) {
    lines.push(`${l.role === 'A' ? '🗣' : '👤'} ${l.text}${l.note ? `  （${l.note}）` : ''}`);
  }
  lines.push(`\n💬 你可以试着扮演其中一个角色，回复你的台词，我会帮你纠错。`);
  return lines.join('\n');
}

// ============= 错题本 =============

export function listMistakes() {
  return getMistakes();
}

export function recordMistake(question: string, userAnswer: string, answer: string, knowledgePoint?: string) {
  // 判重：同题已存在则累加错误次数
  const existing = getMistakes().find(m => m.question === question);
  if (existing) {
    updateMistakeReview(existing.id, {
      wrong_count: existing.wrong_count + 1,
      user_answer: userAnswer,
      next_review_at: new Date().toISOString(), // 立即重新进入待复习
    });
    return existing;
  }
  return addMistake({
    id: uuidv4(),
    question,
    answer,
    user_answer: userAnswer,
    knowledge_point: knowledgePoint ?? null,
    wrong_count: 1,
    next_review_at: new Date().toISOString(), // 立即进入待复习队列
    created_at: new Date().toISOString(),
  });
}

// ============= 本地测评 =============

export type { AssessmentQuestion } from '../shared/assessment.js';

const ASSESSMENT_QUESTIONS: AssessmentQuestion[] = [
  {
    id: 1,
    question: 'The company ___ coffee beans from Brazil.',
    options: ['imports', 'exports', 'transports', 'inspects'],
    answer: 0,
    point: '词根 port（搬运）',
  },
  {
    id: 2,
    question: '"inspect" 中 spect 的意思是？',
    options: ['搬运', '看', '说', '听'],
    answer: 1,
    point: '词根 spect（看）',
  },
  {
    id: 3,
    question: 'predict = pre(提前) + dict(?)',
    options: ['看', '写', '说', '拉'],
    answer: 2,
    point: '词根 dict（说）',
  },
  {
    id: 4,
    question: '"portable" 的后缀 -able 表示？',
    options: ['人', '能…的', '反向', '名词'],
    answer: 1,
    point: '后缀 -able（能…的）',
  },
];

export function getAssessmentQuestions(): { sessionId: string; questions: AssessmentQuestionDTO[] } {
  cleanupStore();
  const sessionId = uuidv4();
  const answerMap = new Map<number, StoredQuestion>();
  const questions: AssessmentQuestionDTO[] = [];

  // 固定题
  for (const q of ASSESSMENT_QUESTIONS) {
    answerMap.set(q.id, { answer: q.answer, question: q.question, point: q.point, options: q.options });
    questions.push({ id: q.id, question: q.question, options: q.options, point: q.point });
  }

  // 动态题（选项随机，答案存内存 Map，不下发）
  for (const q of buildDynamicQuestions()) {
    answerMap.set(q.id, { answer: q.answer, question: q.question, point: q.point, options: q.options });
    questions.push({ id: q.id, question: q.question, options: q.options, point: q.point });
  }

  assessmentStore.set(sessionId, answerMap);
  return { sessionId, questions };
}

// 出题返回的题目（不含答案）
export interface AssessmentQuestionDTO {
  id: number;
  question: string;
  options: string[];
  point: string;
}

interface StoredQuestion {
  answer: number;
  question: string;
  point: string;
  options: string[];
}

// 内存存储：sessionId → 题目ID → {答案, 题干, 知识点}（方案B：答案不下发）
const assessmentStore = new Map<string, Map<number, StoredQuestion>>();

function cleanupStore(): void {
  if (assessmentStore.size > 50) assessmentStore.clear();
}

// 本地包装：把已学单词解析为 WordRef，调用共享纯函数出题
function buildDynamicQuestions(): AssessmentQuestion[] {
  const memory = getAllWordMemory();
  if (memory.length === 0) return [];

  const memoryWords: WordRef[] = [];
  for (const m of memory.slice(0, 6)) {
    const w = getWord(m.word);
    if (w) memoryWords.push({ id: w.id, word: w.word, meaning: w.meaning, root: w.root });
  }

  const allWords: WordRef[] = getAllWords().map(w => ({
    id: w.id, word: w.word, meaning: w.meaning, root: w.root,
  }));

  return buildDynamicQuestionsPure(memoryWords, allWords);
}

export function gradeAssessment(sessionId: string, answers: Array<{ id: number; answer: number }>) {
  const answerMap = assessmentStore.get(sessionId);
  if (!answerMap) {
    return { error: '测评会话不存在或已过期，请重新开始' };
  }
  const total = answerMap.size;
  let correct = 0;
  let wrongCount = 0;
  const details: Array<{ id: number; correct: boolean; point: string; correctAnswer: string }> = [];

  for (const a of answers) {
    const stored = answerMap.get(a.id);
    if (!stored) continue;
    const ok = stored.answer === a.answer;
    const correctAnswer = stored.options[stored.answer];
    if (ok) {
      correct += 1;
    } else {
      wrongCount += 1;
      const userLetter = String.fromCharCode(65 + (a.answer ?? -1));
      const rightLetter = String.fromCharCode(65 + stored.answer);
      recordMistake(stored.question, userLetter === '@' ? '' : userLetter, rightLetter, stored.point);
    }
    details.push({ id: a.id, correct: ok, point: stored.point, correctAnswer });
  }

  return {
    correct,
    total,
    wrongCount,
    score: Math.round((correct / total) * 100),
    details,
  };
}
