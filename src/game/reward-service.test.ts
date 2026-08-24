import { describe, expect, it } from 'vitest';
import { createInitialProgress } from './progress';
import { settleReward } from './reward-service';

describe('settleReward', () => {
  it('applies a character level multiplier to stardust but not XP', () => {
    const settled = settleReward(createInitialProgress(), 'base', { xp: 4, stardust: 10 }, 5);

    expect(settled.xp).toBe(4);
    expect(settled.stardust).toBe(14);
    expect(settled.progress.xp).toBe(4);
    expect(settled.progress.stardust).toBe(14);
  });
});
