import { useState } from 'react';
import { Dialog, Radio } from 'tdesign-react';
import { getGoal, setGoal } from '../utils/daily';

interface GoalSettingDialogProps {
  visible: boolean;
  onClose: () => void;
  onSaved: () => void;
}

const GOAL_OPTIONS = [10, 20, 30, 50, 100];

export function GoalSettingDialog({ visible, onClose, onSaved }: GoalSettingDialogProps) {
  const [value, setValue] = useState<number>(getGoal());

  const save = () => {
    setGoal(value);
    onSaved();
    onClose();
  };

  return (
    <Dialog
      visible={visible}
      header="每日背词目标"
      onClose={onClose}
      onConfirm={save}
      confirmBtn="保存"
      cancelBtn="取消"
      width={360}
    >
      <div className="py-2">
        <div className="text-sm mb-3" style={{ color: 'var(--td-text-color-secondary)' }}>
          每天背多少个新词？打卡进度将按此目标计算。
        </div>
        <Radio.Group value={value} onChange={(v) => setValue(v as number)}>
          {GOAL_OPTIONS.map(o => (
            <Radio.Button key={o} value={o}>{o} 词</Radio.Button>
          ))}
        </Radio.Group>
      </div>
    </Dialog>
  );
}
