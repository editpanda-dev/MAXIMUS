import { describe, expect, it } from 'vitest';
import { defaultCharacterConfig } from './config';
import {
  calculateVelocity,
  clampPoint,
  classifyLanding,
  createBounds,
  limitToss,
  moveToward,
} from './motion';

describe('motion helpers', () => {
  it('classifies release speed using character-height thresholds', () => {
    const height = 200;
    expect(classifyLanding(149, height, defaultCharacterConfig)).toBe('SAFE');
    expect(classifyLanding(150, height, defaultCharacterConfig)).toBe('WOBBLE');
    expect(classifyLanding(400, height, defaultCharacterConfig)).toBe('ROLL');
  });

  it('clamps a held target inside HOME bounds', () => {
    expect(clampPoint({ x: -20, y: 900 }, { left: 30, top: 40, right: 360, bottom: 700 }))
      .toEqual({ x: 30, y: 700 });
  });

  it('limits excessive toss speed to the approved 3H/s maximum', () => {
    const limited = limitToss({ x: 1000, y: 0 }, 200, defaultCharacterConfig);
    expect(limited.x).toBeCloseTo(600);
    expect(limited.y).toBe(0);
  });

  it('uses recent pointer samples to calculate pixels per second', () => {
    expect(calculateVelocity([
      { point: { x: 10, y: 20 }, atMs: 0 },
      { point: { x: 110, y: 20 }, atMs: 100 },
    ])).toEqual({ x: 1000, y: 0 });
  });

  it('uses only the latest five samples and handles non-positive time', () => {
    expect(calculateVelocity([
      { point: { x: 0, y: 0 }, atMs: 0 },
      { point: { x: 100, y: 0 }, atMs: 100 },
      { point: { x: 200, y: 0 }, atMs: 200 },
      { point: { x: 300, y: 0 }, atMs: 300 },
      { point: { x: 400, y: 0 }, atMs: 400 },
      { point: { x: 500, y: 0 }, atMs: 500 },
    ])).toEqual({ x: 1000, y: 0 });
    expect(calculateVelocity([
      { point: { x: 10, y: 20 }, atMs: 100 },
      { point: { x: 20, y: 30 }, atMs: 100 },
    ])).toEqual({ x: 0, y: 0 });
  });

  it('creates HOME bounds from character-height margins', () => {
    expect(createBounds({ width: 1_000, height: 800 }, 200))
      .toEqual({ left: 70, top: 100, right: 930, bottom: 700 });
  });

  it('moves toward a target by a time-scaled follow amount', () => {
    expect(moveToward({ x: 0, y: 10 }, { x: 100, y: 30 }, 2, 0.25))
      .toEqual({ x: 50, y: 20 });
  });
});
