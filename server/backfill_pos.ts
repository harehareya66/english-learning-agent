// 回填 words 表 pos 字段（读 data/wordbook/pos_map.json）
import { readFileSync } from 'fs';
import Database from 'better-sqlite3';

const raw = new Database('data/chat.db');

// 确保 pos 列存在
const cols = raw.prepare('PRAGMA table_info(words)').all() as Array<{ name: string }>;
if (!cols.some(c => c.name === 'pos')) {
  raw.exec('ALTER TABLE words ADD COLUMN pos TEXT');
  console.log('[DB] Added pos column');
}

const posMap = JSON.parse(readFileSync('data/wordbook/pos_map.json', 'utf-8')) as Record<string, string>;

const upd = raw.prepare('UPDATE words SET pos = ? WHERE word = ?');
let count = 0;
const tx = raw.transaction(() => {
  for (const [word, pos] of Object.entries(posMap)) {
    const r = upd.run(pos, word);
    count += r.changes;
  }
});
tx();

const total = (raw.prepare('SELECT COUNT(*) c FROM words').get() as any).c;
const withPos = (raw.prepare('SELECT COUNT(*) c FROM words WHERE pos IS NOT NULL').get() as any).c;
console.log(`回填 pos: ${count} 词 | 总数 ${total} | 有词性 ${withPos} (${Math.round(withPos/total*100)}%)`);
