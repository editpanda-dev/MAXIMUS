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
