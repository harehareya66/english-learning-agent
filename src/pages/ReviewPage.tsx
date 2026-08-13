import { useEffect, useState } from 'react';
import { Loading, Button } from 'tdesign-react';
import { RefreshIcon } from 'tdesign-icons-react';
import { ReviewCard } from '../components/ReviewCard';
import { ReviewItem } from '../types';

export function ReviewPage() {
  const [items, setItems] = useState<ReviewItem[] | null>(null);

  const load = () => {
    setItems(null);
    fetch('/api/review/today')
      .then(r => r.json())
      .then(d => setItems(d.items || []));
  };

  useEffect(() => {
    load();
  }, []);

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm" style={{ color: 'var(--td-text-color-secondary)' }}>
            根据艾宾浩斯遗忘曲线自动安排今日复习
          </p>
          <Button size="small" variant="text" icon={<RefreshIcon />} onClick={load}>
            刷新
          </Button>
        </div>

        {items === null ? (
          <div className="flex items-center justify-center py-20">
            <Loading size="medium" text="加载复习计划..." />
          </div>
        ) : items.length === 0 ? (
          <div
            className="text-center py-16 rounded-xl"
            style={{ backgroundColor: 'var(--td-bg-color-container)' }}
          >
            <div className="text-3xl mb-3">🎉</div>
            <div style={{ color: 'var(--td-text-color-primary)' }}>今日没有待复习内容</div>
            <div className="text-sm mt-2" style={{ color: 'var(--td-text-color-secondary)' }}>
              去「单词库」学几个新词，或做一套「测评」吧
            </div>
          </div>
        ) : (
          <ReviewCard items={items} />
        )}
      </div>
    </div>
  );
}
