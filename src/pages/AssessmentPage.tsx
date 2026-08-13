import { useEffect, useState } from 'react';
import { Loading, Button } from 'tdesign-react';
import { RefreshIcon } from 'tdesign-icons-react';
import { AssessmentCard } from '../components/AssessmentCard';
import { AssessmentItem } from '../types';

export function AssessmentPage() {
  const [questions, setQuestions] = useState<AssessmentItem[] | null>(null);
  const [sessionId, setSessionId] = useState<string>('');
  const [round, setRound] = useState(0);

  const load = () => {
    setQuestions(null);
    fetch('/api/assessment/questions')
      .then(r => r.json())
      .then(d => {
        setSessionId(d.sessionId || '');
        setQuestions(d.questions || []);
      });
  };

  useEffect(() => {
    load();
  }, []);

  const retry = () => {
    setRound(r => r + 1);
    load();
  };

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm" style={{ color: 'var(--td-text-color-secondary)' }}>
            词根词源能力测评，答错的题会自动进入错题本
          </p>
          <Button size="small" variant="text" icon={<RefreshIcon />} onClick={retry}>
            重新开始
          </Button>
        </div>

        {questions === null ? (
          <div className="flex items-center justify-center py-20">
            <Loading size="medium" text="加载题目..." />
          </div>
        ) : (
          <AssessmentCard key={round} questions={questions} sessionId={sessionId} />
        )}
      </div>
    </div>
  );
}
