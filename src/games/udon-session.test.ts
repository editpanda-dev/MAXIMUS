import { describe, expect, it } from 'vitest';
import { UdonSession } from './udon-session';

describe('UdonSession', () => {
  it('scores PERFECT when the active ingredient is inside the narrow timing window', () => {
    const session = new UdonSession({ seed: 3 });
    session.debugSetIngredientProgress(0.5);
    session.receive({ type: 'TAP' });

    expect(session.snapshot().lastJudgement).toBe('PERFECT');
    expect(session.snapshot().combo).toBe(1);
  });

  it('resets combo on a miss without ending the 45 second session', () => {
    const session = new UdonSession({ seed: 3 });
    session.debugSetIngredientProgress(0.5);
    session.receive({ type: 'TAP' });
    session.debugSetIngredientProgress(0.1);
    session.receive({ type: 'TAP' });

    expect(session.snapshot().lastJudgement).toBe('MISS');
    expect(session.snapshot().combo).toBe(0);
    expect(session.isComplete()).toBe(false);
  });

  it('ends exactly after 45 seconds', () => {
    const session = new UdonSession({ seed: 3 });
    session.tick(45);

    expect(session.isComplete()).toBe(true);
  });
});
