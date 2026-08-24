export const PROGRESS_SCHEMA_VERSION = 1 as const;
export const EGG_COST = 100;
export const MAX_CHARACTER_LEVEL = 10;
export const MAX_LEVEL_REFUND = 40;

export function xpRequiredForLevel(level: number): number {
  return 30 + level * 20;
}

export function levelRewardMultiplier(level: number): number {
  return 1 + 0.1 * Math.max(0, level - 1);
}
