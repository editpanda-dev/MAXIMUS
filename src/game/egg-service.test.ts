import { describe, expect, it } from 'vitest';
import { buyEgg } from './egg-service';
import { grantRawReward, createInitialProgress } from './progress';

describe('buyEgg', () => {
  it('spends 100 stardust and unlocks the rolled unowned Hanbyeol', () => {
    const progress = grantRawReward(createInitialProgress(), { xp: 0, stardust: 100 });
    const result = buyEgg(progress, () => 0.4);

    expect(result.characterId).toBe('pogo');
    expect(result.outcome).toBe('NEW');
    expect(result.progress.stardust).toBe(0);
    expect(result.progress.roster.pogo).toEqual({ owned: true, level: 1 });
  });

  it('levels up an owned duplicate without creating another roster entry', () => {
    const first = buyEgg(
      grantRawReward(createInitialProgress(), { xp: 0, stardust: 200 }),
      () => 0.4,
    );
    const second = buyEgg(first.progress, () => 0.4);

    expect(second.outcome).toBe('LEVEL_UP');
    expect(second.progress.roster.pogo.level).toBe(2);
  });

  it('does not spend currency when the player cannot afford an egg', () => {
    expect(() => buyEgg(createInitialProgress(), () => 0)).toThrow('Not enough stardust');
  });
});
