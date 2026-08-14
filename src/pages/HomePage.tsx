import { useEffect, useState } from 'react';
import { Loading, Progress, Button, DialogPlugin, MessagePlugin } from 'tdesign-react';
import { BookOpen, RotateCw, BarChart3, MessageCircle, Target } from 'lucide-react';
import { getDailyStats } from '../utils/daily';

interface Stats {
  totalWords: number;
  learnedCount: number;
  dueCount: number;
  dueWords: number;
  dueMistakes: number;
  mistakeCount: number;
  newWordsCount: number;
  levelDist: number[];
}

interface HomePageProps {
  onNavigate: (path: string) => void;
}

const QUICK_ACTIONS = [
  { path: '/recite', label: '背单词', desc: '主动回忆式记忆', icon: Target, color: '#e34d59' },
  { path: '/words', label: '单词库', desc: '词根词源学新词', icon: BookOpen, color: '#0594fa' },
  { path: '/review', label: '复习', desc: '艾宾浩斯巩固记忆', icon: RotateCw, color: '#00a870' },
  { path: '/assessment', label: '测评', desc: '检验掌握程度', icon: BarChart3, color: '#a25eb5' },
  { path: '/oral', label: '场景口语', desc: '情景对话练习', icon: MessageCircle, color: '#ed7b2f' },
];

export function HomePage({ onNavigate }: HomePageProps) {
  const [stats, setStats] = useState<Stats | null>(null);
  const [daily, setDaily] = useState(getDailyStats);

  useEffect(() => {
    fetch('/api/stats')
      .then(r => r.json())
      .then(setStats)
      .catch(() => setStats(null));
  }, []);

  if (!stats) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loading size="medium" text="加载中..." />
      </div>
    );
  }

  const mastered = (stats.levelDist[4] || 0) + (stats.levelDist[5] || 0);
  const learning = (stats.levelDist[1] || 0) + (stats.levelDist[2] || 0) + (stats.levelDist[3] || 0);
  const fresh = stats.levelDist[0] || 0;
  // 学习进度 = 已脱离「刚学 L0」的单词占比（比纯掌握度更友好）
  const progress = stats.learnedCount > 0 ? Math.round(((stats.learnedCount - fresh) / stats.learnedCount) * 100) : 0;
  // 背单词队列内容 = 到期词 + 新词
  const reciteCount = stats.dueWords + (stats.newWordsCount || 0);
  const hasRecite = reciteCount > 0;

  const handleReset = () => {
    DialogPlugin.confirm({
      header: '重置学习进度',
      body: '确定要清空所有学习进度（记忆库 + 错题本）吗？此操作不可撤销，词库本身会保留。',
      confirmBtn: '确定重置',
      cancelBtn: '取消',
      onConfirm: async () => {
        try {
          const r = await fetch('/api/reset-progress', { method: 'POST' });
          const d = await r.json();
          if (d.success) {
            MessagePlugin.success('已重置学习进度');
            const s = await fetch('/api/stats').then(x => x.json());
            setStats(s);
          } else {
            MessagePlugin.error('重置失败，请重试');
          }
        } catch {
          MessagePlugin.error('网络错误，请重试');
        }
      },
    });
  };

  const cards = [
    { label: '词库单词', value: stats.totalWords, color: 'var(--td-brand-color)' },
    { label: '已学单词', value: stats.learnedCount, color: 'var(--td-success-color)' },
    { label: '今日待复习', value: stats.dueCount, color: 'var(--td-warning-color)' },
    { label: '错题', value: stats.mistakeCount, color: 'var(--td-error-color)' },
  ];

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* 统计卡片 */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {cards.map(c => (
            <div
              key={c.label}
              className="px-5 py-4 rounded-xl"
              style={{ backgroundColor: 'var(--td-bg-color-container)' }}
            >
              <div className="text-3xl font-semibold" style={{ color: c.color }}>
                {c.value}
              </div>
              <div className="text-sm mt-1" style={{ color: 'var(--td-text-color-secondary)' }}>
                {c.label}
              </div>
            </div>
          ))}
        </div>

        {/* 开始背单词主按钮 */}
        <div>
          <Button
            block
            theme="primary"
            onClick={() => onNavigate(hasRecite ? '/recite' : '/review')}
            style={{ height: 56, fontSize: 16 }}
            icon={<Target size={20} />}
          >
            {hasRecite
              ? `开始背单词（今日 ${daily.todayCount}/${daily.goal} · 待背 ${reciteCount} 词）`
              : `去复习巩固（今日待巩固 ${stats.dueMistakes} 道错题）`}
          </Button>
          <div className="text-center text-xs mt-2" style={{ color: 'var(--td-text-color-placeholder)' }}>
            🔥 连续打卡 {daily.streak} 天
          </div>
        </div>

        {/* 掌握度概览 */}
        <div
          className="px-5 py-4 rounded-xl"
          style={{ backgroundColor: 'var(--td-bg-color-container)' }}
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium" style={{ color: 'var(--td-text-color-primary)' }}>
              学习进度
            </span>
            <span className="text-xs" style={{ color: 'var(--td-text-color-secondary)' }}>
              学习中 {learning} · 已掌握 {mastered} / 已学 {stats.learnedCount}
            </span>
          </div>
          <Progress percentage={progress} theme={progress >= 60 ? 'success' : 'warning'} />
          <div className="flex gap-6 mt-3 text-xs" style={{ color: 'var(--td-text-color-secondary)' }}>
            <span>今日单词复习 {stats.dueWords} 个</span>
            <span>今日错题巩固 {stats.dueMistakes} 道</span>
            <button
              onClick={handleReset}
              style={{ color: 'var(--td-text-color-placeholder)', background: 'none', border: 'none', cursor: 'pointer', marginLeft: 'auto', fontSize: 12 }}
            >
              重置学习进度
            </button>
          </div>
        </div>

        {/* 快速入口 */}
        <div>
          <h2 className="text-sm font-medium mb-3" style={{ color: 'var(--td-text-color-primary)' }}>
            开始学习
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {QUICK_ACTIONS.map(a => {
              const Icon = a.icon;
              return (
                <div
                  key={a.path}
                  className="px-4 py-5 rounded-xl cursor-pointer transition-transform hover:-translate-y-0.5"
                  style={{ backgroundColor: 'var(--td-bg-color-container)' }}
                  onClick={() => onNavigate(a.path)}
                >
                  <div
                    className="w-10 h-10 rounded-lg flex items-center justify-center mb-3"
                    style={{ backgroundColor: a.color + '22' }}
                  >
                    <Icon size={20} color={a.color} />
                  </div>
                  <div className="font-medium" style={{ color: 'var(--td-text-color-primary)' }}>
                    {a.label}
                  </div>
                  <div className="text-xs mt-1" style={{ color: 'var(--td-text-color-secondary)' }}>
                    {a.desc}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
