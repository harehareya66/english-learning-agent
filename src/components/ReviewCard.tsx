import { useState } from 'react';
import { Button, MessagePlugin } from 'tdesign-react';
import { CheckCircleFilledIcon, SoundIcon } from 'tdesign-icons-react';
import { ReviewItem } from '../types';
import { speak } from '../utils/speech';

interface ReviewCardProps {
  items: ReviewItem[];
}

// 复习卡片：中英分离（先看英文回忆，再点开释义），艾宾浩斯驱动自评
export function ReviewCard({ items }: ReviewCardProps) {
  const [list, setList] = useState<ReviewItem[]>(items);
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

  const recordWord = async (item: Extract<ReviewItem, { type: 'word' }>, result: 'remember' | 'fuzzy' | 'forget') => {
    setRecording(item.id);
    try {
      const res = await fetch('/api/review/record', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'word', id: item.id, result }),
      });
      const data = await res.json();
      if (data.success) {
        const o = data.outcome;
        const label = result === 'remember' ? '记得' : result === 'fuzzy' ? '模糊' : '忘记';
        MessagePlugin.success(`${item.word} · ${label}：掌握度 ${item.level}→${o.level}，${o.intervalDays} 天后复习`);
        setList(prev => prev.filter(x => !(x.type === 'word' && x.id === item.id)));
      } else {
        MessagePlugin.error(data.error || '记录失败');
      }
    } catch {
      MessagePlugin.error('网络错误，请重试');
    } finally {
      setRecording(null);
    }
  };

  const recordMistake = async (item: Extract<ReviewItem, { type: 'mistake' }>, result: 'remember' | 'forget') => {
    setRecording(item.id);
    try {
      const res = await fetch('/api/review/record', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'mistake', id: item.id, result }),
      });
      const data = await res.json();
      if (data.success) {
        MessagePlugin.success(result === 'remember' ? '已掌握，错题次数递减' : '已记录，继续巩固');
        setList(prev => prev.filter(x => !(x.type === 'mistake' && x.id === item.id)));
      } else {
        MessagePlugin.error(data.error || '记录失败');
      }
    } catch {
      MessagePlugin.error('网络错误，请重试');
    } finally {
      setRecording(null);
    }
  };

  if (list.length === 0) {
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
      <div
        className="text-sm"
        style={{ color: 'var(--td-text-color-secondary)' }}
      >
        今日待复习 {list.length} 项，先回忆再点开释义，如实自评：
      </div>

      {list.map(item => {
        const key = `${item.type}-${item.id}`;
        const isRevealed = revealed.has(key);

        if (item.type === 'word') {
          return (
            <div
              key={key}
              className="px-4 py-3 rounded-lg"
              style={{
                backgroundColor: 'var(--td-bg-color-component)',
                border: '1px solid var(--td-component-border)',
              }}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-1">
                    <div className="text-2xl font-semibold" style={{ color: 'var(--td-text-color-primary)' }}>
                      {item.word}
                    </div>
                    <Button shape="circle" variant="text" size="small" icon={<SoundIcon />} onClick={() => speak(item.word)} />
                  </div>
                  <div className="text-xs mt-0.5" style={{ color: 'var(--td-text-color-placeholder)' }}>
                    掌握度 {item.level}/5
                  </div>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <Button size="small" theme="success" variant="outline" loading={recording === item.id} onClick={() => recordWord(item, 'remember')}>记得</Button>
                  <Button size="small" theme="warning" variant="outline" loading={recording === item.id} onClick={() => recordWord(item, 'fuzzy')}>模糊</Button>
                  <Button size="small" theme="danger" variant="outline" loading={recording === item.id} onClick={() => recordWord(item, 'forget')}>忘记</Button>
                </div>
              </div>

              {/* 释义默认隐藏，点击才显示 */}
              <div
                className="mt-2 cursor-pointer"
                onClick={() => toggleReveal(key)}
              >
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
            </div>
          );
        }

        return (
          <div
            key={key}
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

            {/* 答案默认隐藏 */}
            {item.answer && (
              <div
                className="mt-2 cursor-pointer"
                onClick={() => toggleReveal(key)}
              >
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
