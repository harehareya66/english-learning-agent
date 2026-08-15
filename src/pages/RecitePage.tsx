import { useState, useEffect, useCallback, useRef } from 'react';
import { Button, Progress, MessagePlugin, Loading, Tag, Input } from 'tdesign-react';
import { SoundIcon } from 'tdesign-icons-react';
import { Volume2, Mic, Square } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { speak, recognizeSpeech, matchScore, isSpeechRecognitionSupported } from '../utils/speech';
import { VoiceRecorder } from '../utils/recorder';
import { recordRecite, getGoal } from '../utils/daily';

interface ReciteItem {
  id: string;
  word: string;
  phonetic?: string | null;
  meaning: string;
  level?: number;
  root?: string | null;
  root_meaning?: string | null;
  etymology?: string | null;
  scene_tag?: string | null;
  scene_example?: string | null;
  isNew?: boolean;
  qtype: QType;
  options?: string[];
  meanings?: string[];   // 听音选词：选项对应的中文释义
  answerIndex?: number;
}

type QType = 'meaning' | 'spell' | 'listen' | 'pronounce';

interface WordRef {
  id: string;
  word: string;
  meaning: string;
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// 剥离词性前缀："v. 运输，运送" → "运输，运送"（新旧数据词性标注不统一，展示时统一去掉）
function stripPos(s: string): string {
  return s.replace(/^[a-z]+\.\s*/, '').trim();
}

// 题型分配：新词先「认识」（选义/听音），复习词才考验「拼写/发音」（按难度渐进）
function pickQType(isNew: boolean): QType {
  if (isNew) {
    return Math.random() < 0.65 ? 'meaning' : 'listen';
  }
  const r = Math.random();
  if (r < 0.3) return 'meaning';
  if (r < 0.55) return 'spell';
  if (r < 0.75) return 'listen';
  return 'pronounce';
}

function buildOptions(current: { word: string; meaning: string }, pool: WordRef[], qtype: 'meaning' | 'listen') {
  const others = shuffle(pool.filter(w => w.word !== current.word));
  if (qtype === 'listen') {
    // 听音选词：英文选项 + 中文释义副文本
    const distractors = others.slice(0, 3).map(w => ({ word: w.word, meaning: stripPos(w.meaning) }));
    const correct = { word: current.word, meaning: stripPos(current.meaning) };
    const all = shuffle([correct, ...distractors]);
    return {
      options: all.map(o => o.word),
      meanings: all.map(o => o.meaning),
      answerIndex: all.findIndex(o => o.word === current.word),
    };
  }
  // 看词选义：统一去词性的中文释义
  const distractors = others.slice(0, 3).map(w => stripPos(w.meaning));
  const correct = stripPos(current.meaning);
  const options = shuffle([correct, ...distractors]);
  return { options, answerIndex: options.indexOf(correct) };
}

function assignQuestion(item: Omit<ReciteItem, 'qtype'>, pool: WordRef[]): ReciteItem {
  const qtype = pickQType(item.isNew === true);
  if (qtype === 'meaning' || qtype === 'listen') {
    const { options, meanings, answerIndex } = buildOptions(item, pool, qtype);
    return { ...item, qtype, options, meanings, answerIndex };
  }
  return { ...item, qtype };
}

const QTYPE_LABEL: Record<QType, string> = {
  meaning: '看词选义',
  spell: '拼写',
  listen: '听音选词',
  pronounce: '发音评测',
};

export function RecitePage() {
  const navigate = useNavigate();
  const [queue, setQueue] = useState<ReciteItem[]>([]);
  const [total, setTotal] = useState(0);
  const [done, setDone] = useState(0);
  const [loading, setLoading] = useState(true);
  const [recording, setRecording] = useState(false);

  // 答题状态
  const [selected, setSelected] = useState<number | null>(null);
  const [wrong, setWrong] = useState(false);
  const [spellInput, setSpellInput] = useState('');
  const [spellChecked, setSpellChecked] = useState<boolean | null>(null);
  const [pronouncing, setPronouncing] = useState(false);
  const [pronounceScore, setPronounceScore] = useState<number | null>(null);

  const recorderRef = useRef<VoiceRecorder | null>(null);
  if (!recorderRef.current) recorderRef.current = new VoiceRecorder();
  const recorder = recorderRef.current;

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      fetch('/api/recite/queue?goal=' + getGoal()).then(r => r.json()),
      fetch('/api/words/list').then(r => r.json()),
    ])
      .then(([q, w]) => {
        const due: Omit<ReciteItem, 'qtype'>[] = (q.due || []).map((x: any) => ({ ...x, isNew: false }));
        const news: Omit<ReciteItem, 'qtype'>[] = (q.newWords || []).map((x: any) => ({ ...x, isNew: true }));
        const all = [...due, ...news];
        const pool: WordRef[] = (w.groups || []).flatMap((g: any) => g.words.map((x: any) => ({ id: x.id, word: x.word, meaning: x.meaning })));
        const withQ = all.map(item => assignQuestion(item, pool));
        setQueue(withQ);
        setTotal(withQ.length);
        resetAnswerState();
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const resetAnswerState = () => {
    setSelected(null);
    setWrong(false);
    setSpellInput('');
    setSpellChecked(null);
    setPronounceScore(null);
    setPronouncing(false);
  };

  const current = queue[0];

  const advance = (result: 'remember' | 'fuzzy' | 'forget') => {
    if (!current || recording) return;
    setRecording(true);
    fetch('/api/review/record', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'word', id: current.id, result }),
    })
      .then(r => r.json())
      .then(d => {
        if (d.success) {
          recordRecite();
          setDone(x => x + 1);
          resetAnswerState();
          setQueue(prev => prev.slice(1));
        } else {
          MessagePlugin.error(d.error || '记录失败');
        }
      })
      .catch(() => MessagePlugin.error('网络错误，请重试'))
      .finally(() => setRecording(false));
  };

  const answerChoice = (idx: number) => {
    if (wrong || recording) return;
    setSelected(idx);
    if (idx === current!.answerIndex) {
      advance('remember');
    } else {
      setWrong(true);
    }
  };

  const submitSpell = () => {
    if (wrong || recording) return;
    const ok = spellInput.trim().toLowerCase() === current!.word.toLowerCase();
    setSpellChecked(ok);
    if (ok) {
      advance('remember');
    } else {
      setWrong(true);
    }
  };

  const togglePronounce = async () => {
    if (!current || recording) return;
    if (pronouncing) {
      setPronouncing(false);
      try {
        const { url } = await recorder.stop();
        const audio = new Audio(url);
        audio.play().catch(() => {});
        if (isSpeechRecognitionSupported()) {
          const transcript = await recognizeSpeech('en-US');
          if (transcript) {
            const score = matchScore(current.word, transcript);
            setPronounceScore(score);
            if (score >= 60) {
              advance('remember');
            } else {
              setWrong(true);
            }
          } else {
            MessagePlugin.warning('未识别到语音，请对准麦克风再试');
            setPronounceScore(null);
          }
        }
      } catch {
        MessagePlugin.error('录音失败，请检查麦克风权限');
      }
    } else {
      if (!VoiceRecorder.isSupported()) {
        MessagePlugin.warning('当前浏览器不支持录音，请用 Chrome/Edge');
        return;
      }
      try {
        await recorder.start();
        setPronouncing(true);
        setPronounceScore(null);
      } catch {
        MessagePlugin.error('无法访问麦克风，请授权后重试');
      }
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loading size="medium" text="准备单词..." />
      </div>
    );
  }

  if (!current) {
    if (total === 0 && done === 0) {
      return (
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="text-center max-w-sm w-full py-12 rounded-xl" style={{ backgroundColor: 'var(--td-bg-color-container)' }}>
            <div className="text-4xl mb-3">📖</div>
            <div className="text-lg font-medium" style={{ color: 'var(--td-text-color-primary)' }}>
              今日没有待背的单词
            </div>
            <div className="text-sm mt-2" style={{ color: 'var(--td-text-color-secondary)' }}>
              所有单词都已学过且未到复习时间，可去「单词库」学习新词，或稍后再来复习
            </div>
            <Button className="mt-6" theme="primary" onClick={() => navigate('/words')}>
              去单词库学新词
            </Button>
          </div>
        </div>
      );
    }
    return (
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="text-center max-w-sm w-full py-12 rounded-xl" style={{ backgroundColor: 'var(--td-bg-color-container)' }}>
          <div className="text-4xl mb-3">🎉</div>
          <div className="text-lg font-medium" style={{ color: 'var(--td-text-color-primary)' }}>
            本次背了 {done} 个单词
          </div>
          <div className="text-sm mt-2" style={{ color: 'var(--td-text-color-secondary)' }}>
            继续保持，明天记得回来复习
          </div>
          <Button className="mt-6" theme="primary" onClick={load}>
            再来一组
          </Button>
        </div>
      </div>
    );
  }

  const progress = total > 0 ? Math.round((done / total) * 100) : 0;
  const isSpell = current.qtype === 'spell';

  const renderEtymology = () => (
    <div className="mt-4 space-y-2 text-left p-3 rounded-lg" style={{ backgroundColor: 'var(--td-bg-color-page)' }}>
      {current.etymology && (
        <div className="text-sm" style={{ color: 'var(--td-text-color-secondary)' }}>
          🔬 {current.etymology}
        </div>
      )}
      {current.root && (
        <div className="text-sm" style={{ color: 'var(--td-text-color-secondary)' }}>
          词根：{current.root}{current.root_meaning ? `（${current.root_meaning}）` : ''}
        </div>
      )}
      <div className="text-base font-medium" style={{ color: 'var(--td-brand-color)' }}>
        {stripPos(current.meaning)}
      </div>
      {current.scene_example && (
        <div className="text-sm italic" style={{ color: 'var(--td-text-color-secondary)' }}>
          "{current.scene_example}"
        </div>
      )}
    </div>
  );

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="max-w-xl mx-auto">
        {/* 进度 */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2 text-xs" style={{ color: 'var(--td-text-color-secondary)' }}>
            <span>第 {done + 1} / {total} 个 · {QTYPE_LABEL[current.qtype]}</span>
            <span>{current.isNew ? '新词' : '复习'}</span>
          </div>
          <Progress percentage={progress} theme="success" />
        </div>

        {/* 题目卡片 */}
        <div className="rounded-2xl p-8" style={{ backgroundColor: 'var(--td-bg-color-container)' }}>
          {/* 单词 + 发音（拼写题隐藏单词，避免泄露答案） */}
          {!isSpell && (
            <>
              <div className="flex items-center justify-center gap-3 mb-1">
                <span className="text-5xl font-bold" style={{ color: 'var(--td-text-color-primary)' }}>
                  {current.word}
                </span>
                <Button shape="circle" variant="text" icon={<SoundIcon />} onClick={() => speak(current.word)} />
              </div>
              {current.phonetic && (
                <div className="text-sm text-center" style={{ color: 'var(--td-text-color-placeholder)' }}>
                  {current.phonetic}
                </div>
              )}
            </>
          )}

          {/* 看词选义 */}
          {current.qtype === 'meaning' && (
            <div className="mt-6 space-y-3">
              <div className="text-sm text-center" style={{ color: 'var(--td-text-color-secondary)' }}>
                选择正确的中文释义
              </div>
              {current.options!.map((opt, i) => {
                const isCorrect = i === current.answerIndex;
                const isChosen = i === selected;
                let style: React.CSSProperties = { backgroundColor: 'var(--td-bg-color-component)' };
                let border = '1px solid var(--td-component-border)';
                if (wrong && isCorrect) {
                  style = { backgroundColor: 'var(--td-success-color-light, #e8f8f0)' };
                  border = '1px solid var(--td-success-color)';
                } else if (isChosen && !isCorrect) {
                  style = { backgroundColor: 'var(--td-error-color-light, #fdecee)' };
                  border = '1px solid var(--td-error-color)';
                }
                return (
                  <div
                    key={i}
                    className="px-4 py-3 rounded-lg cursor-pointer"
                    style={{ ...style, border }}
                    onClick={() => answerChoice(i)}
                  >
                    <span style={{ color: 'var(--td-text-color-primary)' }}>{opt}</span>
                    {wrong && isCorrect && <span className="ml-2 text-xs" style={{ color: 'var(--td-success-color)' }}>✓ 正确答案</span>}
                  </div>
                );
              })}
            </div>
          )}

          {/* 听音选词：选项带中文释义 */}
          {current.qtype === 'listen' && (
            <div className="mt-6 space-y-3">
              <div className="flex items-center justify-center gap-2">
                <Button variant="outline" icon={<Volume2 size={16} />} onClick={() => speak(current.word)}>
                  播放发音
                </Button>
              </div>
              <div className="text-xs text-center" style={{ color: 'var(--td-text-color-placeholder)' }}>
                听发音，选择正确的单词
              </div>
              {current.options!.map((opt, i) => {
                const isCorrect = i === current.answerIndex;
                const isChosen = i === selected;
                let style: React.CSSProperties = { backgroundColor: 'var(--td-bg-color-component)' };
                let border = '1px solid var(--td-component-border)';
                if (wrong && isCorrect) {
                  style = { backgroundColor: 'var(--td-success-color-light, #e8f8f0)' };
                  border = '1px solid var(--td-success-color)';
                } else if (isChosen && !isCorrect) {
                  style = { backgroundColor: 'var(--td-error-color-light, #fdecee)' };
                  border = '1px solid var(--td-error-color)';
                }
                return (
                  <div
                    key={i}
                    className="px-4 py-3 rounded-lg cursor-pointer"
                    style={{ ...style, border }}
                    onClick={() => answerChoice(i)}
                  >
                    <span className="font-medium" style={{ color: 'var(--td-text-color-primary)' }}>{opt}</span>
                    {current.meanings && (
                      <span className="ml-2 text-xs" style={{ color: 'var(--td-text-color-secondary)' }}>
                        {current.meanings[i]}
                      </span>
                    )}
                    {wrong && isCorrect && <span className="ml-2 text-xs" style={{ color: 'var(--td-success-color)' }}>✓ 正确答案</span>}
                  </div>
                );
              })}
            </div>
          )}

          {/* 拼写题：隐藏答案，给字母提示 */}
          {current.qtype === 'spell' && (
            <div className="mt-6 space-y-3">
              <div className="text-sm text-center" style={{ color: 'var(--td-text-color-secondary)' }}>
                根据释义拼写单词
              </div>
              <div className="flex items-center justify-center gap-2">
                <span className="text-base font-medium" style={{ color: 'var(--td-brand-color)' }}>{stripPos(current.meaning)}</span>
                <Button shape="circle" variant="text" size="small" icon={<Volume2 size={16} />} onClick={() => speak(current.word)} title="听发音提示" />
              </div>
              <div className="text-center">
                <span className="font-mono text-lg tracking-widest" style={{ color: 'var(--td-text-color-primary)' }}>
                  {current.word[0]}{'_'.repeat(Math.max(0, current.word.length - 1))}
                </span>
                <span className="ml-2 text-xs" style={{ color: 'var(--td-text-color-placeholder)' }}>
                  {current.word.length} 个字母
                </span>
              </div>
              <Input
                value={spellInput}
                onChange={(v) => setSpellInput(v as string)}
                placeholder="输入英文拼写"
                disabled={wrong}
                onEnter={submitSpell}
              />
              {!wrong && (
                <Button block theme="primary" onClick={submitSpell} loading={recording}>
                  提交
                </Button>
              )}
              {wrong && (
                <div className="text-center">
                  <span className="text-sm" style={{ color: 'var(--td-error-color)' }}>
                    你的答案：{spellInput || '（空）'}
                  </span>
                  <span className="ml-3 text-sm" style={{ color: 'var(--td-success-color)' }}>
                    ✓ 正确答案：{current.word}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* 发音评测 */}
          {current.qtype === 'pronounce' && (
            <div className="mt-6 space-y-3 text-center">
              <div className="text-sm" style={{ color: 'var(--td-text-color-secondary)' }}>
                跟读这个单词，系统会识别并评分
              </div>
              <Button
                theme={pronouncing ? 'danger' : 'primary'}
                variant={pronouncing ? 'base' : 'outline'}
                icon={pronouncing ? <Square size={16} /> : <Mic size={16} />}
                onClick={togglePronounce}
                loading={recording && !pronouncing}
              >
                {pronouncing ? '停止并评分' : '开始跟读'}
              </Button>
              {pronounceScore !== null && (
                <div className="text-sm" style={{ color: pronounceScore >= 60 ? 'var(--td-success-color)' : 'var(--td-error-color)' }}>
                  匹配度 {pronounceScore}%
                </div>
              )}
            </div>
          )}

          {/* 答错态：词根词源 + 模糊/不认识 */}
          {wrong && (
            <>
              {renderEtymology()}
              <div className="mt-4 space-y-2">
                <div className="text-xs text-center" style={{ color: 'var(--td-text-color-placeholder)' }}>
                  看完解释，如实选择你的掌握程度
                </div>
                <div className="flex gap-3">
                  <Button block theme="warning" loading={recording} onClick={() => advance('fuzzy')}>模糊</Button>
                  <Button block theme="danger" loading={recording} onClick={() => advance('forget')}>不认识</Button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
