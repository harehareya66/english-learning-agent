// 改良艾宾浩斯遗忘曲线算法（本地纯函数，0 token）
// 参考经典遗忘曲线 + 墨墨动态记忆算法：按用户自评动态调整复习间隔

// 复习间隔序列（天），随连续记住次数递增
export const REVIEW_INTERVALS_DAYS = [1, 2, 4, 7, 15, 30, 60];

// 复习自评结果
export type ReviewResult = 'remember' | 'fuzzy' | 'forget';

export interface ReviewOutcome {
  reviewCount: number;  // 连续记住次数（streak）
  lapseCount: number;   // 累计遗忘次数
  level: number;        // 掌握度 0-5
  intervalDays: number; // 本次计算的复习间隔（天）
  nextReviewAt: Date;   // 下次复习时间
}

const DAY_MS = 24 * 60 * 60 * 1000;

// 掌握度计算：由连续记住次数 - 遗忘次数得出，映射到 0-5
export function calcLevel(reviewCount: number, lapseCount: number): number {
  const score = reviewCount - lapseCount;
  if (score <= 0) return 0;
  if (score >= 10) return 5;
  if (score >= 7) return 4;
  if (score >= 5) return 3;
  if (score >= 3) return 2;
  return 1;
}

// 根据自评结果计算下次复习时间与掌握度
export function scheduleReview(
  reviewCount: number,
  lapseCount: number,
  result: ReviewResult,
  now: Date = new Date()
): ReviewOutcome {
  let rc = reviewCount;
  let lc = lapseCount;
  let idx: number;

  if (result === 'remember') {
    rc += 1;
    idx = Math.min(rc - 1, REVIEW_INTERVALS_DAYS.length - 1);
  } else if (result === 'fuzzy') {
    // 模糊：连续记住次数不变，间隔退一档
    idx = Math.max(0, rc - 2);
  } else {
    // 忘记：连续记住清零，遗忘+1，重置最短间隔
    rc = 0;
    lc += 1;
    idx = 0;
  }

  const intervalDays = REVIEW_INTERVALS_DAYS[idx];
  const nextReviewAt = new Date(now.getTime() + intervalDays * DAY_MS);
  const level = calcLevel(rc, lc);

  return { reviewCount: rc, lapseCount: lc, level, intervalDays, nextReviewAt };
}

// 新词首次加入：立即进入待复习队列
export function initialMemory(now: Date = new Date()) {
  return {
    level: 0,
    reviewCount: 0,
    lapseCount: 0,
    nextReviewAt: now,
  };
}

// 判断某个记忆条目今天是否到期（next_review_at <= now）
export function isDue(nextReviewAt: string | null | undefined, now: Date = new Date()): boolean {
  if (!nextReviewAt) return true;
  return new Date(nextReviewAt).getTime() <= now.getTime();
}
