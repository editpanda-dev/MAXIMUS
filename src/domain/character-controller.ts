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
  LandingStage,
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
const HELD_BASE_CADENCE = 9;
const HELD_MAX_CADENCE = 16;
const HELD_BASE_FLAIL_AMPLITUDE = 0.45;
const TOSS_TRAVEL_SECONDS = 0.35;
const ROLL_MOTION_SECONDS = 0.45;
const IDLE_WALK_SECONDS = 1;
const IDLE_PAUSE_SECONDS = 0.35;

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
  private heldPhase = 0;
  private heldFlailIntensity = 0;
  private heldTransitionToken = 0;
  private landingTravelDistance = 0;
  private landingTravelProgress = 0;
  private idleWalking = true;
  private idleSegmentElapsedSeconds = 0;
  private idleDirection: -1 | 1 = 1;
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
        this.reconcileLongPress(input.atMs);
        this.receivePointerMove(input.point, input.atMs);
        return;
      case 'POINTER_UP':
        this.lastAtMs = input.atMs;
        this.reconcileLongPress(input.atMs);
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
    const heldPhase = state === 'HELD' ? this.heldPhase : 0;
    const reactionProgress = state === 'REACTING'
      ? this.config.reactionDurationSeconds <= 0
        ? 1
        : Math.min(elapsedSeconds / this.config.reactionDurationSeconds, 1)
      : 0;

    let rotationRadians = 0;
    let verticalOffset = 0;
    let landingScaleX = 1;
    let landingScaleY = 1;
    let landingStage: LandingStage = 'NONE';
    const heldFlailAmplitude = HELD_BASE_FLAIL_AMPLITUDE +
      (1 - HELD_BASE_FLAIL_AMPLITUDE) * this.heldFlailIntensity;

    if (state === 'HELD') {
      rotationRadians = Math.sin(heldPhase) * HELD_ROTATION_RADIANS * heldFlailAmplitude * motionMultiplier;
      verticalOffset = Math.cos(heldPhase * 1.4) * HELD_VERTICAL_OFFSET * heldFlailAmplitude * motionMultiplier;
    } else if (state === 'REACTING') {
      const decay = 1 - reactionProgress;
      rotationRadians = Math.sin(elapsedSeconds * 24) * REACTION_ROTATION_RADIANS * decay * motionMultiplier;
      verticalOffset = Math.sin(elapsedSeconds * 18) * REACTION_VERTICAL_OFFSET * decay * motionMultiplier;
    } else if (state === 'LANDING') {
      landingStage = this.landingStage(elapsedSeconds);
      const kind = this.stateMachine.landingKind;
      if (kind === 'SAFE') {
        const impact = Math.sin(Math.min(elapsedSeconds / 0.18, 1) * Math.PI);
        landingScaleX = 1 + impact * 0.12 * motionMultiplier;
        landingScaleY = 1 - impact * 0.10 * motionMultiplier;
      } else if (kind === 'WOBBLE') {
        const progress = Math.min(elapsedSeconds / 0.45, 1);
        const damping = Math.exp(-4 * progress);
        rotationRadians = Math.sin(progress * Math.PI * 4) * 0.18 * damping * motionMultiplier;
        verticalOffset = -Math.abs(Math.sin(progress * Math.PI * 3)) * 4 * damping * motionMultiplier;
      } else if (kind === 'ROLL' && landingStage === 'MOTION') {
        const progress = Math.min(elapsedSeconds / ROLL_MOTION_SECONDS, 1);
        rotationRadians = progress * Math.PI * 2 * motionMultiplier;
        verticalOffset = -Math.sin(progress * Math.PI) * 4 * motionMultiplier;
      }
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
      landingStage,
      landingScaleX,
      landingScaleY,
      reactionProgress,
      heldPhase,
      heldFlailAmplitude,
      heldTransitionToken: this.heldTransitionToken,
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
      } else {
        this.heldTarget = clampPoint(point, this.bounds);
        this.pushSample({ point, atMs });
      }
      return;
    }

    this.heldTarget = clampPoint(point, this.bounds);
    this.pushSample({ point, atMs });
    this.updateHeldFlailIntensity();
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
    const safeDelta = Math.max(0, deltaSeconds);

    this.reconcileLongPress(atMs);

    if (this.stateMachine.state === 'HELD' && this.heldTarget !== null) {
      this.position = clampPoint(
        moveToward(this.position, this.heldTarget, HELD_FOLLOW_RATE, safeDelta),
        this.bounds,
      );
      this.heldPhase += safeDelta * (HELD_BASE_CADENCE +
        (HELD_MAX_CADENCE - HELD_BASE_CADENCE) * this.heldFlailIntensity);
    } else if (this.stateMachine.state === 'LANDING') {
      this.advanceLanding(atMs);
    } else if (this.stateMachine.state === 'IDLE' && this.pointerDown === null) {
      this.advanceIdle(safeDelta);
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
    this.heldTransitionToken += 1;
    this.updateHeldFlailIntensity();
  }

  private transitionToLanding(kind: LandingKind, atMs: number): void {
    this.stateMachine.transitionToLanding(kind, atMs);
    this.stateStartedAtMs = atMs;
    this.landingTravelDistance = Math.min(
      magnitude(this.velocity) * TOSS_TRAVEL_SECONDS,
      this.config.maxTossDistanceInHeights * this.characterHeight,
    );
    this.landingTravelProgress = 0;
  }

  private resetAfterInterruption(atMs: number): void {
    this.clearPointer();
    this.velocity = { x: 0, y: 0 };
    this.position = clampPoint(this.position, this.bounds);
    this.stateMachine = this.createStateMachine();
    this.stateStartedAtMs = atMs;
  }

  private pushSample(sample: PointerSample): void {
    this.samples = [...this.samples, sample].slice(-5);
  }

  private clearPointer(): void {
    this.pointerDown = null;
    this.gestureCancelled = false;
    this.heldTarget = null;
    this.samples = [];
    this.heldFlailIntensity = 0;
  }

  private createStateMachine(): CharacterStateMachine {
    return new CharacterStateMachine(
      this.config.reactionDurationSeconds,
      this.config.glareDurationSeconds,
    );
  }

  private createSafeBounds(): Bounds {
    const raw = createBounds(this.viewport, this.characterHeight, this.config);
    return this.collapseBounds(raw);
  }

  private collapseBounds(raw: Bounds): Bounds {
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

  private reconcileLongPress(atMs: number): void {
    if (this.pointerDown !== null && !this.gestureCancelled &&
      this.stateMachine.state !== 'HELD' &&
      atMs - this.pointerDown.atMs >= this.config.longPressMs) {
      this.transitionToHeld(atMs);
    }
  }

  private updateHeldFlailIntensity(): void {
    const maximum = this.config.maxTossSpeedInHeightsPerSecond * this.characterHeight;
    this.heldFlailIntensity = maximum === 0 ? 0 : Math.min(1, magnitude(calculateVelocity(this.samples)) / maximum);
  }

  private landingStage(elapsedSeconds: number): LandingStage {
    if (this.stateMachine.landingKind !== 'ROLL') return this.stateMachine.landingKind === null ? 'NONE' : 'MOTION';
    return elapsedSeconds < ROLL_MOTION_SECONDS ? 'MOTION' : 'GLARE';
  }

  private advanceLanding(atMs: number): void {
    const elapsedSeconds = Math.max(0, (atMs - this.stateStartedAtMs) / 1_000);
    const motionSeconds = this.stateMachine.landingKind === 'ROLL' ? ROLL_MOTION_SECONDS : TOSS_TRAVEL_SECONDS;
    const progress = Math.min(elapsedSeconds / motionSeconds, 1);
    const easedProgress = 1 - (1 - progress) * (1 - progress);
    const priorEasedProgress = 1 - (1 - this.landingTravelProgress) * (1 - this.landingTravelProgress);
    const step = Math.max(0, easedProgress - priorEasedProgress) * this.landingTravelDistance;
    const speed = magnitude(this.velocity);
    if (step > 0 && speed > 0) {
      this.position = {
        x: this.position.x + this.velocity.x / speed * step,
        y: this.position.y + this.velocity.y / speed * step,
      };
    }
    this.position = clampPoint(this.position, this.landingBounds(elapsedSeconds));
    this.landingTravelProgress = progress;
    if (progress === 1) this.velocity = { x: 0, y: 0 };
  }

  private advanceIdle(deltaSeconds: number): void {
    let remaining = deltaSeconds;
    while (remaining > 0) {
      const duration = this.idleWalking ? IDLE_WALK_SECONDS : IDLE_PAUSE_SECONDS;
      const segmentRemaining = duration - this.idleSegmentElapsedSeconds;
      const step = Math.min(remaining, segmentRemaining);
      if (this.idleWalking) {
        this.position = clampPoint({
          x: this.position.x + this.idleDirection *
            this.config.idleWalkSpeedInHeightsPerSecond * this.characterHeight * step,
          y: this.position.y,
        }, this.bounds);
      }
      this.idleSegmentElapsedSeconds += step;
      remaining -= step;
      if (this.idleSegmentElapsedSeconds >= duration) {
        this.idleSegmentElapsedSeconds = 0;
        if (this.idleWalking) {
          this.idleWalking = false;
        } else {
          this.idleWalking = true;
          this.idleDirection = this.idleDirection === 1 ? -1 : 1;
          this.facing = this.idleDirection;
        }
      }
    }
  }

  private landingBounds(elapsedSeconds: number): Bounds {
    if (this.stateMachine.landingKind !== 'ROLL') return this.bounds;

    const progress = Math.min(elapsedSeconds / ROLL_MOTION_SECONDS, 1);
    const rotation = progress * Math.PI * 2;
    const horizontalHalfExtent = this.characterHeight * this.config.visibleCharacterWidthInHeights / 2;
    const verticalOffset = -Math.sin(progress * Math.PI) * 4;
    const cos = Math.cos(rotation);
    const sin = Math.sin(rotation);
    const xCoordinates = [-horizontalHalfExtent * this.facing, horizontalHalfExtent * this.facing];
    const yCoordinates = [-this.characterHeight, 0];
    const transformed = xCoordinates.flatMap((x) => yCoordinates.map((y) => ({
      x: x * cos - y * sin,
      y: x * sin + y * cos,
    })));
    const leftExtent = Math.min(...transformed.map((point) => point.x));
    const rightExtent = Math.max(...transformed.map((point) => point.x));
    const topExtent = Math.min(...transformed.map((point) => point.y));
    const bottomExtent = Math.max(...transformed.map((point) => point.y));
    return this.collapseBounds({
      left: -leftExtent,
      top: -verticalOffset - topExtent,
      right: this.viewport.width - rightExtent,
      bottom: this.viewport.height - verticalOffset - bottomExtent,
    });
  }
}
