# -*- coding: utf-8 -*-
"""
Phase 3 词库扩充 pipeline —— 第一步：从四六级词频表筛选首批 ~1000 词
数据源：
  - data/raw/cet_full_list.json  (exam-data/CETVocabulary, CC BY-NC-SA 4.0)
  - data/raw/cmudict.dict        (cmusphinx/cmudict, BSD)
输出：
  - data/wordbook/selected.json  (word/phonetic/meaning/frequency/book_id)
"""
import json, os, re, sys

RAW = os.path.join(os.path.dirname(__file__), '..', 'raw')
OUT = os.path.join(os.path.dirname(__file__), '..', 'wordbook')
os.makedirs(OUT, exist_ok=True)

# ---------- 英文功能词黑名单（封闭词类，无词根拆解价值） ----------
FUNCTION_WORDS = set('''
the a an
i you he she it we they me him her us them my your his its our their
mine yours hers ours theirs myself yourself himself herself itself ourselves yourselves themselves
this that these those who whom whose which what whoever whatever whichever
one ones someone somebody something anyone anybody anything everyone everybody everything nobody nothing
each other another both all any some none either neither several few many much more most little less least
in on at to for of with by from into onto about after before over under between among through during
without against within upon across along around behind below beside beyond despite except inside near
outside since toward towards until till up down off past per plus minus
and or but if because so than when while where whether although though unless until since as nor yet
whereas whenever wherever however therefore moreover furthermore nevertheless otherwise hence thus then
be am is are was were been being do does did done doing have has had having
can could may might must shall should will would ought need dare used let
not no yes there here now very too also just only even still already yet again ever never always
often usually sometimes seldom rarely almost nearly quite rather such
one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen
seventeen eighteen nineteen twenty thirty forty fifty hundred thousand million
first second third fourth fifth
'''.split())

# 过滤掉仅含标点/数字的"词"
def is_noise(w):
    return not re.search(r'[a-zA-Z]', w)

# ---------- ARPABET -> IPA（美式）映射 ----------
ARPABET = {
    'AA': 'ɑː', 'AE': 'æ', 'AH': 'ʌ', 'AO': 'ɔː', 'AW': 'aʊ', 'AY': 'aɪ',
    'EH': 'e', 'ER': 'ɜːr', 'EY': 'eɪ', 'IH': 'ɪ', 'IY': 'iː', 'OW': 'oʊ',
    'OY': 'ɔɪ', 'UH': 'ʊ', 'UW': 'uː',
    'B': 'b', 'CH': 'tʃ', 'D': 'd', 'DH': 'ð', 'F': 'f', 'G': 'ɡ', 'HH': 'h',
    'JH': 'dʒ', 'K': 'k', 'L': 'l', 'M': 'm', 'N': 'n', 'NG': 'ŋ', 'P': 'p',
    'R': 'r', 'S': 's', 'SH': 'ʃ', 'T': 't', 'TH': 'θ', 'V': 'v', 'W': 'w',
    'Y': 'j', 'Z': 'z', 'ZH': 'ʒ',
}

def arpabet_to_ipa(arpabet: str) -> str:
    """ARPABET 音素串 -> IPA，重音 0/1/2 分别映射为 无/ˈ/ˌ"""
    phones = arpabet.split()
    out = []
    for p in phones:
        if p == '1':
            out.append('ˈ')
        elif p == '2':
            out.append('ˌ')
        elif p == '0':
            continue
        else:
            # 去掉尾随数字（部分 ARPABET 把重音标在元音上，如 AH0）
            base = re.sub(r'\d$', '', p)
            out.append(ARPABET.get(base, base.lower()))
    ipa = ''.join(out)
    return '/' + ipa + '/'

def load_cmudict(path):
    d = {}
    if not os.path.exists(path):
        return d
    with open(path, encoding='utf-8', errors='ignore') as f:
        for line in f:
            if line.startswith(';;;') or not line.strip():
                continue
            parts = line.split()
            if len(parts) < 2:
                continue
            word = parts[0].split('(')[0].lower()
            if word not in d:  # 取第一读音
                d[word] = ' '.join(parts[1:])
    return d

def main():
    with open(os.path.join(RAW, 'cet_full_list.json'), encoding='utf-8') as f:
        data = json.load(f)
    words = data['四六级词汇词频排序表']

    cmu = load_cmudict(os.path.join(RAW, 'cmudict.dict'))

    # 分级配额：四级 top N4 + 六级 top N6（各自按词频降序，跳过功能词）
    QUOTA = {'cet4': 600, 'cet6': 400}

    def build_one(book_id):
        out = []
        for w in words:
            is_cet6 = bool(w.get('六级'))
            if (book_id == 'cet6') != is_cet6:
                continue
            word = (w.get('单词') or '').strip().lower()
            if not word or is_noise(word) or word in FUNCTION_WORDS:
                continue
            meaning = (w.get('释义') or '').strip()
            if not meaning:
                continue
            phonetic = None
            if word in cmu:
                phonetic = arpabet_to_ipa(cmu[word])
            out.append({
                'word': word,
                'phonetic': phonetic,
                'meaning': meaning,
                'frequency': int(w.get('词频') or 0),
                'rank': int(w.get('序号') or 0),
                'book_id': book_id,
                'category': w.get('分类'),
                'subcategory': w.get('子分类'),
            })
            if len(out) >= QUOTA[book_id]:
                break
        return out

    selected = build_one('cet4') + build_one('cet6')

    # 统计
    n_ph = sum(1 for s in selected if s['phonetic'])
    n_cet6 = sum(1 for s in selected if s['book_id'] == 'cet6')
    with open(os.path.join(OUT, 'selected.json'), 'w', encoding='utf-8') as f:
        json.dump(selected, f, ensure_ascii=False, indent=2)

    print(f'筛选完成：共 {len(selected)} 词')
    print(f'  - 有音标：{n_ph} / {len(selected)} ({n_ph*100//len(selected)}%)')
    print(f'  - 四级：{len(selected)-n_cet6}，六级：{n_cet6}')
    print(f'  - 词频范围：{selected[-1]["frequency"]} ~ {selected[0]["frequency"]}')
    print(f'  - 输出：data/wordbook/selected.json')

if __name__ == '__main__':
    main()
