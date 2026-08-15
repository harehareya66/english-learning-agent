import { useEffect, useState, useMemo } from 'react';
import { Input, Button, Tag, MessagePlugin, Loading, Radio } from 'tdesign-react';
import { SearchIcon, PlusIcon, SoundIcon } from 'tdesign-icons-react';
import { speak } from '../utils/speech';

interface DbWord {
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
  learned?: boolean;
  level?: number;
}

interface WordGroup {
  root: string;
  rootMeaning: string;
  words: DbWord[];
}

export function WordsPage() {
  const [groups, setGroups] = useState<WordGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState<DbWord[] | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [learning, setLearning] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'unlearned' | 'learned'>('all');
  const [book, setBook] = useState<string>('all');
  const [books, setBooks] = useState<Array<{ id: string; name: string; count: number }>>([]);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  // 按学习状态筛选（未学/已学），并隐藏空词族
  const filteredGroups = useMemo(() => {
    if (filter === 'all') return groups;
    return groups
      .map(g => ({
        ...g,
        words: g.words.filter(w => (filter === 'learned' ? w.learned : !w.learned)),
      }))
      .filter(g => g.words.length > 0);
  }, [groups, filter]);

  // 「其他」组（无词根词）过大，按首字母细分为 A-Z 子组
  const displayGroups = useMemo(() => {
    const result: WordGroup[] = [];
    for (const g of filteredGroups) {
      if (g.root === '其他' && g.words.length > 0) {
        const byLetter = new Map<string, DbWord[]>();
        for (const w of g.words) {
          const letter = (w.word[0] || '#').toUpperCase();
          if (!byLetter.has(letter)) byLetter.set(letter, []);
          byLetter.get(letter)!.push(w);
        }
        for (const letter of [...byLetter.keys()].sort()) {
          result.push({ root: letter, rootMeaning: '', words: byLetter.get(letter)! });
        }
      } else {
        result.push(g);
      }
    }
    return result;
  }, [filteredGroups]);

  const toggleGroup = (root: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(root)) next.delete(root);
      else next.add(root);
      return next;
    });
  };

  useEffect(() => {
    fetch('/api/books')
      .then(r => r.json())
      .then(d => setBooks(d.books || []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true);
    const url = book === 'all' ? '/api/words/list' : `/api/words/list?book=${book}`;
    fetch(url)
      .then(r => r.json())
      .then(d => setGroups(d.groups || []))
      .finally(() => setLoading(false));
  }, [book]);

  useEffect(() => {
    const q = query.trim();
    if (!q) {
      setSearchResults(null);
      return;
    }
    const t = setTimeout(() => {
      fetch(`/api/words/search?q=${encodeURIComponent(q)}`)
        .then(r => r.json())
        .then(d => setSearchResults(d.words || []));
    }, 300);
    return () => clearTimeout(t);
  }, [query]);

  const learn = async (w: DbWord) => {
    setLearning(w.id);
    try {
      const res = await fetch('/api/words/learn', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wordId: w.id }),
      });
      const data = await res.json();
      if (data.success) {
        MessagePlugin.success(`已加入学习计划：${w.word}`);
        const mark = (list: DbWord[]) => list.map(x => x.id === w.id ? { ...x, learned: true, level: 0 } : x);
        setGroups(prev => prev.map(g => ({ ...g, words: mark(g.words) })));
        setSearchResults(prev => prev ? mark(prev) : prev);
      } else {
        MessagePlugin.error(data.error || '操作失败');
      }
    } catch {
      MessagePlugin.error('网络错误');
    } finally {
      setLearning(null);
    }
  };

  const renderWord = (w: DbWord) => {
    const isOpen = expanded === w.id;
    const parts = [
      w.prefix ? `${w.prefix}(${w.prefix_meaning || ''})` : null,
      w.root ? `${w.root}(${w.root_meaning || ''})` : null,
      w.suffix ? `${w.suffix}(${w.suffix_meaning || ''})` : null,
    ].filter(Boolean).join(' + ');

    return (
      <div
        key={w.id}
        className="rounded-lg overflow-hidden"
        style={{ backgroundColor: 'var(--td-bg-color-container)' }}
      >
        <div
          className="flex items-center justify-between gap-3 px-4 py-3 cursor-pointer"
          onClick={() => setExpanded(isOpen ? null : w.id)}
        >
          <div className="min-w-0">
            <div className="flex items-center gap-1">
              <span className="font-medium" style={{ color: 'var(--td-text-color-primary)' }}>
                {w.word}
              </span>
              <Button shape="circle" variant="text" size="small" icon={<SoundIcon />} onClick={(e) => { e.stopPropagation(); speak(w.word); }} />
              {w.phonetic && (
                <span className="text-xs" style={{ color: 'var(--td-text-color-placeholder)' }}>
                  {w.phonetic}
                </span>
              )}
              {w.learned && (
                <Tag size="small" theme="success" variant="light">已学 L{w.level}</Tag>
              )}
            </div>
            <div className="text-sm truncate" style={{ color: 'var(--td-text-color-secondary)' }}>
              {w.meaning}
            </div>
          </div>
          <Button
            size="small"
            theme="primary"
            variant={w.learned ? 'base' : 'outline'}
            icon={<PlusIcon />}
            loading={learning === w.id}
            disabled={w.learned}
            onClick={(e) => { e.stopPropagation(); learn(w); }}
          >
            {w.learned ? '已加入' : '学习'}
          </Button>
        </div>

        {isOpen && (
          <div className="px-4 pb-4 space-y-2 border-t" style={{ borderColor: 'var(--td-component-border)' }}>
            {parts && (
              <div className="text-sm" style={{ color: 'var(--td-text-color-primary)' }}>
                🔬 词根拆解：{parts}
              </div>
            )}
            {w.etymology && (
              <div className="text-sm" style={{ color: 'var(--td-text-color-secondary)' }}>
                词源：{w.etymology}
              </div>
            )}
            {w.scene_tag && (
              <Tag size="small" variant="outline" theme="warning">{w.scene_tag}</Tag>
            )}
            {w.scene_example && (
              <div className="text-sm italic" style={{ color: 'var(--td-text-color-secondary)' }}>
                "{w.scene_example}"
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loading size="medium" text="加载单词库..." />
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="max-w-3xl mx-auto space-y-5">
        {/* 搜索框 */}
        <Input
          value={query}
          onChange={(v) => setQuery(v as string)}
          prefixIcon={<SearchIcon />}
          placeholder="搜索单词 / 词义 / 词根，如 transport、搬运、port"
          clearable
        />

        {searchResults !== null ? (
          <div className="space-y-2">
            <div className="text-sm" style={{ color: 'var(--td-text-color-secondary)' }}>
              搜索结果 {searchResults.length} 个
            </div>
            {searchResults.length === 0 ? (
              <div className="text-sm py-8 text-center" style={{ color: 'var(--td-text-color-placeholder)' }}>
                没有匹配的单词
              </div>
            ) : (
              searchResults.map(renderWord)
            )}
          </div>
        ) : (
          <div className="space-y-5">
            {/* 词库筛选 */}
            <Radio.Group value={book} onChange={(v) => setBook(v as string)} variant="default-filled" size="small">
              <Radio.Button value="all">全部词库</Radio.Button>
              {books.map(b => (
                <Radio.Button key={b.id} value={b.id}>{b.name}（{b.count}）</Radio.Button>
              ))}
            </Radio.Group>
            {/* 学习状态筛选 */}
            <div className="flex items-center justify-between">
              <Radio.Group value={filter} onChange={(v) => setFilter(v as any)} variant="default-filled" size="small">
                <Radio.Button value="all">全部</Radio.Button>
                <Radio.Button value="unlearned">未学</Radio.Button>
                <Radio.Button value="learned">已学</Radio.Button>
              </Radio.Group>
              <span className="text-xs" style={{ color: 'var(--td-text-color-secondary)' }}>
                {displayGroups.reduce((n, g) => n + g.words.length, 0)} 词
              </span>
            </div>
            {displayGroups.length === 0 ? (
              <div className="text-sm py-8 text-center" style={{ color: 'var(--td-text-color-placeholder)' }}>
                没有符合条件的单词
              </div>
            ) : (
              <>
                {(() => {
                  const rootGroups = displayGroups.filter(g => !/^[A-Z]$/.test(g.root));
                  const letterGroups = displayGroups.filter(g => /^[A-Z]$/.test(g.root));
                  const renderGroup = (g: WordGroup) => {
                    const isOpen = expandedGroups.has(g.root);
                    const isLetterGroup = /^[A-Z]$/.test(g.root);
                    return (
                      <div key={g.root}>
                        <div className="flex items-center gap-2 mb-2 cursor-pointer select-none" onClick={() => toggleGroup(g.root)}>
                          <span className="text-xs" style={{ color: 'var(--td-text-color-placeholder)' }}>
                            {isOpen ? '▾' : '▸'}
                          </span>
                          <span className="font-medium" style={{ color: 'var(--td-text-color-primary)' }}>
                            {isLetterGroup ? `字母 ${g.root}` : g.root}
                          </span>
                          <span className="text-xs" style={{ color: 'var(--td-text-color-secondary)' }}>
                            {isLetterGroup
                              ? `${g.words.length} 词`
                              : `${g.rootMeaning ? g.rootMeaning + ' · ' : ''}词族 ${g.words.length} 词`}
                          </span>
                        </div>
                        {isOpen && <div className="space-y-2">{g.words.map(renderWord)}</div>}
                      </div>
                    );
                  };
                  return (
                    <>
                      {rootGroups.length > 0 && (
                        <div>
                          <div className="text-xs font-medium mb-2 mt-1" style={{ color: 'var(--td-text-color-secondary)' }}>
                            词根词族 · 词根记忆法
                          </div>
                          {rootGroups.map(renderGroup)}
                        </div>
                      )}
                      {letterGroups.length > 0 && (
                        <div>
                          <div className="text-xs font-medium mb-2 mt-4" style={{ color: 'var(--td-text-color-secondary)' }}>
                            基础词 · 按字母
                          </div>
                          {letterGroups.map(renderGroup)}
                        </div>
                      )}
                    </>
                  );
                })()}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
