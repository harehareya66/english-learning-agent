// 每日背词目标与打卡（本地 localStorage 记录）
const DAILY_KEY = 'daily_recite_stats';
const GOAL = 20;

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
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
  if (typeof localStorage === 'undefined') return { todayCount: 0, streak: 0, goal: GOAL };
  try {
    const stats = JSON.parse(localStorage.getItem(DAILY_KEY) || '{}');
    const todayCount = stats[todayKey()] || 0;

    // 连续达标天数（从昨天往前数，今天达标也计入）
    let streak = 0;
    const d = new Date();
    if (todayCount >= GOAL) {
      streak = 1;
      d.setDate(d.getDate() - 1);
    }
    while (true) {
      const key = d.toISOString().slice(0, 10);
      if ((stats[key] || 0) >= GOAL) {
        streak++;
        d.setDate(d.getDate() - 1);
      } else {
        break;
      }
    }
    return { todayCount, streak, goal: GOAL };
  } catch {
    return { todayCount: 0, streak: 0, goal: GOAL };
  }
}
