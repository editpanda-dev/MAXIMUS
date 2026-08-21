import type { CharacterConfig } from './config';
import type { Bounds, LandingKind, Point, Size } from './types';

export function magnitude(vector: Point): number {
  return Math.hypot(vector.x, vector.y);
}

export function distance(a: Point, b: Point): number {
  return magnitude({ x: b.x - a.x, y: b.y - a.y });
}

export function clampPoint(point: Point, bounds: Bounds): Point {
  return {
    x: Math.min(Math.max(point.x, bounds.left), bounds.right),
    y: Math.min(Math.max(point.y, bounds.top), bounds.bottom),
  };
}

export function createBounds(
  viewport: Size,
  characterHeight: number,
  config?: CharacterConfig,
): Bounds {
  if (config === undefined) {
    const horizontalMargin = 0.35 * characterHeight;
    const verticalMargin = 0.50 * characterHeight;
    return {
      left: horizontalMargin,
      top: verticalMargin,
      right: viewport.width - horizontalMargin,
      bottom: viewport.height - verticalMargin,
    };
  }

  const scale = config.heldScale;
  const halfWidth = config.visibleCharacterWidthInHeights * characterHeight / 2;
  const sin = Math.sin(config.maximumRotationRadians);
  const cos = Math.cos(config.maximumRotationRadians);
  const horizontalMargin = scale * (halfWidth * cos + characterHeight * sin);
  const topMargin = scale * (characterHeight * cos + halfWidth * sin) +
    config.heldVerticalOffsetInHeights * characterHeight;
  const bottomMargin = scale * halfWidth * sin +
    Math.max(config.heldVerticalOffsetInHeights, config.landingVerticalOffsetInHeights) * characterHeight;
  return {
    left: horizontalMargin,
    top: topMargin,
    right: viewport.width - horizontalMargin,
    bottom: viewport.height - bottomMargin,
  };
}

export function calculateVelocity(
  samples: ReadonlyArray<{ point: Point; atMs: number }>,
): Point {
  if (samples.length < 2) return { x: 0, y: 0 };

  const recent = samples.slice(-5);
  const oldest = recent[0];
  const newest = recent[recent.length - 1];
  const deltaSeconds = (newest.atMs - oldest.atMs) / 1_000;
  if (deltaSeconds <= 0) return { x: 0, y: 0 };

  return {
    x: (newest.point.x - oldest.point.x) / deltaSeconds,
    y: (newest.point.y - oldest.point.y) / deltaSeconds,
  };
}

export function classifyLanding(
  speed: number,
  characterHeight: number,
  config: CharacterConfig,
): LandingKind {
  if (speed < config.safeSpeedInHeightsPerSecond * characterHeight) return 'SAFE';
  if (speed < config.wobbleSpeedInHeightsPerSecond * characterHeight) return 'WOBBLE';
  return 'ROLL';
}

export function limitToss(
  velocity: Point,
  characterHeight: number,
  config: CharacterConfig,
): Point {
  const maximum = config.maxTossSpeedInHeightsPerSecond * characterHeight;
  const speed = magnitude(velocity);
  if (speed <= maximum || speed === 0) return { x: velocity.x, y: velocity.y };
  const scale = maximum / speed;
  return { x: velocity.x * scale, y: velocity.y * scale };
}

export function moveToward(
  current: Point,
  target: Point,
  followRate: number,
  deltaSeconds: number,
): Point {
  const amount = Math.min(Math.max(followRate * deltaSeconds, 0), 1);
  return {
    x: current.x + (target.x - current.x) * amount,
    y: current.y + (target.y - current.y) * amount,
  };
}
