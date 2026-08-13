import { useRef, useCallback, useEffect } from 'react';
import { Select } from 'tdesign-react';
import { ChatSender } from '@tdesign-react/chat';
import { ChevronDownIcon } from 'tdesign-icons-react';
import { Model } from '../types';

interface ChatInputProps {
  inputValue: string;
  selectedModel: string;
  models: Model[];
  isLoading: boolean;
  onSend: (message: string) => void;
  onStop: () => void;
  onChange: (value: string) => void;
  onModelChange: (modelId: string) => void;
}

export function ChatInput({
  inputValue,
  selectedModel,
  models,
  isLoading,
  onSend,
  onStop,
  onChange,
  onModelChange,
}: ChatInputProps) {
  const chatSenderRef = useRef<any>(null);

  // 监听预填事件（从 NewChatView 快捷建议触发）
  useEffect(() => {
    const handlePrefill = (e: Event) => {
      const text = (e as CustomEvent<string>).detail;
      if (text) {
        onChange(text);
      }
    };
    window.addEventListener('prefillInput', handlePrefill);
    return () => window.removeEventListener('prefillInput', handlePrefill);
  }, [onChange]);

  const handleSend = useCallback((e: any) => {
    const content = e?.detail?.message || e?.detail || e?.message || inputValue;
    if (content && typeof content === 'string' && content.trim() && selectedModel) {
      onSend(content.trim());
    } else if (inputValue.trim() && selectedModel) {
      onSend(inputValue.trim());
    }
  }, [inputValue, selectedModel, onSend]);

  const handleChange = useCallback((e: any) => {
    const value = e?.detail ?? e ?? '';
    onChange(typeof value === 'string' ? value : '');
  }, [onChange]);

  const getPlaceholder = () => {
    if (!selectedModel) return '请先选择模型...';
    if (isLoading) return '正在思考中...';
    return '输入英语问题，如：帮我讲讲 transport 的词根词源';
  };

  return (
    <div
      className="px-4 pb-6 pt-4"
      style={{ backgroundColor: 'var(--td-bg-color-page)' }}
    >
      <div className="max-w-3xl mx-auto">
        <ChatSender
          ref={chatSenderRef}
          value={inputValue}
          placeholder={getPlaceholder()}
          disabled={!selectedModel}
          loading={isLoading}
          autosize={{ minRows: 1, maxRows: 6 }}
          actions={['send']}
          onSend={handleSend}
          onStop={onStop}
          onChange={handleChange}
        >
          <div slot="footer-prefix" className="flex items-center gap-2">
            <Select
              value={selectedModel}
              onChange={(value) => onModelChange(value as string)}
              placeholder="选择模型"
              size="small"
              style={{ width: 160 }}
              filterable
              borderless
              suffixIcon={<ChevronDownIcon />}
            >
              {models.map(model => (
                <Select.Option key={model.modelId} value={model.modelId} label={model.name} />
              ))}
            </Select>
          </div>
        </ChatSender>
      </div>
    </div>
  );
}
