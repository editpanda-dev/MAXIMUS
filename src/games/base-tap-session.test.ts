import { describe, expect, it } from 'vitest';
import { BaseTapSession } from './base-tap-session';

describe('BaseTapSession', () => {
  it('creates a combo when taps arrive inside the 1.8 second window', () => {
    const session = new BaseTapSession(1, 0);
    session.receive({ type: 'TAP', atSeconds: 0 });
    session.receive({ type: 'TAP', atSeconds: 1.7 });

    expect(session.snapshot().combo).toBe(2);
  });

  it('expires the combo after 1.8 seconds without a tap', () => {
    const session = new BaseTapSession(1, 0);
    session.receive({ type: 'TAP', atSeconds: 0 });
    session.tick(1.81);

    expect(session.snapshot().combo).toBe(0);
  });
});
