import { Loading } from 'tdesign-react';
import { ChatMarkdown } from '@tdesign-react/chat';
import { User, Bot } from 'lucide-react';
import { Message, Model } from '../types';
import { ReviewCard } from './ReviewCard';
import { AssessmentCard } from './AssessmentCard';

interface ChatMessagesProps {
  messages: Message[];
  models: Model[];
  messagesEndRef: React.RefObject<HTMLDivElement>;
}

export function ChatMessages({ messages, models, messagesEndRef }: ChatMessagesProps) {
  const formatModelName = (modelId: string) => {
    const model = models.find(m => m.modelId === modelId);
    const name = model?.name || modelId;
    return name
      .replace(/^(Claude|GPT|Gemini|Kimi|DeepSeek|Qwen|GLM)\s*/i, '')
      .replace(/-/g, ' ')
      .trim() || name;
  };

  return (
    <div className="flex flex-col gap-6 max-w-3xl mx-auto">
      {messages.map(message => (
        <div
          key={message.id}
          className={`flex gap-3 ${message.role === 'user' ? 'flex-row-reverse' : ''}`}
        >
          <div
            className="w-9 h-9 flex items-center justify-center flex-shrink-0 rounded-full self-start"
            style={{
              backgroundColor: message.role === 'user'
                ? 'var(--td-brand-color)'
                : 'var(--td-bg-color-component)',
              color: message.role === 'user'
                ? 'white'
                : 'var(--td-text-color-primary)'
            }}
          >
            {message.role === 'user' ? <User size={18} /> : <Bot size={18} />}
          </div>

          <div
            className={`flex flex-col gap-2 max-w-[80%] ${message.role === 'user' ? 'items-end' : ''}`}
          >
            {message.role === 'assistant' && message.model && (
              <span
                className="text-xs"
                style={{ color: 'var(--td-text-color-placeholder)' }}
              >
                {formatModelName(message.model)}
              </span>
            )}

            {/* 用户消息 */}
            {message.role === 'user' && (
              <div
                className="px-4 py-3 leading-relaxed break-words"
                style={{
                  backgroundColor: 'var(--td-brand-color)',
                  color: 'white',
                  borderRadius: '16px 16px 4px 16px'
                }}
              >
                {message.content}
              </div>
            )}

            {/* 助手消息：交互卡片优先，其次文本 */}
            {message.role === 'assistant' && (
              message.kind === 'review' && message.reviewItems ? (
                <ReviewCard items={message.reviewItems} />
              ) : message.kind === 'assessment' && message.assessmentQuestions ? (
                <AssessmentCard questions={message.assessmentQuestions} sessionId={message.assessmentSessionId} />
              ) : message.content ? (
                <div
                  className="px-4 py-3 leading-relaxed break-words"
                  style={{
                    backgroundColor: 'var(--td-bg-color-component)',
                    color: 'var(--td-text-color-primary)',
                    borderRadius: '16px 16px 16px 4px'
                  }}
                >
                  <div className="chat-markdown">
                    <ChatMarkdown content={message.content} />
                  </div>
                  {message.isStreaming && (
                    <span
                      className="animate-cursor-blink ml-0.5"
                      style={{ color: 'var(--td-brand-color)' }}
                    >
                      |
                    </span>
                  )}
                </div>
              ) : null
            )}

            {/* 思考中状态 */}
            {message.role === 'assistant' && message.isStreaming &&
             !message.content && !message.kind && (
              <div
                className="flex items-center gap-2 px-3 py-2 rounded-lg"
                style={{ backgroundColor: 'var(--td-bg-color-component)' }}
              >
                <Loading size="small" />
                <span
                  className="text-sm"
                  style={{ color: 'var(--td-text-color-secondary)' }}
                >
                  思考中...
                </span>
              </div>
            )}
          </div>
        </div>
      ))}

      <div ref={messagesEndRef} />
    </div>
  );
}
