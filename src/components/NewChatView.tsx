import { APP_CONFIG } from '../config';
import { GraduationCap, ArrowRight } from 'lucide-react';

const SUGGESTIONS = [
  '帮我讲解一下 transport 这个词的词根词源',
  '用英语和我聊聊今天的天气',
  '写一段商务邮件的常用英语表达',
  '我该怎么用英语表达「请假」？',
];

// AI 对话欢迎页：自由问答入口，本地功能引导到侧边栏
export function NewChatView() {
  return (
    <div className="flex flex-col items-center justify-center h-full overflow-y-auto py-8">
      <div className="w-full max-w-2xl px-4">
        {/* 标题 */}
        <div className="text-center mb-8">
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4 mx-auto"
            style={{ background: 'linear-gradient(135deg, #3b82f6, #60a5fa)' }}
          >
            <GraduationCap size={32} color="white" />
          </div>
          <h1
            className="text-2xl font-bold mb-2"
            style={{ color: 'var(--td-text-color-primary)' }}
          >
            {APP_CONFIG.name}
          </h1>
          <p className="text-sm" style={{ color: 'var(--td-text-color-secondary)' }}>
            AI 英语学习对话 · 自由提问、语法纠错、个性化讲解
          </p>
        </div>

        {/* 快捷问题 */}
        <div className="space-y-2">
          {SUGGESTIONS.map((s, idx) => (
            <div
              key={idx}
              className="flex items-center gap-2 px-4 py-3 rounded-lg cursor-pointer transition-all hover:translate-x-1"
              style={{
                backgroundColor: 'var(--td-bg-color-component)',
                border: '1px solid var(--td-component-border)',
              }}
              onClick={() => {
                window.dispatchEvent(new CustomEvent('prefillInput', { detail: s }));
              }}
            >
              <ArrowRight size={14} style={{ color: 'var(--td-brand-color)' }} />
              <span className="text-sm" style={{ color: 'var(--td-text-color-secondary)' }}>
                {s}
              </span>
            </div>
          ))}
        </div>

        {/* 引导去本地功能 */}
        <div className="mt-8 text-center text-xs space-y-1" style={{ color: 'var(--td-text-color-placeholder)' }}>
          <p>想学新词？试试左侧「单词库」，词根词源本地秒查</p>
          <p>需要巩固记忆？去「复习」；检验水平？去「测评」</p>
        </div>
      </div>
    </div>
  );
}
