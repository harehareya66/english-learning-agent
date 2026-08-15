// 浏览器原生语音能力：TTS 朗读 + 语音识别 + 匹配度评分（免费，零后端）

export type Accent = 'en-US' | 'en-GB';

export interface SpeakOptions {
  accent?: Accent;
  rate?: number;
  onEnd?: () => void;
  onStart?: () => void;
}

// 朗读（支持口音 + 语速 + 完成回调）
export function speak(text: string, opts: SpeakOptions = {}): void {
  if (typeof window === 'undefined' || !window.speechSynthesis) return;
  try {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = opts.accent ?? 'en-US';
    utterance.rate = opts.rate ?? 0.9;
    if (opts.onStart) utterance.onstart = opts.onStart;
    if (opts.onEnd) utterance.onend = opts.onEnd;
    window.speechSynthesis.speak(utterance);
  } catch {
    // 忽略不支持的环境
  }
}

// 停止朗读
export function stopSpeaking(): void {
  if (typeof window === 'undefined' || !window.speechSynthesis) return;
  try {
    window.speechSynthesis.cancel();
  } catch {
    // 忽略
  }
}

// 是否支持语音识别（Web Speech API）
export function isSpeechRecognitionSupported(): boolean {
  if (typeof window === 'undefined') return false;
  const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
  return !!SR;
}

// 语音识别：识别一句话，返回文本（失败返回空串）
export function recognizeSpeech(lang: string = 'en-US', timeoutMs = 8000): Promise<string> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined') return resolve('');
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) return resolve('');

    const rec = new SR();
    rec.lang = lang;
    rec.interimResults = false;
    rec.maxAlternatives = 1;

    const timer = setTimeout(() => {
      try { rec.stop(); } catch { /* ignore */ }
    }, timeoutMs);

    rec.onresult = (e: any) => {
      clearTimeout(timer);
      const transcript = e.results?.[0]?.[0]?.transcript ?? '';
      resolve(String(transcript));
    };
    rec.onerror = () => {
      clearTimeout(timer);
      resolve('');
    };
    rec.onend = () => {
      clearTimeout(timer);
    };

    try {
      rec.start();
    } catch {
      clearTimeout(timer);
      resolve('');
    }
  });
}

// 归一化：小写 + 去标点 + 分词
function normalize(text: string): string[] {
  return text.toLowerCase().replace(/[^a-z0-9'\s]/g, ' ').split(/\s+/).filter(Boolean);
}

// 词级匹配度（0-100）：识别文本对原文的覆盖率
export function matchScore(target: string, spoken: string): number {
  const t = normalize(target);
  const s = normalize(spoken);
  if (t.length === 0) return spoken.trim() ? 100 : 0;
  const sSet = new Set(s);
  let hit = 0;
  for (const w of t) {
    if (sSet.has(w)) hit++;
  }
  return Math.round((hit / t.length) * 100);
}

// 根据分数给反馈文案
export function scoreFeedback(score: number): { label: string; tone: 'success' | 'warning' | 'danger' } {
  if (score >= 85) return { label: '很棒！发音接近标准', tone: 'success' };
  if (score >= 60) return { label: '不错，再练几遍会更准', tone: 'warning' };
  return { label: '继续加油，多听范读再跟读', tone: 'danger' };
}
