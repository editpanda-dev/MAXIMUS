import { describe, expect, it } from 'vitest';
import { CharacterStateMachine } from './state-machine';

describe('CharacterStateMachine', () => {
  it('returns from REACTING to IDLE after its reaction duration', () => {
    const machine = new CharacterStateMachine(0.6);
    machine.transitionToReacting(100);
    expect(machine.state).toBe('REACTING');
    machine.tick(699);
    expect(machine.state).toBe('REACTING');
    machine.tick(700);
    expect(machine.state).toBe('IDLE');
  });

  it('allows a long press to interrupt REACTING and a landing to interrupt into HELD', () => {
    const machine = new CharacterStateMachine(0.6);
    machine.transitionToReacting(0);
    machine.transitionToHeld(200);
    expect(machine.state).toBe('HELD');
    machine.transitionToLanding('ROLL', 300);
    machine.transitionToHeld(350);
    expect(machine.state).toBe('HELD');
  });

  it('returns every landing kind to IDLE when its duration expires', () => {
    for (const kind of ['SAFE', 'WOBBLE', 'ROLL'] as const) {
      const machine = new CharacterStateMachine(0.6);
      machine.transitionToLanding(kind, 0);
      machine.tick(2_000);
      expect(machine.state).toBe('IDLE');
    }
  });
});
