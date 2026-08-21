import type { CharacterState, LandingKind } from './types';

const LANDING_DURATIONS_SECONDS: Readonly<Record<LandingKind, number>> = {
  SAFE: 0.18,
  WOBBLE: 0.45,
  ROLL: 0.95,
};

export class CharacterStateMachine {
  private currentState: CharacterState = 'IDLE';
  private currentLandingKind: LandingKind | null = null;
  private deadlineMs: number | null = null;

  constructor(
    private readonly reactionDurationSeconds: number,
    private readonly glareDurationSeconds = 0.5,
  ) {}

  get state(): CharacterState {
    return this.currentState;
  }

  get landingKind(): LandingKind | null {
    return this.currentLandingKind;
  }

  transitionToReacting(atMs: number): void {
    this.currentState = 'REACTING';
    this.currentLandingKind = null;
    this.deadlineMs = atMs + this.reactionDurationSeconds * 1_000;
  }

  transitionToHeld(_atMs: number): void {
    this.currentState = 'HELD';
    this.currentLandingKind = null;
    this.deadlineMs = null;
  }

  transitionToLanding(kind: LandingKind, atMs: number): void {
    this.currentState = 'LANDING';
    this.currentLandingKind = kind;
    const durationSeconds = LANDING_DURATIONS_SECONDS[kind] +
      (kind === 'ROLL' ? this.glareDurationSeconds : 0);
    this.deadlineMs = atMs + durationSeconds * 1_000;
  }

  tick(atMs: number): void {
    if ((this.currentState === 'REACTING' || this.currentState === 'LANDING') &&
        this.deadlineMs !== null && atMs >= this.deadlineMs) {
      this.currentState = 'IDLE';
      this.currentLandingKind = null;
      this.deadlineMs = null;
    }
  }
}
