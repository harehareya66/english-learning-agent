# -*- coding: utf-8 -*-
"""回填 words 表 example 字段（读 examples_data.py 的 EXAMPLES）"""
import json, os, sqlite3
from examples_data import EXAMPLES

BASE = os.path.join(os.path.dirname(__file__), '..', 'wordbook')

def main():
    with open(os.path.join(BASE, 'selected.json'), encoding='utf-8') as f:
        words = json.load(f)
    missing = [w['word'] for w in words if w['word'] not in EXAMPLES]
    print(f'例句覆盖: {len(EXAMPLES)} / {len(words)} ({len(EXAMPLES)*100//len(words)}%)')
    if missing:
        print(f'缺失 {len(missing)} 词: {missing[:30]}')
        return

    # 回填数据库
    db_path = os.path.join(os.path.dirname(__file__), '..', '..', 'data', 'chat.db')
    db = sqlite3.connect(db_path)
    cur = db.cursor()
    # 确保 example 列存在
    cols = [r[1] for r in cur.execute('PRAGMA table_info(words)')]
    if 'example' not in cols:
        cur.execute('ALTER TABLE words ADD COLUMN example TEXT')
    count = 0
    for word, example in EXAMPLES.items():
        r = cur.execute('UPDATE words SET example = ? WHERE word = ?', (example, word))
        count += r.rowcount
    db.commit()
    db.close()
    print(f'回填 example: {count} 词')

if __name__ == '__main__':
    main()
