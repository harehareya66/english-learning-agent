import { useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Model, Session, CustomAgent } from '../types';
import { NewChatView } from '../components/NewChatView';
import { ChatMessages } from '../components/ChatMessages';
import { ChatInput } from '../components/ChatInput';

interface ChatPageProps {
  currentSession: Session | undefined;
  models: Model[];
  selectedModel: string;
  agents: CustomAgent[];
  isLoading: boolean;
  inputValue: string;
  onSendMessage: (message: string, newChatOptions?: NewChatOptions, onNavigate?: (path: string) => void) => void;
  onStop: () => void;
  onInputChange: (value: string) => void;
  onModelChange: (modelId: string) => void;
}

interface NewChatOptions {
  agentId: string;
}

export function ChatPage({
  currentSession,
  models,
  selectedModel,
  isLoading,
  inputValue,
  onSendMessage,
  onStop,
  onInputChange,
  onModelChange,
}: ChatPageProps) {
  const navigate = useNavigate();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // 自动滚动到底部
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [currentSession?.messages]);

  // 处理发送消息
  const handleSend = useCallback((message: string) => {
    if (!currentSession) {
      onSendMessage(message, { agentId: 'default' }, (path) => {
        navigate(path);
      });
    } else {
      onSendMessage(message);
    }
  }, [currentSession, onSendMessage, navigate]);

  const showNewChatView = !currentSession || currentSession.messages.length === 0;

  return (
    <>
      {/* 消息区域 */}
      <div className="flex-1 overflow-y-auto p-6">
        {showNewChatView ? (
          <NewChatView />
        ) : (
          <ChatMessages
            messages={currentSession!.messages}
            models={models}
            messagesEndRef={messagesEndRef}
          />
        )}
      </div>

      {/* 输入区域 */}
      <ChatInput
        inputValue={inputValue}
        selectedModel={selectedModel}
        models={models}
        isLoading={isLoading}
        onSend={handleSend}
        onStop={onStop}
        onChange={onInputChange}
        onModelChange={onModelChange}
      />
    </>
  );
}
