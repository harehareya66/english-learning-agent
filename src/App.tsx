import { useState, useEffect, useCallback, lazy, Suspense } from 'react';
import { Routes, Route, useNavigate, useParams, useLocation } from 'react-router-dom';
import '@tdesign-react/chat/es/style/index.js';

import { useAgents } from './hooks/useAgents';
import { useTheme } from './hooks/useTheme';
import { useSessions } from './hooks/useSessions';
import { useModels } from './hooks/useModels';
import { useChat } from './hooks/useChat';

import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';

// 路由懒加载：各页面按需加载，减小首屏体积（命名导出转 default）
const SettingsPage = lazy(() => import('./components/SettingsPage').then(m => ({ default: m.SettingsPage })));
const ChatPage = lazy(() => import('./pages/ChatPage').then(m => ({ default: m.ChatPage })));
const HomePage = lazy(() => import('./pages/HomePage').then(m => ({ default: m.HomePage })));
const WordsPage = lazy(() => import('./pages/WordsPage').then(m => ({ default: m.WordsPage })));
const ReviewPage = lazy(() => import('./pages/ReviewPage').then(m => ({ default: m.ReviewPage })));
const AssessmentPage = lazy(() => import('./pages/AssessmentPage').then(m => ({ default: m.AssessmentPage })));
const OralPage = lazy(() => import('./pages/OralPage').then(m => ({ default: m.OralPage })));
const RecitePage = lazy(() => import('./pages/RecitePage').then(m => ({ default: m.RecitePage })));

function App() {
  return (
    <Routes>
      <Route path="/*" element={<AppContent />} />
    </Routes>
  );
}

function AppContent() {
  const navigate = useNavigate();
  const { sessionId: urlSessionId } = useParams<{ sessionId: string }>();
  const location = useLocation();
  const pathname = location.pathname;
  const isChatPage = pathname === '/chat' || pathname.startsWith('/chat/');

  // Hooks
  const { theme, toggleTheme } = useTheme();
  const { agents, addAgent, updateAgent, deleteAgent, getAgent } = useAgents();
  const { models, selectedModel, setSelectedModel, fetchModels } = useModels();
  const {
    sessions,
    setSessions,
    currentSessionId,
    setCurrentSessionId,
    currentSession,
    sessionModels,
    fetchSessions,
    deleteSession,
    updateSessionModel,
    addSession,
    updateSession,
    updateSessionMessages,
  } = useSessions();

  // 聊天 Hook
  const {
    isLoading,
    inputValue,
    setInputValue,
    sendMessage,
    handleStop,
  } = useChat({
    currentSession,
    currentSessionId,
    selectedModel,
    getAgent,
    addSession,
    updateSession,
    updateSessionMessages,
    updateSessionModel,
    setCurrentSessionId,
    setSessions,
  });

  // 获取当前会话的 Agent
  const currentAgent = currentSession?.agentId ? getAgent(currentSession.agentId) : getAgent('default');

  // 从 URL 同步 sessionId
  useEffect(() => {
    if (urlSessionId && urlSessionId !== currentSessionId) {
      setCurrentSessionId(urlSessionId);
    } else if (!urlSessionId && !isChatPage && currentSessionId) {
      setCurrentSessionId(null);
    }
  }, [urlSessionId, isChatPage, currentSessionId, setCurrentSessionId]);

  // 当切换会话时，恢复该会话的模型选择
  useEffect(() => {
    if (currentSessionId && sessionModels[currentSessionId]) {
      setSelectedModel(sessionModels[currentSessionId]);
    } else if (currentSession) {
      setSelectedModel(currentSession.model);
    }
  }, [currentSessionId, sessionModels, currentSession, setSelectedModel]);

  // 初始加载会话列表
  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  // 更新当前会话的模型
  const updateCurrentSessionModel = useCallback((modelId: string) => {
    setSelectedModel(modelId);
    if (currentSessionId) {
      updateSessionModel(currentSessionId, modelId);
    }
  }, [currentSessionId, updateSessionModel, setSelectedModel]);

  // 删除会话处理
  const handleDeleteSession = useCallback(async (sessionId: string) => {
    const navigateTo = await deleteSession(sessionId);
    if (navigateTo) {
      navigate(navigateTo);
    }
  }, [deleteSession, navigate]);

  // 导航处理
  const handleNavigate = useCallback((path: string) => {
    navigate(path);
  }, [navigate]);

  const handleNewChat = useCallback(() => {
    setCurrentSessionId(null);
    navigate('/chat');
  }, [navigate, setCurrentSessionId]);

  const handleSelectSession = useCallback((sessionId: string) => {
    setCurrentSessionId(sessionId);
    navigate(`/chat/${sessionId}`);
  }, [navigate, setCurrentSessionId]);

  // Sidebar 状态
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // 页面标题
  const getPageTitle = () => {
    if (pathname === '/settings') return '设置';
    if (pathname === '/words') return '单词库';
    if (pathname === '/recite') return '背单词';
    if (pathname === '/review') return '复习';
    if (pathname === '/assessment') return '测评';
    if (pathname === '/oral') return '场景口语';
    if (isChatPage) return currentSession?.title || 'AI 对话';
    return '学习中心';
  };

  // 页面渲染
  const renderPage = () => {
    if (pathname === '/settings') {
      return <SettingsPage agents={agents} onAdd={addAgent} onUpdate={updateAgent} onDelete={deleteAgent} />;
    }
    if (pathname === '/words') {
      return <WordsPage />;
    }
    if (pathname === '/recite') {
      return <RecitePage />;
    }
    if (pathname === '/review') {
      return <ReviewPage />;
    }
    if (pathname === '/assessment') {
      return <AssessmentPage />;
    }
    if (pathname === '/oral') {
      return <OralPage />;
    }
    if (isChatPage) {
      return (
        <ChatPage
          currentSession={currentSession}
          models={models}
          selectedModel={selectedModel}
          agents={agents}
          isLoading={isLoading}
          inputValue={inputValue}
          onSendMessage={sendMessage}
          onStop={handleStop}
          onInputChange={setInputValue}
          onModelChange={updateCurrentSessionModel}
        />
      );
    }
    return <HomePage onNavigate={handleNavigate} />;
  };

  return (
    <div
      className="flex h-screen w-screen"
      style={{ backgroundColor: 'var(--td-bg-color-page)' }}
    >
      <Sidebar
        sessions={sessions}
        currentSessionId={currentSessionId}
        currentPath={pathname}
        sidebarOpen={sidebarOpen}
        agents={agents}
        getAgent={getAgent}
        onNavigate={handleNavigate}
        onNewChat={handleNewChat}
        onSelectSession={handleSelectSession}
        onDeleteSession={handleDeleteSession}
      />

      <main
        className="flex-1 flex flex-col min-w-0"
        style={{ backgroundColor: 'var(--td-bg-color-page)' }}
      >
        <Header
          title={getPageTitle()}
          sidebarOpen={sidebarOpen}
          theme={theme}
          onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
          onToggleTheme={toggleTheme}
        />

        <Suspense
          fallback={
            <div className="flex-1 flex items-center justify-center" style={{ color: 'var(--td-text-color-placeholder)' }}>
              加载中...
            </div>
          }
        >
          {renderPage()}
        </Suspense>
      </main>
    </div>
  );
}

export default App;
