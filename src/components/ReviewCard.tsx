import { useState } from 'react';
import { Button, MessagePlugin, Tag } from 'tdesign-react';
import { CheckCircleFilledIcon, SoundIcon } from 'tdesign-icons-react';
import { ReviewItem } from '../types';
import { speak } from '../utils/speech';

interface ReviewCardProps {
  items: ReviewItem[];
}

type WordItem = Extract<ReviewItem, { type: 'word' }>;
type MistakeItem = Extract<ReviewItem, { type: 'mistake' }>;

const keyOf = (item: ReviewItem) => `${item.type}-${item.id}`;

// 复习卡片：中英分离 + 艾宾浩斯自评 + 「忘记→重学→稍后重测→巩固轮」闭环
export function ReviewCard({ items }: ReviewCardProps) {
  const [list, setList] = useState<ReviewItem[]>(items);
  const [retestList, setRetestList] = useState<ReviewItem[]>([]);
  const [relearning, setRelearning] = useState<Set<string>>(new Set());
  const [inRetest, setInRetest] = useState(false);
  const [recording, setRecording] = useState<string | null>(null);
  const [revealed, setRevealed] = useState<Set<string>>(new Set());

  const toggleReveal = (key: string) => {
    setRevealed(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const removeFromList = (item: ReviewItem) => {
    const k = keyOf(item);
    setList(prev => prev.filter(x => keyOf(x) !== k));
  };

  const addToRetest = (item: ReviewItem) => {
    const k = keyOf(item);
    setRetestList(prev => (prev.some(x => keyOf(x) === k) ? prev : [...prev, item]));
  };

  const postRecord = async (body: Record<string, unknown>) => {
    const res = await fetch('/api/review/record', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    return await res.json();
  };

  // 主轮 / 巩固轮：单词自评
  const recordWord = async (item: WordItem, result: 'remember' | 'fuzzy' | 'forget') => {
    setRecording(item.id);
    try {
      const data = await postRecord({ type: 'word', id: item.id, result });
      if (data.success) {
        const o = data.outcome;
        if (result === 'remember') {
          MessagePlugin.success(`${item.word} · 记得：${o.intervalDays} 天后复习`);
          removeFromList(item);
        } else if (result === 'fuzzy') {
          MessagePlugin.success(`${item.word} · 模糊：稍后巩固一遍`);
          removeFromList(item);
          addToRetest(item);
        } else {
          MessagePlugin.warning(`${item.word} · 忘记：先重学，记住了再巩固`);
          setRelearning(prev => new Set(prev).add(keyOf(item)));
        }
      } else {
        MessagePlugin.error(data.error || '记录失败');
      }
    } catch {
      MessagePlugin.error('网络错误，请重试');
    } finally {
      setRecording(null);
    }
  };

  // 重学后「我记住了」→ 记一次成功 + 加入稍后重测
  const relearnDone = async (item: WordItem) => {
    setRecording(item.id);
    try {
      const data = await postRecord({ type: 'word', id: item.id, result: 'remember' });
      if (data.success) {
        MessagePlugin.success(`${item.word} · 已记住，稍后巩固一遍`);
        setRelearning(prev => {
          const next = new Set(prev);
          next.delete(keyOf(item));
          return next;
        });
        removeFromList(item);
        addToRetest(item);
      } else {
        MessagePlugin.error(data.error || '记录失败');
      }
    } catch {
      MessagePlugin.error('网络错误，请重试');
    } finally {
      setRecording(null);
    }
  };

  // 错题自评（保留原逻辑）
  const recordMistake = async (item: MistakeItem, result: 'remember' | 'forget') => {
    setRecording(item.id);
    try {
      const data = await postRecord({ type: 'mistake', id: item.id, result });
      if (data.success) {
        MessagePlugin.success(result === 'remember' ? '已掌握，错题次数递减' : '已记录，继续巩固');
        removeFromList(item);
      } else {
        MessagePlugin.error(data.error || '记录失败');
      }
    } catch {
      MessagePlugin.error('网络错误，请重试');
    } finally {
      setRecording(null);
    }
  };

  // 进入巩固轮：稍后重测队列变成主队列
  const startRetest = () => {
    setList(retestList);
    setRetestList([]);
    setInRetest(true);
    setRevealed(new Set());
  };

  // 渲染词根拆解行
  const renderRootParts = (w: WordItem) => {
    const parts = [
      w.prefix ? `${w.prefix}(${w.prefix_meaning || ''})` : null,
      w.root ? `${w.root}(${w.root_meaning || ''})` : null,
      w.suffix ? `${w.suffix}(${w.suffix_meaning || ''})` : null,
    ].filter(Boolean).join(' + ');
    return parts;
  };

  const allDone = list.length === 0 && retestList.length === 0 && relearning.size === 0;

  if (allDone) {
    return (
      <div
        className="flex items-center gap-2 px-4 py-4 rounded-lg"
        style={{ backgroundColor: 'var(--td-bg-color-component)' }}
      >
        <CheckCircleFilledIcon size="18px" style={{ color: 'var(--td-success-color)' }} />
        <span style={{ color: 'var(--td-text-color-primary)' }}>
          今日复习完成！继续保持哦
        </span>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* 巩固轮入口：主队列空但还有稍后重测 */}
      {list.length === 0 && retestList.length > 0 && (
        <div
          className="px-4 py-5 rounded-lg text-center"
          style={{ backgroundColor: 'var(--td-brand-color-light)' }}
        >
          <div className="text-sm font-medium" style={{ color: 'var(--td-text-color-primary)' }}>
            还有 {retestList.length} 个词需要巩固
          </div>
          <div className="text-xs mt-1" style={{ color: 'var(--td-text-color-secondary)' }}>
            这些是刚才「模糊」或「重学后记住」的词，再快速过一遍记得更牢
          </div>
          <Button className="mt-3" theme="primary" onClick={startRetest}>
            开始巩固
          </Button>
        </div>
      )}

      {list.length > 0 && (
        <div className="text-sm" style={{ color: 'var(--td-text-color-secondary)' }}>
          {inRetest
            ? `巩固轮：${list.length} 个词快速过一遍（记得 / 忘记）`
            : `今日待复习 ${list.length} 项，先回忆再点开释义，如实自评：`}
        </div>
      )}

      {list.map(item => {
        const k = keyOf(item);
        const isRevealed = revealed.has(k);

        if (item.type === 'word') {
          const isRelearning = relearning.has(k);
          const rootParts = renderRootParts(item);

          return (
            <div
              key={k}
              className="px-4 py-3 rounded-lg"
              style={{
                backgroundColor: 'var(--td-bg-color-component)',
                border: `1px solid ${isRelearning ? 'var(--td-warning-color)' : 'var(--td-component-border)'}`,
              }}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-1">
                    <div className="text-2xl font-semibold" style={{ color: 'var(--td-text-color-primary)' }}>
                      {item.word}
                    </div>
                    <Button shape="circle" variant="text" size="small" icon={<SoundIcon />} onClick={() => speak(item.word, { rate: 0.7 })} />
                    {item.phonetic && (
                      <span className="text-xs" style={{ color: 'var(--td-text-color-placeholder)' }}>{item.phonetic}</span>
                    )}
                  </div>
                  <div className="text-xs mt-0.5" style={{ color: 'var(--td-text-color-placeholder)' }}>
                    掌握度 {item.level}/5
                  </div>
                </div>

                {/* 重学态：底部是重学面板，右侧只保留重学按钮 */}
                {!isRelearning && (
                  <div className="flex gap-2 flex-shrink-0">
                    {inRetest ? (
                      <>
                        <Button size="small" theme="success" variant="outline" loading={recording === item.id} onClick={() => recordWord(item, 'remember')}>记得</Button>
                        <Button size="small" theme="danger" variant="outline" loading={recording === item.id} onClick={() => recordWord(item, 'forget')}>忘记</Button>
                      </>
                    ) : (
                      <>
                        <Button size="small" theme="success" variant="outline" loading={recording === item.id} onClick={() => recordWord(item, 'remember')}>记得</Button>
                        <Button size="small" theme="warning" variant="outline" loading={recording === item.id} onClick={() => recordWord(item, 'fuzzy')}>模糊</Button>
                        <Button size="small" theme="danger" variant="outline" loading={recording === item.id} onClick={() => recordWord(item, 'forget')}>忘记</Button>
                      </>
                    )}
                  </div>
                )}
              </div>

              {/* 重学面板 */}
              {isRelearning ? (
                <div className="mt-3 p-3 rounded-lg space-y-2" style={{ backgroundColor: 'var(--td-bg-color-page)' }}>
                  <div className="flex items-center gap-2">
                    <Tag size="small" theme="warning" variant="light">再学一遍</Tag>
                    <Button size="small" variant="text" icon={<SoundIcon />} onClick={() => speak(item.word, { rate: 0.6 })}>
                      慢速朗读
                    </Button>
                  </div>
                  {rootParts && (
                    <div className="text-sm" style={{ color: 'var(--td-text-color-primary)' }}>
                      🔬 词根拆解：{rootParts}
                    </div>
                  )}
                  {item.etymology && (
                    <div className="text-sm" style={{ color: 'var(--td-text-color-secondary)' }}>
                      词源：{item.etymology}
                    </div>
                  )}
                  <div className="text-sm font-medium" style={{ color: 'var(--td-text-color-primary)' }}>
                    {item.meaning}
                  </div>
                  {item.example && (
                    <div className="text-sm italic" style={{ color: 'var(--td-text-color-secondary)' }}>
                      "{item.example}"
                    </div>
                  )}
                  <div className="flex gap-2 pt-1">
                    <Button size="small" theme="primary" loading={recording === item.id} onClick={() => relearnDone(item)}>
                      我记住了
                    </Button>
                    <Button size="small" variant="outline" onClick={() => setRelearning(prev => { const n = new Set(prev); n.delete(k); return n; })}>
                      再学一遍
                    </Button>
                  </div>
                </div>
              ) : (
                /* 释义默认隐藏，点击才显示 */
                <div className="mt-2 cursor-pointer" onClick={() => toggleReveal(k)}>
                  {isRevealed ? (
                    <div className="text-sm" style={{ color: 'var(--td-text-color-secondary)' }}>
                      {item.meaning}
                    </div>
                  ) : (
                    <div className="text-sm" style={{ color: 'var(--td-brand-color)' }}>
                      点击显示释义
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        }

        // 错题卡片（保留原逻辑）
        return (
          <div
            key={k}
            className="px-4 py-3 rounded-lg"
            style={{
              backgroundColor: 'var(--td-bg-color-component)',
              border: '1px solid var(--td-component-border)',
            }}
          >
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="text-xs" style={{ color: 'var(--td-text-color-placeholder)' }}>
                  错题{item.point ? ` · ${item.point}` : ''}
                </div>
                <div className="font-medium" style={{ color: 'var(--td-text-color-primary)' }}>
                  {item.question}
                </div>
              </div>
              <div className="flex gap-2 flex-shrink-0">
                <Button size="small" theme="success" variant="outline" loading={recording === item.id} onClick={() => recordMistake(item, 'remember')}>会了</Button>
                <Button size="small" theme="danger" variant="outline" loading={recording === item.id} onClick={() => recordMistake(item, 'forget')}>不会</Button>
              </div>
            </div>

            {item.answer && (
              <div className="mt-2 cursor-pointer" onClick={() => toggleReveal(k)}>
                {isRevealed ? (
                  <div className="text-sm" style={{ color: 'var(--td-success-color)' }}>
                    正确答案：{item.answer}
                  </div>
                ) : (
                  <div className="text-sm" style={{ color: 'var(--td-brand-color)' }}>
                    点击显示答案
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
