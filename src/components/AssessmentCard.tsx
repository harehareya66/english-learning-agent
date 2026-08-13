import { useState } from 'react';
import { Button, Radio, MessagePlugin, Progress } from 'tdesign-react';
import { AssessmentItem } from '../types';

interface AssessmentCardProps {
  questions: AssessmentItem[];
  sessionId?: string;
}

interface GradeResult {
  correct: number;
  total: number;
  wrongCount?: number;
  score: number;
  details: Array<{ id: number; correct: boolean; point: string; correctAnswer?: string }>;
}

// 测评卡片：展示题目 + 单选答题 + 提交判分
export function AssessmentCard({ questions, sessionId }: AssessmentCardProps) {
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [result, setResult] = useState<GradeResult | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    const answerList = Object.entries(answers).map(([id, answer]) => ({ id: Number(id), answer }));
    if (answerList.length < questions.length) {
      MessagePlugin.warning('请完成所有题目后再提交');
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch('/api/assessment/grade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, answers: answerList }),
      });
      const data = await res.json();
      if (data.error) {
        MessagePlugin.error(data.error);
        return;
      }
      setResult(data);
    } catch {
      MessagePlugin.error('判分失败，请重试');
    } finally {
      setSubmitting(false);
    }
  };

  if (result) {
    const pass = result.score >= 60;
    return (
      <div
        className="space-y-3 px-4 py-4 rounded-lg"
        style={{ backgroundColor: 'var(--td-bg-color-component)' }}
      >
        <div
          className="text-base font-medium"
          style={{ color: 'var(--td-text-color-primary)' }}
        >
          测评得分：{result.score} 分（{result.correct}/{result.total}）
        </div>
        <Progress
          percentage={result.score}
          theme={pass ? 'success' : 'warning'}
        />
        <div className="space-y-1">
          {result.details.map((d, i) => (
            <div
              key={d.id}
              className="text-sm"
              style={{ color: d.correct ? 'var(--td-success-color)' : 'var(--td-error-color)' }}
            >
              {d.correct ? '✓' : '✗'} 第{i + 1}题 · {d.point}
              {!d.correct && d.correctAnswer && (
                <span className="ml-2" style={{ color: 'var(--td-text-color-secondary)' }}>
                  正确答案：{d.correctAnswer}
                </span>
              )}
            </div>
          ))}
        </div>
        <div
          className="text-sm"
          style={{ color: 'var(--td-text-color-secondary)' }}
        >
          {result.wrongCount && result.wrongCount > 0
            ? `答错 ${result.wrongCount} 题已自动加入错题本，可去「复习」页巩固。`
            : '全部答对！可去「复习」页巩固记忆。'}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {questions.map(q => (
        <div
          key={q.id}
          className="px-4 py-3 rounded-lg"
          style={{
            backgroundColor: 'var(--td-bg-color-component)',
            border: '1px solid var(--td-component-border)',
          }}
        >
          <div
            className="font-medium mb-2"
            style={{ color: 'var(--td-text-color-primary)' }}
          >
            {q.id}. {q.question}
          </div>
          <Radio.Group
            value={answers[q.id]}
            onChange={v => setAnswers(prev => ({ ...prev, [q.id]: v as number }))}
          >
            {q.options.map((opt, idx) => (
              <Radio key={idx} value={idx}>
                {String.fromCharCode(65 + idx)}. {opt}
              </Radio>
            ))}
          </Radio.Group>
        </div>
      ))}
      <Button theme="primary" onClick={submit} loading={submitting}>
        提交答案
      </Button>
    </div>
  );
}
