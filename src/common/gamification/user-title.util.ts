const TITLES = [
  'Curious Newcomer',
  'Cobblestone Walker',
  'Cobblestone Wanderer',
  'Street Sage',
  'Prague Pathfinder',
  'City Legend',
] as const;

function levelBracketIndex(level: number): number {
  const l = level < 1 ? 1 : level;
  if (l <= 4) return 0;
  if (l <= 9) return 1;
  if (l <= 14) return 2;
  if (l <= 19) return 3;
  if (l <= 29) return 4;
  return 5;
}

function questBracketIndex(questsDone: number): number {
  const q = questsDone < 0 ? 0 : questsDone;
  if (q <= 2) return 0;
  if (q <= 9) return 1;
  if (q <= 19) return 2;
  if (q <= 39) return 3;
  if (q <= 79) return 4;
  return 5;
}

export function deriveUserTitleFromLevel(level: number, questsDone: number): string {
  const idx = Math.min(levelBracketIndex(level), questBracketIndex(questsDone));
  return TITLES[idx];
}

export interface PublicUserTitleInput {
  titleOverride?: string | null;
  level: number;
  questsDone: number;
}

export function resolvePublicUserTitle(user: PublicUserTitleInput): string {
  const raw = user.titleOverride;
  if (typeof raw === 'string' && raw.trim() !== '') {
    return raw.trim();
  }
  return deriveUserTitleFromLevel(user.level, user.questsDone);
}
