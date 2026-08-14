// Phase 3 词库导入脚本：读取 data/wordbook/annotated.json 导入 words 表
// 用法：node node_modules/tsx/dist/cli.mjs server/import-wordbook.ts
import { readFileSync } from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { upsertWords, getAllWords, getWordCount, DbWord } from './db.js';

interface AnnotatedWord {
  word: string;
  phonetic: string | null;
  meaning: string;
  book_id: string;
  frequency: number;
  prefix: string | null;
  prefix_meaning: string | null;
  root: string | null;
  root_meaning: string | null;
  suffix: string | null;
  suffix_meaning: string | null;
  etymology: string | null;
}

function main() {
  const raw = readFileSync('data/wordbook/annotated.json', 'utf-8');
  const items: AnnotatedWord[] = JSON.parse(raw);

  // 现有词的场景标注（导入时保留，避免被 null 覆盖）
  const existingScene = new Map<string, { tag: string | null; example: string | null }>();
  for (const w of getAllWords()) {
    existingScene.set(w.word, { tag: w.scene_tag, example: w.scene_example });
  }

  // 按词根分组，生成 root_family
  const familyMap = new Map<string, string[]>();
  for (const it of items) {
    if (!it.root) continue;
    if (!familyMap.has(it.root)) familyMap.set(it.root, []);
    familyMap.get(it.root)!.push(it.word);
  }

  const before = getWordCount();
  const words: DbWord[] = items.map((it) => {
    const scene = existingScene.get(it.word);
    return {
      id: uuidv4(),
      word: it.word,
      phonetic: it.phonetic,
      meaning: it.meaning,
      prefix: it.prefix,
      prefix_meaning: it.prefix_meaning,
      root: it.root,
      root_meaning: it.root_meaning,
      suffix: it.suffix,
      suffix_meaning: it.suffix_meaning,
      etymology: it.etymology,
      root_family: it.root && familyMap.has(it.root)
        ? JSON.stringify(familyMap.get(it.root)!)
        : null,
      scene_tag: scene?.tag ?? null,
      scene_example: scene?.example ?? null,
      scene_dialogue: null,
      book_id: it.book_id,
      frequency: it.frequency,
      example: null,
    };
  });

  const count = upsertWords(words);
  const after = getWordCount();
  const withRoot = items.filter(i => i.root).length;
  console.log(`[Import] 导入 ${count} 词（新增前 ${before} → 后 ${after}）`);
  console.log(`[Import] 含词根标注：${withRoot} / ${items.length}`);
  console.log(`[Import] 词族数：${familyMap.size}`);
}

main();
