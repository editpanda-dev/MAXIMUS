import { describe, expect, it } from 'vitest';
import { defaultCharacterConfig } from './config';
import { CharacterController } from './character-controller';

const viewport = { width: 393, height: 852 };

describe('CharacterController', () => {
  it('reacts to a short stationary tap then returns to IDLE', () => {
    const controller = new CharacterController(defaultCharacterConfig, viewport, false);
    controller.receive({ type: 'POINTER_DOWN', point: { x: 196, y: 600 }, atMs: 0 });
    controller.receive({ type: 'POINTER_UP', point: { x: 197, y: 600 }, atMs: 200 });
    expect(controller.snapshot().state).toBe('REACTING');
    controller.receive({ type: 'TICK', deltaSeconds: 0.7, atMs: 900 });
    expect(controller.snapshot().state).toBe('IDLE');
  });

  it('enters HELD only after the long-press deadline', () => {
    const controller = new CharacterController(defaultCharacterConfig, viewport, false);
    controller.receive({ type: 'POINTER_DOWN', point: { x: 196, y: 600 }, atMs: 0 });
    controller.receive({ type: 'TICK', deltaSeconds: 0.34, atMs: 340 });
    expect(controller.snapshot().state).toBe('IDLE');
    controller.receive({ type: 'TICK', deltaSeconds: 0.01, atMs: 350 });
    expect(controller.snapshot().state).toBe('HELD');
    expect(controller.snapshot().scale).toBe(defaultCharacterConfig.heldScale);
  });

  it('reconciles the exact long-press deadline on pointer events', () => {
    const beforeDeadline = new CharacterController(defaultCharacterConfig, viewport, false);
    beforeDeadline.receive({ type: 'POINTER_DOWN', point: { x: 196, y: 600 }, atMs: 0 });
    beforeDeadline.receive({ type: 'POINTER_UP', point: { x: 196, y: 600 }, atMs: 349 });
    expect(beforeDeadline.snapshot().state).toBe('IDLE');

    const atDeadline = new CharacterController(defaultCharacterConfig, viewport, false);
    atDeadline.receive({ type: 'POINTER_DOWN', point: { x: 196, y: 600 }, atMs: 0 });
    atDeadline.receive({ type: 'POINTER_UP', point: { x: 196, y: 600 }, atMs: 350 });
    expect(atDeadline.snapshot().state).toBe('LANDING');

    const moveAtDeadline = new CharacterController(defaultCharacterConfig, viewport, false);
    moveAtDeadline.receive({ type: 'POINTER_DOWN', point: { x: 196, y: 600 }, atMs: 0 });
    moveAtDeadline.receive({ type: 'POINTER_MOVE', point: { x: 196, y: 600 }, atMs: 350 });
    expect(moveAtDeadline.snapshot().state).toBe('HELD');
    expect(moveAtDeadline.snapshot().heldTransitionToken).toBeGreaterThan(0);
  });

  it('keeps an allowed pre-HELD drag as the target when the deadline arrives', () => {
    const controller = new CharacterController(defaultCharacterConfig, viewport, false);
    controller.receive({ type: 'POINTER_DOWN', point: { x: 196, y: 600 }, atMs: 0 });
    controller.receive({ type: 'POINTER_MOVE', point: { x: 210, y: 600 }, atMs: 100 });
    controller.receive({ type: 'TICK', deltaSeconds: 0.25, atMs: 350 });
    controller.receive({ type: 'TICK', deltaSeconds: 0.05, atMs: 400 });
    expect(controller.snapshot().state).toBe('HELD');
    expect(controller.snapshot().position.x).toBeGreaterThan(196);
  });

  it('cancels a pre-long-press drag and recovers safely after interruption', () => {
    const controller = new CharacterController(defaultCharacterConfig, viewport, false);
    controller.receive({ type: 'POINTER_DOWN', point: { x: 196, y: 600 }, atMs: 0 });
    controller.receive({ type: 'POINTER_MOVE', point: { x: 250, y: 600 }, atMs: 100 });
    controller.receive({ type: 'TICK', deltaSeconds: 0.4, atMs: 400 });
    expect(controller.snapshot().state).toBe('IDLE');
    controller.receive({ type: 'INTERRUPTED', atMs: 401 });
    expect(controller.snapshot().velocity).toEqual({ x: 0, y: 0 });
    expect(controller.snapshot().state).toBe('IDLE');
  });

  it('classifies a fast held release as ROLL and later returns to IDLE', () => {
    const controller = new CharacterController(defaultCharacterConfig, viewport, false);
    controller.receive({ type: 'POINTER_DOWN', point: { x: 196, y: 600 }, atMs: 0 });
    controller.receive({ type: 'TICK', deltaSeconds: 0.35, atMs: 350 });
    controller.receive({ type: 'POINTER_MOVE', point: { x: 196, y: 600 }, atMs: 351 });
    controller.receive({ type: 'POINTER_MOVE', point: { x: 390, y: 600 }, atMs: 401 });
    controller.receive({ type: 'POINTER_UP', point: { x: 390, y: 600 }, atMs: 411 });
    expect(controller.snapshot().landingKind).toBe('ROLL');
    controller.receive({ type: 'TICK', deltaSeconds: 2, atMs: 2411 });
    expect(controller.snapshot().state).toBe('IDLE');
  });

  it('advances toss travel on TICK instead of jumping at POINTER_UP', () => {
    const controller = new CharacterController(defaultCharacterConfig, viewport, false);
    controller.receive({ type: 'POINTER_DOWN', point: { x: 196, y: 600 }, atMs: 0 });
    controller.receive({ type: 'TICK', deltaSeconds: 0.35, atMs: 350 });
    controller.receive({ type: 'POINTER_MOVE', point: { x: 196, y: 600 }, atMs: 351 });
    controller.receive({ type: 'POINTER_MOVE', point: { x: 296, y: 600 }, atMs: 601 });
    const beforeRelease = controller.snapshot().position;
    controller.receive({ type: 'POINTER_UP', point: { x: 296, y: 600 }, atMs: 601 });
    expect(controller.snapshot().landingKind).toBe('WOBBLE');
    expect(controller.snapshot().position).toEqual(beforeRelease);
    controller.receive({ type: 'TICK', deltaSeconds: 0.1, atMs: 701 });
    expect(controller.snapshot().position.x).toBeGreaterThan(beforeRelease.x);
  });

  it('keeps the full maximum-scale character visible at the top and side edges', () => {
    const controller = new CharacterController(defaultCharacterConfig, viewport, false);
    const characterHeight = viewport.height * defaultCharacterConfig.characterHeightRatio;
    controller.receive({ type: 'POINTER_DOWN', point: { x: 196, y: 600 }, atMs: 0 });
    controller.receive({ type: 'TICK', deltaSeconds: 0.35, atMs: 350 });
    controller.receive({ type: 'POINTER_MOVE', point: { x: 0, y: 0 }, atMs: 351 });
    controller.receive({ type: 'TICK', deltaSeconds: 1, atMs: 1_351 });
    const snapshot = controller.snapshot();
    expect(snapshot.position.y).toBeGreaterThanOrEqual(characterHeight * defaultCharacterConfig.heldScale);
    expect(snapshot.position.x).toBeGreaterThanOrEqual(characterHeight * 0.27);
  });

  it('keeps collapsed safe bounds finite in a viewport smaller than the character', () => {
    const controller = new CharacterController(defaultCharacterConfig, { width: 40, height: 40 }, false);
    const { position } = controller.snapshot();
    expect(Number.isFinite(position.x)).toBe(true);
    expect(Number.isFinite(position.y)).toBe(true);
    expect(position.x).toBeGreaterThanOrEqual(0);
    expect(position.x).toBeLessThanOrEqual(40);
    expect(position.y).toBeGreaterThanOrEqual(0);
    expect(position.y).toBeLessThanOrEqual(40);
  });

  it('gives SAFE a visible squash and recovery snapshot', () => {
    const controller = new CharacterController(defaultCharacterConfig, viewport, false);
    controller.receive({ type: 'POINTER_DOWN', point: { x: 196, y: 600 }, atMs: 0 });
    controller.receive({ type: 'TICK', deltaSeconds: 0.35, atMs: 350 });
    controller.receive({ type: 'POINTER_MOVE', point: { x: 196, y: 600 }, atMs: 351 });
    controller.receive({ type: 'POINTER_UP', point: { x: 196, y: 600 }, atMs: 352 });
    controller.receive({ type: 'TICK', deltaSeconds: 0.05, atMs: 402 });
    const snapshot = controller.snapshot();
    expect(snapshot.landingKind).toBe('SAFE');
    expect(snapshot.landingScaleX).toBeGreaterThan(1);
    expect(snapshot.landingScaleY).toBeLessThan(1);
  });

  it('performs one bounded ROLL then a still glare for the configured half second', () => {
    const controller = new CharacterController(defaultCharacterConfig, viewport, false);
    controller.receive({ type: 'POINTER_DOWN', point: { x: 196, y: 600 }, atMs: 0 });
    controller.receive({ type: 'TICK', deltaSeconds: 0.35, atMs: 350 });
    controller.receive({ type: 'POINTER_MOVE', point: { x: 196, y: 600 }, atMs: 351 });
    controller.receive({ type: 'POINTER_MOVE', point: { x: 390, y: 600 }, atMs: 401 });
    controller.receive({ type: 'POINTER_UP', point: { x: 390, y: 600 }, atMs: 401 });
    controller.receive({ type: 'TICK', deltaSeconds: 0.1, atMs: 501 });
    expect(controller.snapshot().landingStage).toBe('MOTION');
    controller.receive({ type: 'TICK', deltaSeconds: 0.35, atMs: 851 });
    const glare = controller.snapshot();
    expect(glare.landingStage).toBe('GLARE');
    expect(glare.rotationRadians).toBe(0);
    controller.receive({ type: 'TICK', deltaSeconds: 0.5, atMs: 1_351 });
    expect(controller.snapshot().state).toBe('IDLE');
  });

  it('keeps a rolling foot-anchored sprite inside the bottom edge during toss travel', () => {
    const controller = new CharacterController(defaultCharacterConfig, viewport, false);
    const characterHeight = viewport.height * defaultCharacterConfig.characterHeightRatio;
    controller.receive({ type: 'POINTER_DOWN', point: { x: 196, y: 600 }, atMs: 0 });
    controller.receive({ type: 'TICK', deltaSeconds: 0.35, atMs: 350 });
    controller.receive({ type: 'POINTER_MOVE', point: { x: 196, y: 852 }, atMs: 351 });
    controller.receive({ type: 'TICK', deltaSeconds: 1, atMs: 1_351 });
    controller.receive({ type: 'POINTER_MOVE', point: { x: 196, y: 852 }, atMs: 1_401 });
    controller.receive({ type: 'POINTER_MOVE', point: { x: 196, y: 852 }, atMs: 1_411 });
    controller.receive({ type: 'POINTER_MOVE', point: { x: 196, y: 852 }, atMs: 1_421 });
    controller.receive({ type: 'POINTER_MOVE', point: { x: 390, y: 852 }, atMs: 1_431 });
    controller.receive({ type: 'POINTER_UP', point: { x: 390, y: 852 }, atMs: 1_431 });
    controller.receive({ type: 'TICK', deltaSeconds: 0.113, atMs: 1_544 });
    expect(controller.snapshot().landingKind).toBe('ROLL');
    expect(controller.snapshot().position.y).toBeLessThanOrEqual(
      viewport.height - characterHeight * defaultCharacterConfig.visibleCharacterWidthInHeights / 2 + 4,
    );
  });

  it('walks IDLE deterministically with pauses and direction changes', () => {
    const controller = new CharacterController(defaultCharacterConfig, viewport, false);
    const initialX = controller.snapshot().position.x;
    controller.receive({ type: 'TICK', deltaSeconds: 1, atMs: 1_000 });
    const afterFirstWalk = controller.snapshot().position.x;
    controller.receive({ type: 'TICK', deltaSeconds: 1.6, atMs: 2_600 });
    const afterDirectionChange = controller.snapshot().position.x;
    expect(afterFirstWalk).toBeGreaterThan(initialX);
    expect(afterDirectionChange).toBeLessThan(afterFirstWalk);
    expect(afterDirectionChange).toBeGreaterThanOrEqual(0);
    expect(afterDirectionChange).toBeLessThanOrEqual(viewport.width);
  });

  it('increases HELD flailing cadence and amplitude for a faster recent drag within caps', () => {
    const slow = new CharacterController(defaultCharacterConfig, viewport, false);
    slow.receive({ type: 'POINTER_DOWN', point: { x: 196, y: 600 }, atMs: 0 });
    slow.receive({ type: 'TICK', deltaSeconds: 0.35, atMs: 350 });
    slow.receive({ type: 'POINTER_MOVE', point: { x: 196, y: 600 }, atMs: 351 });
    slow.receive({ type: 'POINTER_MOVE', point: { x: 206, y: 600 }, atMs: 551 });
    slow.receive({ type: 'TICK', deltaSeconds: 0.1, atMs: 651 });

    const fast = new CharacterController(defaultCharacterConfig, viewport, false);
    fast.receive({ type: 'POINTER_DOWN', point: { x: 196, y: 600 }, atMs: 0 });
    fast.receive({ type: 'TICK', deltaSeconds: 0.35, atMs: 350 });
    fast.receive({ type: 'POINTER_MOVE', point: { x: 196, y: 600 }, atMs: 351 });
    fast.receive({ type: 'POINTER_MOVE', point: { x: 296, y: 600 }, atMs: 551 });
    fast.receive({ type: 'TICK', deltaSeconds: 0.1, atMs: 651 });

    const slowSnapshot = slow.snapshot();
    const fastSnapshot = fast.snapshot();
    expect(fastSnapshot.heldPhase).toBeGreaterThan(slowSnapshot.heldPhase);
    expect(fastSnapshot.heldFlailAmplitude).toBeGreaterThan(slowSnapshot.heldFlailAmplitude);
    expect(fastSnapshot.heldFlailAmplitude).toBeLessThanOrEqual(1);
  });

  it('preserves ROLL classification and glare timing while reducing its amplitude', () => {
    const releaseRoll = (reducedMotion: boolean): CharacterController => {
      const controller = new CharacterController(defaultCharacterConfig, viewport, reducedMotion);
      controller.receive({ type: 'POINTER_DOWN', point: { x: 196, y: 600 }, atMs: 0 });
      controller.receive({ type: 'TICK', deltaSeconds: 0.35, atMs: 350 });
      controller.receive({ type: 'POINTER_MOVE', point: { x: 196, y: 600 }, atMs: 351 });
      controller.receive({ type: 'POINTER_MOVE', point: { x: 390, y: 600 }, atMs: 401 });
      controller.receive({ type: 'POINTER_UP', point: { x: 390, y: 600 }, atMs: 401 });
      controller.receive({ type: 'TICK', deltaSeconds: 0.1, atMs: 501 });
      return controller;
    };

    const full = releaseRoll(false);
    const reduced = releaseRoll(true);
    expect(full.snapshot().landingKind).toBe('ROLL');
    expect(reduced.snapshot().landingKind).toBe('ROLL');
    expect(reduced.snapshot().landingStage).toBe(full.snapshot().landingStage);
    expect(Math.abs(reduced.snapshot().rotationRadians)).toBeLessThan(
      Math.abs(full.snapshot().rotationRadians),
    );
    full.receive({ type: 'TICK', deltaSeconds: 0.35, atMs: 851 });
    reduced.receive({ type: 'TICK', deltaSeconds: 0.35, atMs: 851 });
    expect(full.snapshot().landingStage).toBe('GLARE');
    expect(reduced.snapshot().landingStage).toBe('GLARE');
  });

  it('keeps the character inside a resized viewport', () => {
    const controller = new CharacterController(defaultCharacterConfig, viewport, false);
    controller.setViewport({ width: 200, height: 300 });
    const { position } = controller.snapshot();
    expect(position.x).toBeGreaterThanOrEqual(0);
    expect(position.y).toBeGreaterThanOrEqual(0);
    expect(position.x).toBeLessThanOrEqual(200);
    expect(position.y).toBeLessThanOrEqual(300);
  });

  it('reduces held rotation amplitude without changing HELD state', () => {
    const controller = new CharacterController(defaultCharacterConfig, viewport, true);
    controller.receive({ type: 'POINTER_DOWN', point: { x: 196, y: 600 }, atMs: 0 });
    controller.receive({ type: 'TICK', deltaSeconds: 0.35, atMs: 350 });
    controller.receive({ type: 'TICK', deltaSeconds: 0.2, atMs: 550 });
    expect(controller.snapshot().state).toBe('HELD');
    expect(Math.abs(controller.snapshot().rotationRadians)).toBeLessThan(0.12);
  });
});
