import { levelRewardMultiplier } from './balance';
import { grantRawReward } from './progress';
import type { AccountProgress, CharacterId, RawReward, SettledReward } from './types';

export function settleReward(
  progress: AccountProgress,
  characterId: CharacterId,
  rawReward: RawReward,
  explicitLevel?: number,
): SettledReward {
  const level = explicitLevel ?? progress.roster[characterId].level;
  const reward = {
    xp: Math.max(0, Math.floor(rawReward.xp)),
    stardust: Math.max(0, Math.floor(rawReward.stardust * levelRewardMultiplier(level))),
  };

  return { ...reward, progress: grantRawReward(progress, reward) };
}
