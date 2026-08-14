import { Button, Tooltip } from 'tdesign-react';
import { AddIcon, DeleteIcon, SettingIcon } from 'tdesign-icons-react';
import { Bot, Home, BookOpen, RotateCw, BarChart3, MessageCircle, Target } from 'lucide-react';
import { APP_CONFIG } from '../config';
import { Session, Agent } from '../types';
import { ICON_MAP } from '../utils/iconMap';

interface SidebarProps {
  sessions: Session[];
  currentSessionId: string | null;
  currentPath: string;
  sidebarOpen: boolean;
  agents: Agent[];
  getAgent: (id: string) => Agent | undefined;
  onNavigate: (path: string) => void;
  onNewChat: () => void;
  onSelectSession: (sessionId: string) => void;
  onDeleteSession: (sessionId: string) => void;
}

// 功能导航项
const NAV_ITEMS = [
  { path: '/', label: '学习中心', icon: Home },
  { path: '/recite', label: '背单词', icon: Target },
  { path: '/words', label: '单词库', icon: BookOpen },
  { path: '/review', label: '复习', icon: RotateCw },
  { path: '/assessment', label: '测评', icon: BarChart3 },
  { path: '/oral', label: '场景口语', icon: MessageCircle },
  { path: '/chat', label: 'AI 对话', icon: Bot },
];

export function Sidebar({
  sessions,
  currentSessionId,
  currentPath,
  sidebarOpen,
  agents,
  getAgent,
  onNavigate,
  onNewChat,
  onSelectSession,
  onDeleteSession,
}: SidebarProps) {
  const isChatPage = currentPath === '/chat' || currentPath.startsWith('/chat/');
  const isActive = (path: string) => {
    if (path === '/') return currentPath === '/';
    return currentPath === path || currentPath.startsWith(path + '/');
  };

  return (
    <aside
      className="hidden md:flex flex-col flex-shrink-0 transition-all duration-300 overflow-hidden"
      style={{
        width: sidebarOpen ? 260 : 0,
        backgroundColor: 'var(--td-bg-color-container)'
      }}
    >
      {/* Logo */}
      <div className="h-14 px-4 flex items-center flex-shrink-0">
        <div className="flex items-center gap-2.5">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ backgroundColor: 'var(--td-brand-color)' }}
          >
            <span className="text-white text-sm font-bold">{APP_CONFIG.nameInitial}</span>
          </div>
          <span
            className="text-lg font-semibold"
            style={{ color: 'var(--td-text-color-primary)' }}
          >
            {APP_CONFIG.name}
          </span>
        </div>
      </div>

      {/* 功能导航 */}
      <div className="p-2 space-y-1">
        {NAV_ITEMS.map(item => {
          const Icon = item.icon;
          const active = isActive(item.path);
          return (
            <div
              key={item.path}
              className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg cursor-pointer transition-colors duration-200"
              style={{
                backgroundColor: active ? 'var(--td-brand-color-light)' : 'transparent',
                color: active ? 'var(--td-brand-color)' : 'var(--td-text-color-secondary)'
              }}
              onClick={() => onNavigate(item.path)}
            >
              <Icon size={18} />
              <span className="flex-1 text-sm">{item.label}</span>
            </div>
          );
        })}
      </div>

      {/* 会话列表（仅 AI 对话页显示） */}
      {isChatPage && (
        <>
          <div className="px-3 pt-3 pb-1 flex items-center justify-between">
            <span className="text-xs" style={{ color: 'var(--td-text-color-placeholder)' }}>
              对话历史
            </span>
            <Button
              size="small"
              variant="text"
              icon={<AddIcon />}
              onClick={onNewChat}
            >
              新对话
            </Button>
          </div>
          <div className="flex-1 overflow-y-auto px-2 pb-2 space-y-1">
            {sessions.map(session => {
              const sessionAgent = session.agentId ? getAgent(session.agentId) : getAgent('default');
              const AgentIcon = ICON_MAP[sessionAgent?.icon || 'Bot'] || Bot;
              return (
                <div
                  key={session.id}
                  className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg cursor-pointer transition-colors duration-200 group"
                  style={{
                    backgroundColor: session.id === currentSessionId
                      ? 'var(--td-brand-color-light)'
                      : 'transparent',
                    color: session.id === currentSessionId
                      ? 'var(--td-brand-color)'
                      : 'var(--td-text-color-secondary)'
                  }}
                  onClick={() => onSelectSession(session.id)}
                  onMouseEnter={(e) => {
                    if (session.id !== currentSessionId) {
                      e.currentTarget.style.backgroundColor = 'var(--td-bg-color-component-hover)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (session.id !== currentSessionId) {
                      e.currentTarget.style.backgroundColor = 'transparent';
                    }
                  }}
                >
                  <div
                    className="flex-shrink-0 w-5 h-5 rounded flex items-center justify-center"
                    style={{ backgroundColor: sessionAgent?.color || 'var(--td-brand-color)' }}
                  >
                    <AgentIcon size={12} color="white" />
                  </div>
                  <span className="flex-1 truncate text-sm">{session.title}</span>
                  <Tooltip content="删除会话">
                    <Button
                      className="opacity-0 group-hover:opacity-100 transition-opacity"
                      variant="text"
                      shape="circle"
                      size="medium"
                      icon={<DeleteIcon />}
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteSession(session.id);
                      }}
                    />
                  </Tooltip>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* 底部设置按钮 */}
      <div
        className="p-3 border-t flex-shrink-0"
        style={{ borderColor: 'var(--td-component-border)' }}
      >
        <Button
          icon={<SettingIcon />}
          onClick={() => onNavigate('/settings')}
          block
          variant={currentPath === '/settings' ? 'outline' : 'text'}
          theme={currentPath === '/settings' ? 'primary' : 'default'}
        >
          设置
        </Button>
      </div>
    </aside>
  );
}
