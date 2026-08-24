import { describe, expect, it } from 'vitest';
import { PogoSession } from './pogo-session';

describe('PogoSession', () => {
  it('jumps from the ground and ignores a second tap while airborne', () => {
    const session = new PogoSession({ seed: 7, viewportWidth: 393, groundY: 700 });
    session.receive({ type: 'TAP' });
    const firstVelocity = session.snapshot().verticalVelocity;
    session.receive({ type: 'TAP' });

    expect(firstVelocity).toBeLessThan(0);
    expect(session.snapshot().verticalVelocity).toBe(firstVelocity);
  });

  it('ends when an obstacle overlaps the player hitbox', () => {
    const session = new PogoSession({ seed: 7, viewportWidth: 393, groundY: 700 });
    session.debugPlaceObstacle({ kind: 'shrimp', x: 96, width: 32, height: 36 });
    session.tick(0.01);

    expect(session.isComplete()).toBe(true);
  });

  it('counts an obstacle as avoided exactly once after it leaves the screen', () => {
    const session = new PogoSession({ seed: 7, viewportWidth: 393, groundY: 700 });
    session.debugPlaceObstacle({ kind: 'garlic', x: 0, width: 32, height: 36 });
    session.tick(0.1);

    expect(session.snapshot().avoids).toBe(1);
  });
});
