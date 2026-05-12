/**
 * SideQuest XP curve.
 *
 *   xpForLevel(L) = 100 * (L - 1)^2     (cumulative XP needed to reach level L)
 *   levelFromXp(xp) = floor(sqrt(xp / 100)) + 1
 *
 * Sample table:
 *   Level 1  →    0 XP
 *   Level 2  →  100 XP
 *   Level 3  →  400 XP
 *   Level 4  →  900 XP
 *   Level 5  → 1600 XP
 *   Level 10 → 8100 XP
 *
 * This module is pure (no Nest, no Prisma) so it can be unit-tested and reused
 * by both the achievements engine and the API DTO formatters.
 */

export const MIN_LEVEL = 1;

export interface LevelProgress {
  level: number;
  currentXp: number;
  xpForCurrentLevel: number;
  xpForNextLevel: number;
  xpIntoLevel: number;
  xpToNextLevel: number;
  progressRatio: number;
}

export function xpForLevel(level: number): number {
  const clamped = Math.max(MIN_LEVEL, Math.floor(level));
  return 100 * (clamped - 1) ** 2;
}

export function levelFromXp(xp: number): number {
  if (xp <= 0) return MIN_LEVEL;
  return Math.floor(Math.sqrt(xp / 100)) + 1;
}

export function progressFromXp(xp: number): LevelProgress {
  const safeXp = Math.max(0, Math.floor(xp));
  const level = levelFromXp(safeXp);
  const xpForCurrentLevel = xpForLevel(level);
  const xpForNextLevel = xpForLevel(level + 1);

  const intoLevel = safeXp - xpForCurrentLevel;
  const span = Math.max(1, xpForNextLevel - xpForCurrentLevel);
  const toNext = Math.max(0, xpForNextLevel - safeXp);

  return {
    level,
    currentXp: safeXp,
    xpForCurrentLevel,
    xpForNextLevel,
    xpIntoLevel: intoLevel,
    xpToNextLevel: toNext,
    progressRatio: Math.min(1, intoLevel / span),
  };
}

/**
 * Returns the new level after a delta XP gain, or `null` when the user
 * has not crossed a level boundary.
 */
export function levelUpResult(
  previousXp: number,
  deltaXp: number,
): { leveledUp: boolean; previousLevel: number; newLevel: number } {
  const previousLevel = levelFromXp(previousXp);
  const newLevel = levelFromXp(previousXp + deltaXp);
  return {
    leveledUp: newLevel > previousLevel,
    previousLevel,
    newLevel,
  };
}
