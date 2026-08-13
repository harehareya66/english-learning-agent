// 浏览器原生 TTS 发音（免费，无需后端）
export function speak(text: string): void {
  if (typeof window === 'undefined' || !window.speechSynthesis) return;
  try {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'en-US';
    utterance.rate = 0.9;
    window.speechSynthesis.speak(utterance);
  } catch {
    // 忽略不支持的环境
  }
}
