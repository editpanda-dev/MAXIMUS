import { describe, expect, it } from 'vitest';
import { LocalProgressStore, type StorageLike } from './local-progress-store';
import { createInitialProgress, grantRawReward } from '../game/progress';

function fakeStorage(initial: Record<string, string> = {}): StorageLike {
  const values = new Map(Object.entries(initial));
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  };
}

describe('LocalProgressStore', () => {
  it('falls back to the initial progress when saved JSON is invalid', () => {
    const storage = fakeStorage({ 'jang-han-byeol.progress.v1': '{bad json' });

    expect(new LocalProgressStore(storage).load()).toEqual(createInitialProgress());
  });

  it('restores a saved progress snapshot', () => {
    const storage = fakeStorage();
    const store = new LocalProgressStore(storage);
    const progress = grantRawReward(createInitialProgress(), { xp: 3, stardust: 9 });
    store.save(progress);

    expect(store.load()).toEqual(progress);
  });
});
