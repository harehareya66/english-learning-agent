# -*- coding: utf-8 -*-
"""
Phase 3 词根标注 pipeline —— 第二步：用词根知识库对 1000 词自动拆解
输入：data/wordbook/selected.json
输出：
  - data/wordbook/annotated.json   (完整标注)
  - data/wordbook/unmatched.txt    (未匹配词，供人工审查)
"""
import json, os
from roots_data import (PREFIXES, ROOTS, SUFFIXES,
                        PREFIXES_SUPPLEMENT, ROOTS_SUPPLEMENT)

BASE = os.path.join(os.path.dirname(__file__), '..', 'wordbook')

ALL_PREFIXES = PREFIXES + PREFIXES_SUPPLEMENT
ALL_ROOTS = ROOTS + ROOTS_SUPPLEMENT

# 人工排除清单：这些词自动匹配结果错误（短词根/前缀误拆），强制不标词根
EXCLUDE = {
    'time', 'come', 'research', 'parent', 'age', 'every', 'future', 'role',
    'interest', 'remain', 'story', 'main', 'potential', 'income', 'agree',
    'experiment', 'sit', 'search', 'fit', 'image', 'cover', 'seem', 'average',
    'decade', 'discover', 'cost', 'section', 'old', 'way', 'grade', 'minute',
    'point', 'right', 'college', 'letter',
}

# 后缀按长度降序排序（最长优先，避免 ation 被 ion 抢先）
ALL_SUFFIXES = sorted(SUFFIXES, key=lambda s: len(s["s"]), reverse=True)

def build_root_index():
    exact = {}
    for r in ALL_ROOTS:
        for v in r["variants"]:
            exact[v] = r
    return exact

ROOT_EXACT = build_root_index()

def match_root(candidate):
    """匹配词干，返回 root_entry 或 None。含去尾 e / 去连接元音处理。"""
    if not candidate or len(candidate) < 2:
        return None
    if candidate in ROOT_EXACT:
        return ROOT_EXACT[candidate]
    # 去末尾 e
    if candidate.endswith('e'):
        c2 = candidate[:-1]
        if c2 in ROOT_EXACT:
            return ROOT_EXACT[c2]
    # 去连接元音 i/o/u（如 senti→sent、solit→sol、navig→nav、tuiti→tuit）
    if candidate[-1] in 'iou' and len(candidate) >= 3:
        c3 = candidate[:-1]
        if c3 in ROOT_EXACT:
            return ROOT_EXACT[c3]
    return None

def match_with_suffix(stem):
    """剥后缀并匹配词根。支持剥一个或两个后缀（如 casualty=cas+ual+ty）。返回 (root, suffix, root_candidate) 或 None"""
    # 两个后缀
    for s1 in ALL_SUFFIXES:
        if not stem.endswith(s1["s"]) or len(stem) - len(s1["s"]) < 2:
            continue
        mid = stem[:-len(s1["s"])]
        for s2 in ALL_SUFFIXES:
            if not mid.endswith(s2["s"]) or len(mid) - len(s2["s"]) < 2:
                continue
            candidate = mid[:-len(s2["s"])]
            r = match_root(candidate)
            if r:
                combined = {"s": f"{s2['s']}+{s1['s']}", "m": f"{s2['m']}+{s1['m']}"}
                return (r, combined, candidate)
    # 一个后缀
    for s in ALL_SUFFIXES:
        if stem.endswith(s["s"]) and len(stem) - len(s["s"]) >= 2:
            candidate = stem[:-len(s["s"])]
            r = match_root(candidate)
            if r:
                return (r, s, candidate)
    r = match_root(stem)
    if r:
        return (r, None, stem)
    return None

def annotate(word):
    """返回 (prefix|None, root|None, suffix|None, stem)"""
    w = word.lower()
    # 一层前缀
    for p in ALL_PREFIXES:
        for v in sorted(p["variants"], key=len, reverse=True):
            if not w.startswith(v) or len(w) - len(v) < 2:
                continue
            rest = w[len(v):]
            res = match_with_suffix(rest)
            if res:
                return (p, res[0], res[1], res[2])
    # 两层前缀（如 un-pre-cedented）
    for p1 in ALL_PREFIXES:
        for v1 in sorted(p1["variants"], key=len, reverse=True):
            if not w.startswith(v1) or len(w) - len(v1) < 2:
                continue
            rest1 = w[len(v1):]
            for p2 in ALL_PREFIXES:
                for v2 in sorted(p2["variants"], key=len, reverse=True):
                    if not rest1.startswith(v2) or len(rest1) - len(v2) < 2:
                        continue
                    rest2 = rest1[len(v2):]
                    res = match_with_suffix(rest2)
                    if res:
                        combo = {"p": f"{p1['p']}+{p2['p']}", "m": f"{p1['m']}+{p2['m']}", "variants": []}
                        return (combo, res[0], res[1], res[2])
    # 无前缀
    res = match_with_suffix(w)
    if res:
        return (None, res[0], res[1], res[2])
    return (None, None, None, None)

def build_etymology(p, r, s):
    parts = []
    if p:
        parts.append(f"{p['p']}({p['m']})")
    if r:
        parts.append(f"{r['r']}({r['m']})")
    if s:
        parts.append(f"{s['s']}({s['m']})")
    return " + ".join(parts)

def main():
    with open(os.path.join(BASE, 'selected.json'), encoding='utf-8') as f:
        words = json.load(f)

    annotated = []
    unmatched = []
    for w in words:
        p, r, s, stem = annotate(w['word'])
        if w['word'].lower() in EXCLUDE:
            p, r, s, stem = None, None, None, None
        item = {
            'word': w['word'],
            'phonetic': w['phonetic'],
            'meaning': w['meaning'],
            'book_id': w['book_id'],
            'frequency': w['frequency'],
            'prefix': p['p'] if p else None,
            'prefix_meaning': p['m'] if p else None,
            'root': r['r'] if r else None,
            'root_meaning': r['m'] if r else None,
            'suffix': s['s'] if s else None,
            'suffix_meaning': s['m'] if s else None,
            'etymology': build_etymology(p, r, s) if (p or r or s) else None,
        }
        annotated.append(item)
        if not r:
            unmatched.append(w['word'])

    with open(os.path.join(BASE, 'annotated.json'), 'w', encoding='utf-8') as f:
        json.dump(annotated, f, ensure_ascii=False, indent=2)

    with open(os.path.join(BASE, 'unmatched.txt'), 'w', encoding='utf-8') as f:
        f.write('\n'.join(unmatched))

    n_root = sum(1 for a in annotated if a['root'])
    n_full = sum(1 for a in annotated if a['root'] and (a['prefix'] or a['suffix']))
    cet4 = annotated[:600]
    cet6 = annotated[600:]
    n6 = sum(1 for a in cet6 if a['root'])
    print(f'标注完成：共 {len(annotated)} 词')
    print(f'  - 命中词根：{n_root} / {len(annotated)} ({n_root*100//len(annotated)}%)')
    print(f'  - 六级命中：{n6} / 400 ({n6*100//400}%)')
    print(f'  - 含前后缀完整拆解：{n_full}')
    print(f'  - 未匹配：{len(unmatched)}')

if __name__ == '__main__':
    main()
