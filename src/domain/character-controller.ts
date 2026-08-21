import type { CharacterConfig } from './config';
import {
  calculateVelocity,
  clampPoint,
  classifyLanding,
  createBounds,
  distance,
  limitToss,
  magnitude,
  moveToward,
} from './motion';
import { CharacterStateMachine } from './state-machine';
import type {
  Bounds,
  CharacterInput,
  CharacterSnapshot,
  LandingKind,
  Point,
  Size,
} from './types';

type PointerSample = Readonly<{ point: Point; atMs: number }>;

const HELD_FOLLOW_RATE = 14;
const HELD_ROTATION_RADIANS = 0.18;
const HELD_VERTICAL_OFFSET = 7;
const REACTION_ROTATION_RADIANS = 0.10;
const REACTION_VERTICAL_OFFSET = 5;
const REDUCED_MOTION_MULTIPLIER = 0.45;
const TOSS_TRAVEL_SECONDS = 0.12;

export class CharacterController {
  private stateMachine: CharacterStateMachine;
  private viewport: Size;
  private characterHeight: number;
  private bounds: Bounds;
  private position: Point;
  private velocity: Point = { x: 0, y: 0 };
  private facing: -1 | 1 = 1;
  private reducedMotion: boolean;
  private pointerDown: PointerSample | null = null;
  private gestureCancelled = false;
  private heldTarget: Point | null = null;
  private samples: PointerSample[] = [];
  private animationTimeSeconds = 0;
  private stateStartedAtMs = 0;
  private lastAtMs = 0;

  constructor(
    private readonly config: CharacterConfig,
    viewport: Size,
    reducedMotion: boolean,
  ) {
    this.stateMachine = this.createStateMachine();
    this.reducedMotion = reducedMotion;
    this.viewport = this.normalizeViewport(viewport);
    this.characterHeight = this.viewport.height * this.config.characterHeightRatio;
    this.bounds = this.createSafeBounds();
    this.position = clampPoint(
      { x: this.viewport.width / 2, y: this.viewport.height * 0.72 },
      this.bounds,
    );
  }

  receive(input: CharacterInput): void {
    switch (input.type) {
      case 'POINTER_DOWN':
        this.lastAtMs = input.atMs;
        this.pointerDown = { point: input.point, atMs: input.atMs };
        this.gestureCancelled = false;
        this.heldTarget = clampPoint(input.point, this.bounds);
        this.samples = [];
        return;
      case 'POINTER_MOVE':
        this.lastAtMs = input.atMs;
        this.receivePointerMove(input.point, input.atMs);
        return;
      case 'POINTER_UP':
        this.lastAtMs = input.atMs;
        this.receivePointerUp(input.point, input.atMs);
        return;
      case 'POINTER_CANCEL':
      case 'INTERRUPTED':
        this.lastAtMs = input.atMs;
        this.resetAfterInterruption(input.atMs);
        return;
      case 'VIEWPORT_CHANGED':
        this.setViewport(input.size);
        return;
      case 'TICK':
        this.receiveTick(input.deltaSeconds, input.atMs);
    }
  }

  snapshot(): CharacterSnapshot {
    const state = this.stateMachine.state;
    const elapsedSeconds = Math.max(0, (this.lastAtMs - this.stateStartedAtMs) / 1_000);
    const motionMultiplier = this.reducedMotion ? REDUCED_MOTION_MULTIPLIER : 1;
    const heldPhase = state === 'HELD' ? this.animationTimeSeconds * 9 : 0;
    const reactionProgress = state === 'REACTING'
      ? this.config.reactionDurationSeconds <= 0
        ? 1
        : Math.min(elapsedSeconds / this.config.reactionDurationSeconds, 1)
      : 0;

    let rotationRadians = 0;
    let verticalOffset = 0;

    if (state === 'HELD') {
      rotationRadians = Math.sin(heldPhase) * HELD_ROTATION_RADIANS * motionMultiplier;
      verticalOffset = Math.cos(heldPhase * 1.4) * HELD_VERTICAL_OFFSET * motionMultiplier;
    } else if (state === 'REACTING') {
      const decay = 1 - reactionProgress;
      rotationRadians = Math.sin(elapsedSeconds * 24) * REACTION_ROTATION_RADIANS * decay * motionMultiplier;
      verticalOffset = Math.sin(elapsedSeconds * 18) * REACTION_VERTICAL_OFFSET * decay * motionMultiplier;
    } else if (state === 'LANDING') {
      const landingPhase = elapsedSeconds * 18;
      const amplitude = this.stateMachine.landingKind === 'ROLL' ? 0.20 : 0.10;
      rotationRadians = Math.sin(landingPhase) * amplitude * motionMultiplier;
      verticalOffset = Math.abs(Math.sin(landingPhase)) * -4 * motionMultiplier;
    }

    return {
      state,
      position: this.position,
      velocity: this.velocity,
      facing: this.facing,
      scale: state === 'HELD'
        ? 1 + (this.config.heldScale - 1) * motionMultiplier
        : 1,
      rotationRadians,
      verticalOffset,
      landingKind: this.stateMachine.landingKind,
      reactionProgress,
      heldPhase,
    };
  }

  setReducedMotion(reducedMotion: boolean): void {
    this.reducedMotion = reducedMotion;
  }

  setViewport(viewport: Size): void {
    this.viewport = this.normalizeViewport(viewport);
    this.characterHeight = this.viewport.height * this.config.characterHeightRatio;
    this.bounds = this.createSafeBounds();
    this.position = clampPoint(this.position, this.bounds);
    this.heldTarget = this.heldTarget === null ? null : clampPoint(this.heldTarget, this.bounds);
  }

  private receivePointerMove(point: Point, atMs: number): void {
    if (this.pointerDown === null) return;

    if (this.stateMachine.state !== 'HELD') {
      if (distance(this.pointerDown.point, point) >
        this.config.longPressCancelDistanceInHeights * this.characterHeight) {
        this.gestureCancelled = true;
      }
      return;
    }

    this.heldTarget = clampPoint(point, this.bounds);
    this.pushSample({ point, atMs });
  }

  private receivePointerUp(point: Point, atMs: number): void {
    if (this.pointerDown === null) return;

    if (this.stateMachine.state === 'HELD') {
      this.heldTarget = clampPoint(point, this.bounds);
      this.pushSample({ point, atMs });
      const velocity = limitToss(
        calculateVelocity(this.samples),
        this.characterHeight,
        this.config,
      );
      this.velocity = velocity;
      if (velocity.x < 0) this.facing = -1;
      if (velocity.x > 0) this.facing = 1;
      this.applyTossDistance(velocity);
      this.transitionToLanding(
        classifyLanding(magnitude(velocity), this.characterHeight, this.config),
        atMs,
      );
    } else if (!this.gestureCancelled &&
      this.stateMachine.state === 'IDLE' &&
      atMs - this.pointerDown.atMs <= this.config.tapMaxMs &&
      distance(this.pointerDown.point, point) <=
        this.config.tapMaxDistanceInHeights * this.characterHeight) {
      this.velocity = { x: 0, y: 0 };
      this.transitionToReacting(atMs);
    }

    this.clearPointer();
  }

  private receiveTick(deltaSeconds: number, atMs: number): void {
    this.lastAtMs = atMs;
    this.animationTimeSeconds += Math.max(0, deltaSeconds);

    if (this.pointerDown !== null && !this.gestureCancelled &&
      this.stateMachine.state !== 'HELD' &&
      atMs - this.pointerDown.atMs >= this.config.longPressMs) {
      this.transitionToHeld(atMs);
    }

    if (this.stateMachine.state === 'HELD' && this.heldTarget !== null) {
      this.position = clampPoint(
        moveToward(this.position, this.heldTarget, HELD_FOLLOW_RATE, deltaSeconds),
        this.bounds,
      );
    }

    const stateBeforeTick = this.stateMachine.state;
    this.stateMachine.tick(atMs);
    if (stateBeforeTick !== 'IDLE' && this.stateMachine.state === 'IDLE') {
      this.stateStartedAtMs = atMs;
      this.velocity = { x: 0, y: 0 };
    }
  }

  private transitionToReacting(atMs: number): void {
    this.stateMachine.transitionToReacting(atMs);
    this.stateStartedAtMs = atMs;
  }

  private transitionToHeld(atMs: number): void {
    this.stateMachine.transitionToHeld(atMs);
    this.stateStartedAtMs = atMs;
    this.velocity = { x: 0, y: 0 };
  }

  private transitionToLanding(kind: LandingKind, atMs: number): void {
    this.stateMachine.transitionToLanding(kind, atMs);
    this.stateStartedAtMs = atMs;
  }

  private resetAfterInterruption(atMs: number): void {
    this.clearPointer();
    this.velocity = { x: 0, y: 0 };
    this.position = clampPoint(this.position, this.bounds);
    this.stateMachine = this.createStateMachine();
    this.stateStartedAtMs = atMs;
  }

  private applyTossDistance(velocity: Point): void {
    const speed = magnitude(velocity);
    if (speed === 0) return;

    const distanceLimit = this.config.maxTossDistanceInHeights * this.characterHeight;
    const travelDistance = Math.min(speed * TOSS_TRAVEL_SECONDS, distanceLimit);
    this.position = clampPoint({
      x: this.position.x + velocity.x / speed * travelDistance,
      y: this.position.y + velocity.y / speed * travelDistance,
    }, this.bounds);
  }

  private pushSample(sample: PointerSample): void {
    this.samples = [...this.samples, sample].slice(-5);
  }

  private clearPointer(): void {
    this.pointerDown = null;
    this.gestureCancelled = false;
    this.heldTarget = null;
    this.samples = [];
  }

  private createStateMachine(): CharacterStateMachine {
    return new CharacterStateMachine(
      this.config.reactionDurationSeconds,
      this.config.glareDurationSeconds,
    );
  }

  private createSafeBounds(): Bounds {
    const raw = createBounds(this.viewport, this.characterHeight);
    const middleX = this.viewport.width / 2;
    const middleY = this.viewport.height / 2;
    return {
      left: raw.left <= raw.right ? raw.left : middleX,
      top: raw.top <= raw.bottom ? raw.top : middleY,
      right: raw.left <= raw.right ? raw.right : middleX,
      bottom: raw.top <= raw.bottom ? raw.bottom : middleY,
    };
  }

  private normalizeViewport(viewport: Size): Size {
    return {
      width: Math.max(0, viewport.width),
      height: Math.max(0, viewport.height),
    };
  }
}
