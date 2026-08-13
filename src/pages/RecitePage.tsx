import { useState, useEffect, useCallback } from 'react';
import { Button, Progress, MessagePlugin, Loading, Tag } from 'tdesign-react';
import { SoundIcon } from 'tdesign-icons-react';
import { speak } from '../utils/speech';
import { recordRecite } from '../utils/daily';

interface ReciteItem {
  id: string;
  word: string;
  phonetic?: string | null;
  meaning: string;
  level?: number;
  root?: string | null;
  root_meaning?: string | null;
  etymology?: string | null;
  scene_tag?: string | null;
  scene_example?: string | null;
  isNew?: boolean;
}

export function RecitePage() {
  const [queue, setQueue] = useState<ReciteItem[]>([]);
  const [total, setTotal] = useState(0);
  const [done, setDone] = useState(0);
  const [loading, setLoading] = useState(true);
  const [revealed, setRevealed] = useState(false);
  const [recording, setRecording] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    fetch('/api/recite/queue')
      .then(r => r.json())
      .then(d => {
        const due: ReciteItem[] = (d.due || []).map((w: any) => ({ ...w, isNew: false }));
        const news: ReciteItem[] = (d.newWords || []).map((w: any) => ({ ...w, isNew: true }));
        const all = [...due, ...news];
        setQueue(all);
        setTotal(all.length);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const current = queue[0];

  const record = async (result: 'remember' | 'fuzzy' | 'forget') => {
    if (!current || recording) return;
    setRecording(true);
    try {
      const res = await fetch('/api/review/record', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'word', id: current.id, result }),
      });
      const data = await res.json();
      if (data.success) {
        recordRecite();
        setDone(d => d + 1);
        setRevealed(false);
        setQueue(prev => prev.slice(1));
      } else {
        MessagePlugin.error(data.error || '记录失败');
      }
    } catch {
      MessagePlugin.error('网络错误，请重试');
    } finally {
      setRecording(false);
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loading size="medium" text="准备单词..." />
      </div>
    );
  }

  // 队列背完
  if (!current) {
    return (
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="text-center max-w-sm w-full py-12 rounded-xl" style={{ backgroundColor: 'var(--td-bg-color-container)' }}>
          <div className="text-4xl mb-3">🎉</div>
          <div className="text-lg font-medium" style={{ color: 'var(--td-text-color-primary)' }}>
            本次背了 {done} 个单词
          </div>
          <div className="text-sm mt-2" style={{ color: 'var(--td-text-color-secondary)' }}>
            继续保持，明天记得回来复习
          </div>
          <Button className="mt-6" theme="primary" onClick={load}>
            再来一组
          </Button>
        </div>
      </div>
    );
  }

  const progress = total > 0 ? Math.round((done / total) * 100) : 0;

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="max-w-xl mx-auto">
        {/* 进度 */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2 text-xs" style={{ color: 'var(--td-text-color-secondary)' }}>
            <span>第 {done + 1} / {total} 个</span>
            <span>{current.isNew ? '新词' : '复习'}</span>
          </div>
          <Progress percentage={progress} theme="success" />
        </div>

        {/* 单词卡片 */}
        <div
          className="rounded-2xl p-8 text-center"
          style={{ backgroundColor: 'var(--td-bg-color-container)' }}
        >
          <div className="flex items-center justify-center gap-3 mb-1">
            <span className="text-5xl font-bold" style={{ color: 'var(--td-text-color-primary)' }}>
              {current.word}
            </span>
            <Button
              shape="circle"
              variant="text"
              icon={<SoundIcon />}
              onClick={() => speak(current.word)}
            />
          </div>
          {current.phonetic && (
            <div className="text-sm" style={{ color: 'var(--td-text-color-placeholder)' }}>
              {current.phonetic}
            </div>
          )}

          {/* 释义：默认隐藏，主动回忆后点击显示 */}
          {revealed ? (
            <div className="mt-6 space-y-3 text-left">
              <div className="text-base font-medium" style={{ color: 'var(--td-brand-color)' }}>
                {current.meaning}
              </div>
              {current.etymology && (
                <div className="text-sm" style={{ color: 'var(--td-text-color-secondary)' }}>
                  🔬 {current.etymology}
                </div>
              )}
              {current.root && (
                <div className="text-sm" style={{ color: 'var(--td-text-color-secondary)' }}>
                  词根：{current.root}{current.root_meaning ? `（${current.root_meaning}）` : ''}
                </div>
              )}
              {current.scene_tag && (
                <Tag size="small" variant="outline" theme="warning">{current.scene_tag}</Tag>
              )}
              {current.scene_example && (
                <div className="text-sm italic" style={{ color: 'var(--td-text-color-secondary)' }}>
                  "{current.scene_example}"
                </div>
              )}
            </div>
          ) : (
            <div className="mt-8">
              <Button variant="outline" onClick={() => setRevealed(true)}>
                显示释义
              </Button>
              <div className="text-xs mt-3" style={{ color: 'var(--td-text-color-placeholder)' }}>
                先在心里回忆它的意思，再点开对照
              </div>
            </div>
          )}
        </div>

        {/* 自评按钮 */}
        {revealed && (
          <div className="flex gap-3 mt-6">
            <Button block theme="success" loading={recording} onClick={() => record('remember')}>认识</Button>
            <Button block theme="warning" loading={recording} onClick={() => record('fuzzy')}>模糊</Button>
            <Button block theme="danger" loading={recording} onClick={() => record('forget')}>不认识</Button>
          </div>
        )}
      </div>
    </div>
  );
}
