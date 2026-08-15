import { useEffect, useState, useRef } from 'react';
import { Loading, Tag, Button, Radio, MessagePlugin } from 'tdesign-react';
import { Volume2, Mic, Square } from 'lucide-react';
import { speak, recognizeSpeech, matchScore, scoreFeedback, isSpeechRecognitionSupported, Accent } from '../utils/speech';
import { VoiceRecorder, playAudio } from '../utils/recorder';

interface SceneSummary {
  tag: string;
  title: string;
}

interface SceneLine {
  role: 'A' | 'B';
  text: string;
  note?: string;
}

interface Scene {
  tag: string;
  title: string;
  intro: string;
  lines: SceneLine[];
}

interface ScoreResult {
  score: number;
  transcript: string;
  feedback: string;
  tone: 'success' | 'warning' | 'danger';
}

export function OralPage() {
  const [scenes, setScenes] = useState<SceneSummary[]>([]);
  const [scene, setScene] = useState<Scene | null>(null);
  const [loading, setLoading] = useState(true);
  const [revealed, setRevealed] = useState<Set<number>>(new Set());
  const [mode, setMode] = useState<'browse' | 'practice'>('browse');

  // 语音设置
  const [accent, setAccent] = useState<Accent>('en-US');
  const [slowRate, setSlowRate] = useState(false);
  const rate = slowRate ? 0.6 : 0.9;

  // 语音状态
  const [playingIdx, setPlayingIdx] = useState<number | null>(null);
  const [recordingIdx, setRecordingIdx] = useState<number | null>(null);
  const [scoreMap, setScoreMap] = useState<Map<number, ScoreResult>>(new Map());
  const recorderRef = useRef<VoiceRecorder | null>(null);
  if (!recorderRef.current) recorderRef.current = new VoiceRecorder();
  const recorder = recorderRef.current;

  const srSupported = isSpeechRecognitionSupported();

  useEffect(() => {
    fetch('/api/scenes')
      .then(r => r.json())
      .then(d => setScenes(d.scenes || []))
      .finally(() => setLoading(false));
  }, []);

  const selectScene = (tag: string) => {
    setScene(null);
    setRevealed(new Set());
    setScoreMap(new Map());
    setPlayingIdx(null);
    setRecordingIdx(null);
    fetch(`/api/scenes/${encodeURIComponent(tag)}`)
      .then(r => r.json())
      .then(d => setScene(d.scene || null));
  };

  const toggleReveal = (idx: number) => {
    setRevealed(prev => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  const doSpeak = (idx: number, text: string) => {
    setPlayingIdx(idx);
    speak(text, {
      accent,
      rate,
      onStart: () => setPlayingIdx(idx),
      onEnd: () => setPlayingIdx(null),
    });
  };

  const toggleRecord = async (idx: number, text: string) => {
    if (recordingIdx === idx) {
      // 停止录音 → 回放 + 识别评分
      setRecordingIdx(null);
      try {
        const { url } = await recorder.stop();
        playAudio(url);
        // 语音识别评分
        if (srSupported) {
          const transcript = await recognizeSpeech(accent);
          if (transcript) {
            const score = matchScore(text, transcript);
            const fb = scoreFeedback(score);
            setScoreMap(prev => new Map(prev).set(idx, { score, transcript, feedback: fb.label, tone: fb.tone }));
          } else {
            MessagePlugin.warning('未识别到语音，请对准麦克风再试');
          }
        }
      } catch {
        MessagePlugin.error('录音失败，请检查麦克风权限');
      }
    } else {
      // 开始录音
      if (!VoiceRecorder.isSupported()) {
        MessagePlugin.warning('当前浏览器不支持录音，请用 Chrome/Edge');
        return;
      }
      try {
        await recorder.start();
        setRecordingIdx(idx);
        setScoreMap(prev => {
          const next = new Map(prev);
          next.delete(idx);
          return next;
        });
      } catch {
        MessagePlugin.error('无法访问麦克风，请授权后重试');
      }
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loading size="medium" text="加载场景..." />
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="max-w-2xl mx-auto space-y-5">
        {/* 场景选择 */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm" style={{ color: 'var(--td-text-color-secondary)' }}>
              选择一个场景，进行角色扮演口语练习
            </p>
            <Radio.Group
              value={mode}
              variant="default-filled"
              size="small"
              onChange={(v) => { setMode(v as 'browse' | 'practice'); setRevealed(new Set()); setRecordingIdx(null); setScoreMap(new Map()); }}
            >
              <Radio.Button value="browse">浏览</Radio.Button>
              <Radio.Button value="practice">跟读</Radio.Button>
            </Radio.Group>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {scenes.map(s => (
              <div
                key={s.tag}
                className="px-4 py-3 rounded-lg cursor-pointer transition-colors"
                style={{
                  backgroundColor: scene?.tag === s.tag ? 'var(--td-brand-color-light)' : 'var(--td-bg-color-container)',
                  border: `1px solid ${scene?.tag === s.tag ? 'var(--td-brand-color)' : 'var(--td-component-border)'}`
                }}
                onClick={() => selectScene(s.tag)}
              >
                <div className="font-medium" style={{ color: 'var(--td-text-color-primary)' }}>
                  {s.title}
                </div>
                <div className="text-xs mt-1" style={{ color: 'var(--td-text-color-secondary)' }}>
                  {s.tag}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 语音设置：口音 + 语速 */}
        <div
          className="px-4 py-3 rounded-xl flex flex-wrap items-center gap-4"
          style={{ backgroundColor: 'var(--td-bg-color-container)' }}
        >
          <div className="flex items-center gap-2">
            <span className="text-xs" style={{ color: 'var(--td-text-color-secondary)' }}>口音</span>
            <Radio.Group value={accent} variant="default-filled" size="small" onChange={(v) => setAccent(v as Accent)}>
              <Radio.Button value="en-US">美式</Radio.Button>
              <Radio.Button value="en-GB">英式</Radio.Button>
            </Radio.Group>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs" style={{ color: 'var(--td-text-color-secondary)' }}>语速</span>
            <Radio.Group value={slowRate ? 'slow' : 'normal'} variant="default-filled" size="small" onChange={(v) => setSlowRate(v === 'slow')}>
              <Radio.Button value="normal">正常</Radio.Button>
              <Radio.Button value="slow">慢速</Radio.Button>
            </Radio.Group>
          </div>
          {!srSupported && mode === 'practice' && (
            <span className="text-xs" style={{ color: 'var(--td-text-color-placeholder)' }}>
              （当前浏览器不支持语音评分，可正常录音回放）
            </span>
          )}
        </div>

        {/* 对话展示 */}
        {scene ? (
          <div
            className="rounded-xl p-5 space-y-4"
            style={{ backgroundColor: 'var(--td-bg-color-container)' }}
          >
            <div>
              <div className="font-medium" style={{ color: 'var(--td-text-color-primary)' }}>
                {scene.title}
              </div>
              <div className="text-xs mt-1" style={{ color: 'var(--td-text-color-secondary)' }}>
                {scene.intro}
              </div>
            </div>

            <div className="space-y-3">
              {scene.lines.map((l, i) => {
                const score = scoreMap.get(i);
                const isPlaying = playingIdx === i;
                const isRecording = recordingIdx === i;
                return (
                  <div key={i}>
                    <div className={`flex ${l.role === 'B' ? 'justify-end' : 'justify-start'}`}>
                      <div className="flex items-center gap-2 max-w-[85%]">
                        {/* 操作按钮（对方台词放左侧，自己的放右侧） */}
                        {l.role === 'A' && (
                          <div className="flex flex-col gap-1 shrink-0">
                            <Button
                              shape="circle"
                              size="small"
                              variant="outline"
                              icon={<Volume2 size={16} />}
                              loading={isPlaying}
                              onClick={() => doSpeak(i, l.text)}
                            />
                            {mode === 'practice' && (
                              <Button
                                shape="circle"
                                size="small"
                                variant={isRecording ? 'base' : 'outline'}
                                theme={isRecording ? 'danger' : 'default'}
                                icon={isRecording ? <Square size={16} /> : <Mic size={16} />}
                                onClick={() => toggleRecord(i, l.text)}
                              />
                            )}
                          </div>
                        )}

                        <div
                          className="px-4 py-3 rounded-xl cursor-pointer"
                          style={{
                            backgroundColor: l.role === 'B' ? 'var(--td-brand-color)' : 'var(--td-bg-color-component)',
                            color: l.role === 'B' ? 'white' : 'var(--td-text-color-primary)',
                            borderRadius: l.role === 'B' ? '16px 16px 4px 16px' : '16px 16px 16px 4px'
                          }}
                          onClick={() => toggleReveal(i)}
                          title={mode === 'browse' ? '点击查看 / 隐藏中文释义' : '开口说出英文，点击对照'}
                        >
                          {mode === 'browse' ? (
                            <>
                              <div className="text-sm leading-relaxed">{l.text}</div>
                              {l.note && (
                                <div
                                  className="text-xs mt-1"
                                  style={{ color: l.role === 'B' ? 'rgba(255,255,255,0.7)' : 'var(--td-text-color-placeholder)' }}
                                >
                                  {revealed.has(i) ? l.note : '点击查看释义'}
                                </div>
                              )}
                            </>
                          ) : (
                            <>
                              <div className="text-sm leading-relaxed">{l.note || l.text}</div>
                              <div
                                className="text-xs mt-1"
                                style={{ color: l.role === 'B' ? 'rgba(255,255,255,0.7)' : 'var(--td-text-color-placeholder)' }}
                              >
                                {revealed.has(i) ? l.text : '开口说出英文，点击对照'}
                              </div>
                            </>
                          )}
                        </div>

                        {l.role === 'B' && (
                          <div className="flex flex-col gap-1 shrink-0">
                            <Button
                              shape="circle"
                              size="small"
                              variant="outline"
                              icon={<Volume2 size={16} />}
                              loading={isPlaying}
                              onClick={() => doSpeak(i, l.text)}
                            />
                            {mode === 'practice' && (
                              <Button
                                shape="circle"
                                size="small"
                                variant={isRecording ? 'base' : 'outline'}
                                theme={isRecording ? 'danger' : 'default'}
                                icon={isRecording ? <Square size={16} /> : <Mic size={16} />}
                                onClick={() => toggleRecord(i, l.text)}
                              />
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* 识别评分结果 */}
                    {score && (
                      <div className={`flex ${l.role === 'B' ? 'justify-end' : 'justify-start'} mt-1`}>
                        <div
                          className="flex items-center gap-2 px-3 py-2 rounded-lg"
                          style={{ backgroundColor: 'var(--td-bg-color-component)' }}
                        >
                          <Tag size="small" theme={score.tone} variant="light">
                            匹配度 {score.score}%
                          </Tag>
                          <span className="text-xs" style={{ color: 'var(--td-text-color-secondary)' }}>
                            {score.feedback}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="text-sm" style={{ color: 'var(--td-text-color-secondary)' }}>
              {mode === 'practice'
                ? '🎤 先点 🔊 听范读，再点 🎤 录音跟读，松手后自动评分。'
                : '💬 试着扮演角色 B 朗读台词，或到「AI 对话」里进行自由口语练习。'}
            </div>
          </div>
        ) : (
          <div
            className="text-center py-12 rounded-xl"
            style={{ backgroundColor: 'var(--td-bg-color-container)' }}
          >
            <div className="text-sm" style={{ color: 'var(--td-text-color-placeholder)' }}>
              点击上方场景开始练习
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
