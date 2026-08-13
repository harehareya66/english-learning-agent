import { useEffect, useState } from 'react';
import { Loading, Tag, Button, Radio } from 'tdesign-react';

interface SceneSummary {
  tag: string;
  title: string;
}

interface SceneLine {
  role: 'A' | 'B';
  text: string;
  note?: string;
}

interface Scene {
  tag: string;
  title: string;
  intro: string;
  lines: SceneLine[];
}

export function OralPage() {
  const [scenes, setScenes] = useState<SceneSummary[]>([]);
  const [scene, setScene] = useState<Scene | null>(null);
  const [loading, setLoading] = useState(true);
  const [revealed, setRevealed] = useState<Set<number>>(new Set());
  const [mode, setMode] = useState<'browse' | 'practice'>('browse');

  useEffect(() => {
    fetch('/api/scenes')
      .then(r => r.json())
      .then(d => setScenes(d.scenes || []))
      .finally(() => setLoading(false));
  }, []);

  const selectScene = (tag: string) => {
    setScene(null);
    setRevealed(new Set());
    fetch(`/api/scenes/${encodeURIComponent(tag)}`)
      .then(r => r.json())
      .then(d => setScene(d.scene || null));
  };

  const toggleReveal = (idx: number) => {
    setRevealed(prev => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loading size="medium" text="加载场景..." />
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="max-w-2xl mx-auto space-y-5">
        {/* 场景选择 */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm" style={{ color: 'var(--td-text-color-secondary)' }}>
              选择一个场景，进行角色扮演口语练习
            </p>
            <Radio.Group
              value={mode}
              variant="default-filled"
              size="small"
              onChange={(v) => { setMode(v as 'browse' | 'practice'); setRevealed(new Set()); }}
            >
              <Radio.Button value="browse">浏览</Radio.Button>
              <Radio.Button value="practice">跟读</Radio.Button>
            </Radio.Group>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {scenes.map(s => (
              <div
                key={s.tag}
                className="px-4 py-3 rounded-lg cursor-pointer transition-colors"
                style={{
                  backgroundColor: scene?.tag === s.tag ? 'var(--td-brand-color-light)' : 'var(--td-bg-color-container)',
                  border: `1px solid ${scene?.tag === s.tag ? 'var(--td-brand-color)' : 'var(--td-component-border)'}`
                }}
                onClick={() => selectScene(s.tag)}
              >
                <div className="font-medium" style={{ color: 'var(--td-text-color-primary)' }}>
                  {s.title}
                </div>
                <div className="text-xs mt-1" style={{ color: 'var(--td-text-color-secondary)' }}>
                  {s.tag}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 对话展示 */}
        {scene ? (
          <div
            className="rounded-xl p-5 space-y-4"
            style={{ backgroundColor: 'var(--td-bg-color-container)' }}
          >
            <div>
              <div className="font-medium" style={{ color: 'var(--td-text-color-primary)' }}>
                {scene.title}
              </div>
              <div className="text-xs mt-1" style={{ color: 'var(--td-text-color-secondary)' }}>
                {scene.intro}
              </div>
            </div>

            <div className="space-y-3">
              {scene.lines.map((l, i) => (
                <div
                  key={i}
                  className={`flex ${l.role === 'B' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className="max-w-[80%] px-4 py-3 rounded-xl cursor-pointer"
                    style={{
                      backgroundColor: l.role === 'B' ? 'var(--td-brand-color)' : 'var(--td-bg-color-component)',
                      color: l.role === 'B' ? 'white' : 'var(--td-text-color-primary)',
                      borderRadius: l.role === 'B' ? '16px 16px 4px 16px' : '16px 16px 16px 4px'
                    }}
                    onClick={() => toggleReveal(i)}
                    title={mode === 'browse' ? '点击查看 / 隐藏中文释义' : '开口说出英文，点击对照'}
                  >
                    {mode === 'browse' ? (
                      <>
                        <div className="text-sm leading-relaxed">{l.text}</div>
                        {l.note && (
                          <div
                            className="text-xs mt-1"
                            style={{ color: l.role === 'B' ? 'rgba(255,255,255,0.7)' : 'var(--td-text-color-placeholder)' }}
                          >
                            {revealed.has(i) ? l.note : '点击查看释义'}
                          </div>
                        )}
                      </>
                    ) : (
                      <>
                        <div className="text-sm leading-relaxed">{l.note || l.text}</div>
                        <div
                          className="text-xs mt-1"
                          style={{ color: l.role === 'B' ? 'rgba(255,255,255,0.7)' : 'var(--td-text-color-placeholder)' }}
                        >
                          {revealed.has(i) ? l.text : '开口说出英文，点击对照'}
                        </div>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="text-sm" style={{ color: 'var(--td-text-color-secondary)' }}>
              💬 试着扮演角色 B 朗读台词，或到「AI 对话」里进行自由口语练习。
            </div>
          </div>
        ) : (
          <div
            className="text-center py-12 rounded-xl"
            style={{ backgroundColor: 'var(--td-bg-color-container)' }}
          >
            <div className="text-sm" style={{ color: 'var(--td-text-color-placeholder)' }}>
              点击上方场景开始练习
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
