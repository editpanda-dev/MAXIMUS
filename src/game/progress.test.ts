import { describe, expect, it } from 'vitest';
import { createInitialProgress, grantRawReward, selectCharacter } from './progress';

describe('progress', () => {
  it('starts with only the base Hanbyeol at level one', () => {
    const progress = createInitialProgress();

    expect(progress.selectedCharacterId).toBe('base');
    expect(progress.roster.base).toEqual({ owned: true, level: 1 });
    expect(progress.roster.pogo.owned).toBe(false);
    expect(progress.roster.udon.owned).toBe(false);
  });

  it('adds XP and stardust without changing the selected character', () => {
    const before = createInitialProgress();
    const after = grantRawReward(before, { xp: 12, stardust: 8 });

    expect(after.xp).toBe(12);
    expect(after.stardust).toBe(8);
    expect(after.selectedCharacterId).toBe('base');
  });

  it('rejects selection of an unowned Hanbyeol', () => {
    expect(() => selectCharacter(createInitialProgress(), 'pogo')).toThrow('Character is not owned');
  });
});
