export type CharacterState = 'IDLE' | 'REACTING' | 'HELD' | 'LANDING';
export type LandingKind = 'SAFE' | 'WOBBLE' | 'ROLL';
export type LandingStage = 'NONE' | 'MOTION' | 'GLARE';

export type Point = Readonly<{ x: number; y: number }>;
export type Size = Readonly<{ width: number; height: number }>;
export type Bounds = Readonly<{ left: number; top: number; right: number; bottom: number }>;

export type CharacterInput =
  | { type: 'POINTER_DOWN'; point: Point; atMs: number }
  | { type: 'POINTER_MOVE'; point: Point; atMs: number }
  | { type: 'POINTER_UP'; point: Point; atMs: number }
  | { type: 'POINTER_CANCEL'; atMs: number }
  | { type: 'TICK'; deltaSeconds: number; atMs: number }
  | { type: 'VIEWPORT_CHANGED'; size: Size }
  | { type: 'INTERRUPTED'; atMs: number };

export type CharacterSnapshot = Readonly<{
  state: CharacterState;
  position: Point;
  velocity: Point;
  facing: -1 | 1;
  scale: number;
  rotationRadians: number;
  verticalOffset: number;
  landingKind: LandingKind | null;
  landingStage: LandingStage;
  landingScaleX: number;
  landingScaleY: number;
  reactionProgress: number;
  heldPhase: number;
  heldFlailAmplitude: number;
  heldTransitionToken: number;
}>;
