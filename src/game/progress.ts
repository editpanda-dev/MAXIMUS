import { PROGRESS_SCHEMA_VERSION, xpRequiredForLevel } from './balance';
import type { AccountProgress, CharacterId, RawReward, RosterEntry } from './types';

function unowned(): RosterEntry {
  return { owned: false, level: 0 };
}

function calculateLevel(totalXp: number): Readonly<{ level: number; xpIntoLevel: number }> {
  let remaining = Math.max(0, Math.floor(totalXp));
  let level = 1;

  while (remaining >= xpRequiredForLevel(level)) {
    remaining -= xpRequiredForLevel(level);
    level += 1;
  }

  return { level, xpIntoLevel: remaining };
}

export function createInitialProgress(): AccountProgress {
  return {
    schemaVersion: PROGRESS_SCHEMA_VERSION,
    xp: 0,
    level: 1,
    xpIntoLevel: 0,
    stardust: 0,
    selectedCharacterId: 'base',
    roster: {
      base: { owned: true, level: 1 },
      pogo: unowned(),
      udon: unowned(),
    },
  };
}

export function grantRawReward(progress: AccountProgress, reward: RawReward): AccountProgress {
  const xp = progress.xp + Math.max(0, Math.floor(reward.xp));
  const levelState = calculateLevel(xp);

  return {
    ...progress,
    xp,
    level: levelState.level,
    xpIntoLevel: levelState.xpIntoLevel,
    stardust: progress.stardust + Math.max(0, Math.floor(reward.stardust)),
  };
}

export function selectCharacter(progress: AccountProgress, characterId: CharacterId): AccountProgress {
  if (!progress.roster[characterId].owned) {
    throw new Error('Character is not owned');
  }

  return { ...progress, selectedCharacterId: characterId };
}

export function replaceRosterEntry(
  progress: AccountProgress,
  characterId: CharacterId,
  entry: RosterEntry,
): AccountProgress {
  return {
    ...progress,
    roster: { ...progress.roster, [characterId]: entry },
  };
}
