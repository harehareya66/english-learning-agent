# -*- coding: utf-8 -*-
"""生成 word -> pos 映射：规则推导(派生词) + 基础词表(POS_BASE)"""
import json, re, os
from pos_data import POS_BASE

BASE = os.path.join(os.path.dirname(__file__), '..', 'wordbook')

RULES = [
    (r'(tion|sion|ment|ness|ity|ance|ence|age|ure|tude|logy|graphy|ism|ship|hood|cy|ery|mony|acle)$', 'n'),
    (r'(ate|ize|ise|ify|en)$', 'v'),
    (r'(ous|ious|ive|able|ible|ful|less|ary|ory|ic|ical|al|ent|ant|ish)$', 'adj'),
    (r'(ly)$', 'adv'),
    (r'(er|or|ist|ian|ee|ar)$', 'n'),
]

def main():
    with open(os.path.join(BASE, 'selected.json'), encoding='utf-8') as f:
        words = json.load(f)
    pos_map = {}
    missing = []
    for w in words:
        word = w['word']
        if word in POS_BASE:
            pos_map[word] = POS_BASE[word]
            continue
        derived = None
        for pat, pos in RULES:
            if re.search(pat, word):
                derived = pos
                break
        if derived:
            pos_map[word] = derived
        else:
            missing.append(word)
    with open(os.path.join(BASE, 'pos_map.json'), 'w', encoding='utf-8') as f:
        json.dump(pos_map, f, ensure_ascii=False, indent=2)
    print(f'生成 pos_map: {len(pos_map)} / {len(words)} 词')
    print(f'覆盖: {len(pos_map)*100//len(words)}%')
    if missing:
        print(f'缺失 {len(missing)} 词: {missing[:50]}')

if __name__ == '__main__':
    main()
