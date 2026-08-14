import { Bot, Home, BookOpen, RotateCw, BarChart3, MessageCircle, Target } from 'lucide-react';

interface MobileTabBarProps {
  currentPath: string;
  onNavigate: (path: string) => void;
}

// 移动端底部导航（桌面端隐藏，md 断点以上显示侧边栏）
const NAV_ITEMS = [
  { path: '/', label: '学习', icon: Home },
  { path: '/recite', label: '背单词', icon: Target },
  { path: '/words', label: '单词库', icon: BookOpen },
  { path: '/review', label: '复习', icon: RotateCw },
  { path: '/assessment', label: '测评', icon: BarChart3 },
  { path: '/oral', label: '口语', icon: MessageCircle },
  { path: '/chat', label: 'AI', icon: Bot },
];

export function MobileTabBar({ currentPath, onNavigate }: MobileTabBarProps) {
  const isActive = (path: string) => {
    if (path === '/') return currentPath === '/';
    return currentPath === path || currentPath.startsWith(path + '/');
  };

  return (
    <nav
      className="md:hidden fixed bottom-0 left-0 right-0 z-50 flex items-stretch justify-around"
      style={{
        backgroundColor: 'var(--td-bg-color-container)',
        borderTop: '1px solid var(--td-component-border)',
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}
    >
      {NAV_ITEMS.map(item => {
        const Icon = item.icon;
        const active = isActive(item.path);
        return (
          <button
            key={item.path}
            onClick={() => onNavigate(item.path)}
            className="flex-1 flex flex-col items-center justify-center gap-0.5 py-1.5"
            style={{
              minHeight: '52px',
              color: active ? 'var(--td-brand-color)' : 'var(--td-text-color-secondary)',
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              WebkitTapHighlightColor: 'transparent',
            }}
          >
            <Icon size={22} />
            <span style={{ fontSize: '10px', lineHeight: 1.2 }}>{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
