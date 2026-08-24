import { EGG_COST, MAX_CHARACTER_LEVEL, MAX_LEVEL_REFUND } from './balance';
import { eggCharacterIds } from './catalog';
import { replaceRosterEntry } from './progress';
import type { AccountProgress, CharacterId, EggPurchaseResult } from './types';

function characterForRoll(roll: number): CharacterId {
  const safeRoll = Math.min(Math.max(roll, 0), 0.999999999);
  const index = Math.floor(safeRoll * eggCharacterIds.length);
  return eggCharacterIds[index] ?? 'udon';
}

export function buyEgg(progress: AccountProgress, roll: () => number): EggPurchaseResult {
  if (progress.stardust < EGG_COST) {
    throw new Error('Not enough stardust');
  }

  const characterId = characterForRoll(roll());
  const current = progress.roster[characterId];
  const paid = { ...progress, stardust: progress.stardust - EGG_COST };

  if (!current.owned) {
    return {
      progress: replaceRosterEntry(paid, characterId, { owned: true, level: 1 }),
      characterId,
      outcome: 'NEW',
    };
  }

  if (current.level < MAX_CHARACTER_LEVEL) {
    return {
      progress: replaceRosterEntry(paid, characterId, { owned: true, level: current.level + 1 }),
      characterId,
      outcome: 'LEVEL_UP',
    };
  }

  return {
    progress: { ...paid, stardust: paid.stardust + MAX_LEVEL_REFUND },
    characterId,
    outcome: 'MAX_LEVEL_REFUND',
  };
}
