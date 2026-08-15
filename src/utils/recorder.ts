// 浏览器原生录音（MediaRecorder），免费零后端

export class VoiceRecorder {
  private recorder: MediaRecorder | null = null;
  private chunks: Blob[] = [];
  private stream: MediaStream | null = null;

  static isSupported(): boolean {
    return typeof navigator !== 'undefined' && !!(navigator.mediaDevices?.getUserMedia) && typeof MediaRecorder !== 'undefined';
  }

  async start(): Promise<void> {
    this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    this.chunks = [];
    this.recorder = new MediaRecorder(this.stream);
    this.recorder.ondataavailable = (e) => {
      if (e.data.size > 0) this.chunks.push(e.data);
    };
    this.recorder.start();
  }

  // 停止录音，返回可回放的 blob URL
  stop(): Promise<{ url: string; blob: Blob }> {
    return new Promise((resolve) => {
      if (!this.recorder) return resolve({ url: '', blob: new Blob() });
      this.recorder.onstop = () => {
        const blob = new Blob(this.chunks, { type: this.recorder?.mimeType || 'audio/webm' });
        const url = URL.createObjectURL(blob);
        this.cleanup();
        resolve({ url, blob });
      };
      this.recorder.stop();
    });
  }

  cancel(): void {
    if (this.recorder && this.recorder.state !== 'inactive') {
      this.recorder.stop();
    }
    this.cleanup();
  }

  private cleanup(): void {
    this.stream?.getTracks().forEach(t => t.stop());
    this.stream = null;
    this.recorder = null;
  }
}

// 回放一段音频 URL
export function playAudio(url: string, onEnd?: () => void): void {
  if (!url) return;
  const audio = new Audio(url);
  if (onEnd) audio.onended = onEnd;
  audio.play().catch(() => { /* 忽略自动播放限制 */ });
}
