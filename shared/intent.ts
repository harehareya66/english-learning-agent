// 意图分类：纯函数，0 token、0 外部依赖
// 供 Web 后端 / 微信小程序后端共用（一套逻辑，多端复用）

export type Intent = 'lookup' | 'review' | 'oral' | 'mistake' | 'assessment' | 'chat';

// 学习模式 agentId → 意图
const AGENT_INTENT: Record<string, Intent> = {
  vocabulary: 'lookup',
  'oral-practice': 'oral',
  'error-review': 'mistake',
  assessment: 'assessment',
};

export interface ClassifyOptions {
  agentId?: string;
  // 自然语言查词需要判断命中词库；由调用方注入，避免本模块依赖数据层
  wordExists?: (word: string) => boolean;
}

export function classifyIntent(text: string, opts: ClassifyOptions = {}): Intent {
  const t = text.trim();

  // 学习模式明确时优先
  if (opts.agentId && AGENT_INTENT[opts.agentId]) {
    if (opts.agentId === 'vocabulary') {
      // 词汇模式下区分「查词」和「复习」
      if (/复习|review|今日|计划/i.test(t)) return 'review';
      return 'lookup';
    }
    return AGENT_INTENT[opts.agentId];
  }

  // 默认模式：关键词分类
  if (/复习|review|今日词|记忆曲线/i.test(t)) return 'review';
  if (/口语|对话|场景|role.?play|陪练|说英语/i.test(t)) return 'oral';
  if (/错题|mistake|易错|重测/i.test(t)) return 'mistake';
  if (/测评|测试|能力|test|assessment/i.test(t)) return 'assessment';
  if (/^[a-zA-Z]+$/.test(t)) return 'lookup'; // 纯英文单词 → 查词
  // 自然语言查词：消息中含英文单词且命中本地词库 → 查词
  const englishWord = t.match(/[a-zA-Z]{3,}/);
  if (englishWord && opts.wordExists && opts.wordExists(englishWord[0])) return 'lookup';
  return 'chat';
}
