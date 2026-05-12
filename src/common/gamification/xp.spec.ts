import { levelFromXp, levelUpResult, progressFromXp, xpForLevel } from './xp';

describe('xp curve', () => {
  it('xpForLevel produces the documented cumulative thresholds', () => {
    expect(xpForLevel(1)).toBe(0);
    expect(xpForLevel(2)).toBe(100);
    expect(xpForLevel(3)).toBe(400);
    expect(xpForLevel(4)).toBe(900);
    expect(xpForLevel(5)).toBe(1600);
    expect(xpForLevel(10)).toBe(8100);
  });

  it('levelFromXp is the inverse on threshold values', () => {
    expect(levelFromXp(0)).toBe(1);
    expect(levelFromXp(99)).toBe(1);
    expect(levelFromXp(100)).toBe(2);
    expect(levelFromXp(399)).toBe(2);
    expect(levelFromXp(400)).toBe(3);
    expect(levelFromXp(8100)).toBe(10);
  });

  it('progressFromXp reports level boundaries correctly', () => {
    const p = progressFromXp(250);
    expect(p.level).toBe(2);
    expect(p.xpForCurrentLevel).toBe(100);
    expect(p.xpForNextLevel).toBe(400);
    expect(p.xpIntoLevel).toBe(150);
    expect(p.xpToNextLevel).toBe(150);
    expect(p.progressRatio).toBeCloseTo(0.5, 5);
  });

  it('levelUpResult flags boundary crossings', () => {
    expect(levelUpResult(99, 1)).toEqual({
      leveledUp: true,
      previousLevel: 1,
      newLevel: 2,
    });
    expect(levelUpResult(100, 50)).toEqual({
      leveledUp: false,
      previousLevel: 2,
      newLevel: 2,
    });
  });
});
