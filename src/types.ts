/**
 * 类型定义
 */

export interface Model {
  modelId: string;
  name: string;
  description?: string;
}

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  model?: string;
  timestamp: Date;
  isStreaming?: boolean;
  kind?: 'review' | 'assessment';  // 交互卡片类型
  reviewItems?: ReviewItem[];      // 复习卡片数据
  assessmentQuestions?: AssessmentItem[];  // 测评卡片数据
  assessmentSessionId?: string;    // 测评会话 ID（判分用）
}

// 复习项（艾宾浩斯自评）：单词或错题
export type ReviewItem =
  | { type: 'word'; id: string; word: string; meaning: string; level: number }
  | { type: 'mistake'; id: string; question: string; answer: string | null; point: string | null };

// 测评题目
export interface AssessmentItem {
  id: number;
  question: string;
  options: string[];
  point: string;
}

export interface Session {
  id: string;
  title: string;
  model: string;
  agentId?: string;
  createdAt: Date;
  messages: Message[];
}

export interface CustomAgent {
  id: string;
  name: string;
  description?: string;
  systemPrompt: string;
  icon?: string;
  color?: string;
  createdAt: Date;
  updatedAt: Date;
}

// Agent 是 CustomAgent 的别名
export type Agent = CustomAgent;

export type Theme = 'light' | 'dark';
