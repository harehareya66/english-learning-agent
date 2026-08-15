// 每日背词目标与打卡（本地 localStorage 记录）
const DAILY_KEY = 'daily_recite_stats';
const GOAL_KEY = 'daily_goal';
export const DEFAULT_GOAL = 20;

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

// 读取用户配置的每日目标（默认 20）
export function getGoal(): number {
  if (typeof localStorage === 'undefined') return DEFAULT_GOAL;
  try {
    const g = parseInt(localStorage.getItem(GOAL_KEY) || '', 10);
    return Number.isFinite(g) && g > 0 ? g : DEFAULT_GOAL;
  } catch {
    return DEFAULT_GOAL;
  }
}

// 设置每日目标词数
export function setGoal(goal: number): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(GOAL_KEY, String(goal));
  } catch {
    // 忽略
  }
}

export function recordRecite(): void {
  if (typeof localStorage === 'undefined') return;
  try {
    const stats = JSON.parse(localStorage.getItem(DAILY_KEY) || '{}');
    const key = todayKey();
    stats[key] = (stats[key] || 0) + 1;
    localStorage.setItem(DAILY_KEY, JSON.stringify(stats));
  } catch {
    // 忽略
  }
}

export function getDailyStats(): { todayCount: number; streak: number; goal: number } {
  const goal = getGoal();
  if (typeof localStorage === 'undefined') return { todayCount: 0, streak: 0, goal };
  try {
    const stats = JSON.parse(localStorage.getItem(DAILY_KEY) || '{}');
    const todayCount = stats[todayKey()] || 0;

    // 连续达标天数（从昨天往前数，今天达标也计入）
    let streak = 0;
    const d = new Date();
    if (todayCount >= goal) {
      streak = 1;
      d.setDate(d.getDate() - 1);
    }
    while (true) {
      const key = d.toISOString().slice(0, 10);
      if ((stats[key] || 0) >= goal) {
        streak++;
        d.setDate(d.getDate() - 1);
      } else {
        break;
      }
    }
    return { todayCount, streak, goal };
  } catch {
    return { todayCount: 0, streak: 0, goal };
  }
}
