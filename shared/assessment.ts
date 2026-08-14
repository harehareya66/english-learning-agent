// 测评动态出题：纯函数，0 token、0 外部依赖
// 输入已学单词与全量词库，输出题目（答案随题目返回，由上层决定是否下发）

export interface AssessmentQuestion {
  id: number;
  question: string;
  options: string[];
  answer: number;
  point: string;
}

// 出题所需的最小词字段（解耦数据库结构）
export interface WordRef {
  id: string;
  word: string;
  meaning: string;
  root: string | null;
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// 基于已学单词动态出题（多题型：词根 / 词义 / 词族，选项随机）
export function buildDynamicQuestions(
  memoryWords: WordRef[],
  allWords: WordRef[]
): AssessmentQuestion[] {
  if (memoryWords.length === 0) return [];

  const allRoots = [...new Set(allWords.map(w => w.root).filter((r): r is string => r !== null))].sort();
  const questions: AssessmentQuestion[] = [];
  let id = 100;

  for (const w of memoryWords.slice(0, 6)) {
    const type = ['root', 'meaning', 'family'][Math.floor(Math.random() * 3)];

    if (type === 'root' && w.root) {
      const correct = w.root;
      const distractors = shuffle(allRoots.filter(r => r !== correct)).slice(0, 3);
      const options = shuffle([correct, ...distractors]);
      questions.push({
        id: ++id,
        question: `${w.word}（${w.meaning}）的词根是？`,
        options,
        answer: options.indexOf(correct),
        point: `词根 ${w.root}`,
      });
    } else if (type === 'meaning') {
      const correct = w.meaning;
      const distractors = shuffle(allWords.filter(x => x.id !== w.id).map(x => x.meaning)).slice(0, 3);
      const options = shuffle([correct, ...distractors]);
      questions.push({
        id: ++id,
        question: `${w.word} 的意思是？`,
        options,
        answer: options.indexOf(correct),
        point: `词义 ${w.word}`,
      });
    } else if (w.root) {
      const familyMembers = allWords.filter(x => x.root === w.root && x.id !== w.id);
      if (familyMembers.length === 0) continue;
      const correct = familyMembers[0].word;
      const distractors = shuffle(allWords.filter(x => x.root !== w.root).map(x => x.word)).slice(0, 3);
      const options = shuffle([correct, ...distractors]);
      questions.push({
        id: ++id,
        question: `下列哪个词与 ${w.word} 同词根（${w.root}）？`,
        options,
        answer: options.indexOf(correct),
        point: `词族 ${w.root}`,
      });
    }
  }
  return questions;
}
