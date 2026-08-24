import { describe, expect, it } from 'vitest';
import { buildHomeDisplay } from './game-display';
import { createInitialProgress } from '../game/progress';

describe('buildHomeDisplay', () => {
  it('describes the base Hanbyeol as an immediate tap earner', () => {
    const display = buildHomeDisplay(createInitialProgress(), 4);

    expect(display.characterName).toBe('기본 한별');
    expect(display.actionLabel).toBe('한별이를 탭해 별가루 받기');
    expect(display.comboLabel).toBe('COMBO 4');
  });

  it('describes an unowned character as locked in collection', () => {
    const display = buildHomeDisplay(createInitialProgress(), 0);

    expect(display.collection.find((entry) => entry.id === 'pogo')).toMatchObject({ owned: false, level: 0 });
  });
});
