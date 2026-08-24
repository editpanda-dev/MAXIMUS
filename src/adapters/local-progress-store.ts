import { PROGRESS_SCHEMA_VERSION } from '../game/balance';
import { createInitialProgress } from '../game/progress';
import type { AccountProgress, CharacterId } from '../game/types';

export type StorageLike = Readonly<{
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}>;

export const PROGRESS_STORAGE_KEY = 'jang-han-byeol.progress.v1';
const characterIds: readonly CharacterId[] = ['base', 'pogo', 'udon'];

function isStoredProgress(value: unknown): value is AccountProgress {
  if (value === null || typeof value !== 'object') return false;
  const candidate = value as Partial<AccountProgress>;
  if (candidate.schemaVersion !== PROGRESS_SCHEMA_VERSION ||
      typeof candidate.xp !== 'number' || typeof candidate.level !== 'number' ||
      typeof candidate.xpIntoLevel !== 'number' || typeof candidate.stardust !== 'number' ||
      !characterIds.includes(candidate.selectedCharacterId as CharacterId) ||
      candidate.roster === undefined) return false;
  return characterIds.every((id) => {
    const entry = candidate.roster?.[id];
    return entry !== undefined && typeof entry.owned === 'boolean' && typeof entry.level === 'number';
  });
}

export class LocalProgressStore {
  constructor(private readonly storage: StorageLike) {}

  load(): AccountProgress {
    try {
      const value = this.storage.getItem(PROGRESS_STORAGE_KEY);
      if (value === null) return createInitialProgress();
      const parsed: unknown = JSON.parse(value);
      return isStoredProgress(parsed) ? parsed : createInitialProgress();
    } catch {
      return createInitialProgress();
    }
  }

  save(progress: AccountProgress): void {
    this.storage.setItem(PROGRESS_STORAGE_KEY, JSON.stringify(progress));
  }
}
