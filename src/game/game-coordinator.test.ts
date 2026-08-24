import { describe, expect, it } from 'vitest';
import { GameCoordinator, type ProgressStore } from './game-coordinator';
import { createInitialProgress } from './progress';
import type { AccountProgress } from './types';

class MemoryProgressStore implements ProgressStore {
  constructor(private progress: AccountProgress = createInitialProgress()) {}

  load(): AccountProgress {
    return this.progress;
  }

  save(progress: AccountProgress): void {
    this.progress = progress;
  }
}

describe('GameCoordinator', () => {
  it('settles a base tap immediately and persists the reward', () => {
    const store = new MemoryProgressStore();
    const coordinator = new GameCoordinator(store);
    coordinator.tap(0);

    expect(coordinator.snapshot().screen).toBe('HOME');
    expect(store.load().xp).toBe(1);
    expect(store.load().stardust).toBe(1);
  });

  it('shows an egg reveal after an affordable purchase', () => {
    const store = new MemoryProgressStore({
      ...createInitialProgress(),
      stardust: 100,
    });
    const coordinator = new GameCoordinator(store);
    const result = coordinator.buyEgg(() => 0.4);

    expect(result.characterId).toBe('pogo');
    expect(coordinator.snapshot().screen).toBe('EGG_REVEAL');
    expect(store.load().roster.pogo.owned).toBe(true);
  });
});
