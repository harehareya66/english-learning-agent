// deepseek 直连模块（OpenAI 兼容协议）
// 统一模型：deepseek-v4-flash；用户 API Key 存 SQLite（api_config），前端可导入

import { getApiConfig } from './db.js';

const DEFAULT_BASE_URL = 'https://api.deepseek.com';
const DEFAULT_MODEL = 'deepseek-v4-flash';

export interface AiConfig {
  apiKey: string;
  baseUrl: string;
  model: string;
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

// 读取 AI 配置：优先用户设置页保存的 key，回退到环境变量
export function getAiConfig(): AiConfig {
  const apiKey = getApiConfig('deepseek_api_key') || process.env.DEEPSEEK_API_KEY || '';
  const baseUrl = getApiConfig('deepseek_base_url') || process.env.DEEPSEEK_BASE_URL || DEFAULT_BASE_URL;
  const model = getApiConfig('deepseek_model') || process.env.DEEPSEEK_MODEL || DEFAULT_MODEL;
  return { apiKey, baseUrl, model };
}

export function hasApiKey(): boolean {
  return !!getAiConfig().apiKey;
}

// 测试 API key 是否有效（最小非流式请求）
export async function testApiKey(apiKey: string, baseUrl?: string): Promise<{ ok: boolean; message: string }> {
  const url = `${baseUrl || DEFAULT_BASE_URL}/chat/completions`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ model: DEFAULT_MODEL, messages: [{ role: 'user', content: 'hi' }], max_tokens: 1 }),
      signal: controller.signal,
    });
    if (res.ok) return { ok: true, message: '连接成功' };
    const text = await res.text();
    return { ok: false, message: `HTTP ${res.status}: ${text.slice(0, 200)}` };
  } catch (e: any) {
    return { ok: false, message: e?.message || String(e) };
  } finally {
    clearTimeout(timeout);
  }
}

// 流式对话：逐 delta 回调，返回完整文本
export async function streamChat(
  messages: ChatMessage[],
  onDelta: (text: string) => void,
  opts?: { apiKey?: string; baseUrl?: string; model?: string }
): Promise<string> {
  const cfg = getAiConfig();
  const apiKey = opts?.apiKey || cfg.apiKey;
  const baseUrl = opts?.baseUrl || cfg.baseUrl;
  const model = opts?.model || cfg.model;

  if (!apiKey) throw new Error('NO_API_KEY');

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 90000);

  try {
    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ model, messages, stream: true, temperature: 0.7 }),
      signal: controller.signal,
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`DeepSeek HTTP ${res.status}: ${text.slice(0, 200)}`);
    }

    const reader = res.body?.getReader();
    if (!reader) throw new Error('NO_STREAM');

    const decoder = new TextDecoder();
    let buffer = '';
    let full = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith('data:')) continue;
        const payload = trimmed.slice(5).trim();
        if (payload === '[DONE]') continue;
        try {
          const json = JSON.parse(payload);
          const delta = json.choices?.[0]?.delta?.content;
          if (delta) {
            full += delta;
            onDelta(delta);
          }
        } catch {
          // 忽略非 JSON 行
        }
      }
    }
    return full;
  } finally {
    clearTimeout(timeout);
  }
}
