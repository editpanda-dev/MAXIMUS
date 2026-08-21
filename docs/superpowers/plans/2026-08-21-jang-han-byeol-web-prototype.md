# Jang Han-byeol Web Interaction Toy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a responsive browser prototype in which one Jang Han-byeol can idle, react to taps, be long-pressed and dragged, then land safely, wobble, or make one short comic roll.

**Architecture:** Vite hosts a TypeScript application with PixiJS as a thin rendering layer. The state machine, pointer interpretation, movement model, and landing classifier are renderer-independent TypeScript modules so their behavior and constants can be carried to a future SpriteKit implementation. PixiJS receives only calculated view state; browser pointer, sound, vibration, and visibility APIs are isolated in adapters.

**Tech Stack:** Node.js 24.17.0, npm 11.13.0, Vite, TypeScript, PixiJS, Vitest, browser Pointer Events, Web Audio API.

**Spec:** `docs/superpowers/specs/2026-08-21-jang-han-byeol-web-prototype-design.md`

## Global Constraints

- Support both touch and mouse with Pointer Events; do not add separate touch/mouse state machines.
- Use only `IDLE`, `REACTING`, `HELD`, and `LANDING` as character states.
- Long Press begins at `350ms`; Tap ends inside `300ms` and `0.06H` movement; Long Press cancels after `0.10H` movement.
- HELD uses `1.08x` scale. Safe, wobble, and roll thresholds are `< 0.75H/s`, `0.75H/s..<2.0H/s`, and `>= 2.0H/s`; clamp toss speed to `3.0H/s` and distance to `1.2H`.
- Use `deltaTime` in seconds everywhere outside test fixtures; never advance behavior by a fixed frame count.
- Preserve `design-assets/reference/jang-han-byeol-base.png`; copy it to `public/assets/character/jang-han-byeol-base.png` for web use.
- The final HOME has no visible menu, text, button, tutorial, gesture hint, HP, currency, egg, furniture, or alternate character selector.
- Use warm off-white HOME, subtle paper grain, one soft ellipse shadow, one default character, and no background scene objects.
- Do not add React, a physics engine, external audio assets, analytics, storage, server code, or account code.
- Default output must work in current Chrome and iPhone Safari; reduce rotation, elastic overshoot, squash, and roll amplitude under `prefers-reduced-motion: reduce`.
- Tests must exercise core logic without importing PixiJS, DOM globals, or Web Audio globals.

---

## File Structure

```text
package.json                                      # npm scripts and runtime/dev dependencies
vite.config.ts                                    # Vite dev/build settings
tsconfig.json                                     # strict TypeScript compiler options
index.html                                        # canvas host only; no product UI
public/assets/character/jang-han-byeol-base.png   # runtime copy of canonical source art
src/main.ts                                       # creates and disposes the application
src/styles.css                                    # full-viewport HOME and reduced-motion styling
src/domain/types.ts                               # renderer-independent domain types
src/domain/config.ts                              # all initial interaction constants
src/domain/state-machine.ts                       # four-state transition rules and timers
src/domain/motion.ts                              # vector, bounds, follow, toss, and landing logic
src/domain/character-controller.ts                # combines state, motion, and input samples
src/adapters/pointer-controller.ts                # Pointer Events -> CharacterInput adapter
src/adapters/feedback-controller.ts               # safe Web Audio + optional vibration adapter
src/view/home-theme.ts                            # approved HOME palette constants
src/view/asset-paths.ts                           # static runtime asset names, no PixiJS import
src/view/pixi-character-view.ts                   # sprite, shadow, transforms, and visual reactions
src/view/home-scene.ts                            # Pixi application, viewport, controller/view wiring
src/view/paper-grain.ts                           # deterministic low-opacity generated paper texture
src/test/setup.ts                                 # Vitest setup with no DOM requirement
src/domain/state-machine.test.ts                  # transition tests
src/domain/motion.test.ts                         # deterministic motion and landing tests
src/domain/character-controller.test.ts           # gesture, interruption, and reduced-motion tests
README.md                                         # setup, build, tester-only operation notes
```

## Shared Interfaces

All later tasks use these exact types and names.

```ts
// src/domain/types.ts
export type CharacterState = 'IDLE' | 'REACTING' | 'HELD' | 'LANDING';
export type LandingKind = 'SAFE' | 'WOBBLE' | 'ROLL';
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
  reactionProgress: number;
  heldPhase: number;
}>;
```

```ts
// src/domain/character-controller.ts
export class CharacterController {
  constructor(config: CharacterConfig, viewport: Size, reducedMotion: boolean);
  receive(input: CharacterInput): void;
  snapshot(): CharacterSnapshot;
  setReducedMotion(reducedMotion: boolean): void;
  setViewport(viewport: Size): void;
}
```

## Task 1: Establish the Vite, PixiJS, and test baseline

**Files:**
- Create: `package.json`
- Create: `vite.config.ts`
- Create: `tsconfig.json`
- Create: `index.html`
- Create: `src/main.ts`
- Create: `src/styles.css`
- Create: `src/test/setup.ts`
- Create: `src/test/smoke.test.ts`
- Create: `public/assets/character/jang-han-byeol-base.png`
- Create: `README.md`

**Interfaces:**
- Consumes: canonical art at `design-assets/reference/jang-han-byeol-base.png`.
- Produces: `npm run dev`, `npm test`, and `npm run build` commands; an empty, full-viewport canvas host with no product UI.

- [x] **Step 1: Add npm metadata and commands**

  Create `package.json` with these scripts and dependency categories. Use currently resolved npm versions when installing; do not hand-pin unverified version numbers.

  ```json
  {
    "name": "jang-han-byeol-web-toy",
    "private": true,
    "version": "0.1.0",
    "type": "module",
    "scripts": {
      "dev": "vite",
      "build": "tsc --noEmit && vite build",
      "test": "vitest run",
      "test:watch": "vitest"
    },
    "dependencies": { "pixi.js": "latest" },
    "devDependencies": {
      "@types/node": "latest",
      "typescript": "latest",
      "vite": "latest",
      "vitest": "latest"
    }
  }
  ```

- [x] **Step 2: Add the initial failing smoke test**

  Create `src/test/smoke.test.ts`:

  ```ts
  import { describe, expect, it } from 'vitest';
  import { homeBackground } from '../view/home-theme';

  describe('home theme', () => {
    it('uses the approved warm off-white HOME background', () => {
      expect(homeBackground).toBe(0xf7f3ea);
    });
  });
  ```

- [x] **Step 3: Install dependencies and run the failing test**

  Run:

  ```bash
  npm install
  npm test
  ```

  Expected: FAIL because `src/view/home-theme.ts` does not exist.

- [x] **Step 4: Implement the smallest app shell and theme module**

  Create `src/view/home-theme.ts`:

  ```ts
  export const homeBackground = 0xf7f3ea;
  export const characterInk = 0x24211f;
  export const shadowColor = 0x372d23;
  ```

  Create `index.html` with exactly one `<main id="app"></main>` body child and load `/src/main.ts` as a module. Create `src/main.ts` to import `./styles.css` and set `document.title = '장한별 키우기'`; do not render product copy into `#app`.

  Create `src/styles.css` with these required declarations:

  ```css
  :root { background: #f7f3ea; color: #24211f; font-family: system-ui, sans-serif; }
  html, body { width: 100%; min-height: 100%; margin: 0; overflow: hidden; }
  body { min-height: 100dvh; display: grid; place-items: center; touch-action: none; user-select: none; -webkit-user-select: none; }
  #app { width: min(100vw, 480px); height: 100dvh; overflow: hidden; }
  canvas { display: block; width: 100%; height: 100%; }
  ```

  Create `tsconfig.json`:

  ```json
  {
    "compilerOptions": {
      "target": "ES2022",
      "useDefineForClassFields": true,
      "module": "ESNext",
      "lib": ["ES2022", "DOM", "DOM.Iterable"],
      "skipLibCheck": true,
      "moduleResolution": "Bundler",
      "allowImportingTsExtensions": false,
      "verbatimModuleSyntax": true,
      "noEmit": true,
      "strict": true,
      "noUnusedLocals": true,
      "noUnusedParameters": true,
      "noFallthroughCasesInSwitch": true
    },
    "include": ["src", "vite.config.ts"]
  }
  ```

  Create `vite.config.ts`:

  ```ts
  import { defineConfig } from 'vitest/config';

  export default defineConfig({
    test: {
      environment: 'node',
      include: ['src/**/*.test.ts'],
      setupFiles: ['./src/test/setup.ts'],
    },
  });
  ```

  Create `src/test/setup.ts` with exactly `export {};` so tests run without browser global setup. Create `README.md` with only `# 장한별 키우기 웹 프로토타입`; Task 6 expands it after the application works.

- [x] **Step 5: Copy the canonical runtime art without changing the source**

  Run:

  ```bash
  mkdir -p public/assets/character
  cp design-assets/reference/jang-han-byeol-base.png public/assets/character/jang-han-byeol-base.png
  ```

  Verify that the source and copied file have equal SHA-256 digests:

  ```bash
  shasum -a 256 design-assets/reference/jang-han-byeol-base.png public/assets/character/jang-han-byeol-base.png
  ```

- [x] **Step 6: Run the test and build baseline**

  Run:

  ```bash
  npm test
  npm run build
  ```

  Expected: the smoke test passes and Vite emits `dist/` without a TypeScript error.

- [x] **Step 7: Commit the tooling baseline**

  ```bash
  git add package.json package-lock.json vite.config.ts tsconfig.json index.html src public/assets/character/jang-han-byeol-base.png README.md
  git commit -m "feat: scaffold web interaction toy"
  ```

## Task 2: Implement renderer-independent types, constants, and state machine

**Files:**
- Create: `src/domain/types.ts`
- Create: `src/domain/config.ts`
- Create: `src/domain/state-machine.ts`
- Create: `src/domain/state-machine.test.ts`

**Interfaces:**
- Consumes: `CharacterState`, `LandingKind`, and `CharacterInput` definitions from `src/domain/types.ts`.
- Produces: `CharacterConfig`, `CharacterStateMachine`, `transitionToReacting(atMs)`, `transitionToHeld(atMs)`, `transitionToLanding(kind, atMs)`, and `tick(atMs)` for `CharacterController`.

- [x] **Step 1: Write failing transition tests**

  Create `src/domain/state-machine.test.ts`:

  ```ts
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
  ```

- [x] **Step 2: Run the state-machine test to verify it fails**

  Run:

  ```bash
  npx vitest run src/domain/state-machine.test.ts
  ```

  Expected: FAIL because `./state-machine` does not exist.

- [x] **Step 3: Define the stable types and initial constants**

  Implement all types in the Shared Interfaces section. In `src/domain/config.ts`, export this exact shape:

  ```ts
  export type CharacterConfig = Readonly<{
    longPressMs: number;
    tapMaxMs: number;
    tapMaxDistanceInHeights: number;
    longPressCancelDistanceInHeights: number;
    heldScale: number;
    safeSpeedInHeightsPerSecond: number;
    wobbleSpeedInHeightsPerSecond: number;
    maxTossSpeedInHeightsPerSecond: number;
    maxTossDistanceInHeights: number;
    reactionDurationSeconds: number;
    glareDurationSeconds: number;
    characterHeightRatio: number;
  }>;

  export const defaultCharacterConfig: CharacterConfig = {
    longPressMs: 350,
    tapMaxMs: 300,
    tapMaxDistanceInHeights: 0.06,
    longPressCancelDistanceInHeights: 0.10,
    heldScale: 1.08,
    safeSpeedInHeightsPerSecond: 0.75,
    wobbleSpeedInHeightsPerSecond: 2.0,
    maxTossSpeedInHeightsPerSecond: 3.0,
    maxTossDistanceInHeights: 1.2,
    reactionDurationSeconds: 0.6,
    glareDurationSeconds: 0.5,
    characterHeightRatio: 0.28,
  };
  ```

- [x] **Step 4: Implement the state machine with explicit durations**

  Implement `CharacterStateMachine` so that:

  ```ts
  transitionToReacting(atMs: number): void
  transitionToHeld(atMs: number): void
  transitionToLanding(kind: LandingKind, atMs: number): void
  tick(atMs: number): void
  get state(): CharacterState
  get landingKind(): LandingKind | null
  ```

  Use `0.18s` for SAFE, `0.45s` for WOBBLE, and `0.95s + glareDurationSeconds` for ROLL. `tick()` transitions only REACTING and LANDING to IDLE once their deadline is reached. HELD has no deadline.

- [x] **Step 5: Run the state-machine test to verify it passes**

  Run:

  ```bash
  npx vitest run src/domain/state-machine.test.ts
  ```

  Expected: PASS, 3 tests.

- [x] **Step 6: Commit pure state logic**

  ```bash
  git add src/domain/types.ts src/domain/config.ts src/domain/state-machine.ts src/domain/state-machine.test.ts
  git commit -m "feat: add character state machine"
  ```

## Task 3: Implement deterministic motion and landing classification

**Files:**
- Create: `src/domain/motion.ts`
- Create: `src/domain/motion.test.ts`

**Interfaces:**
- Consumes: `Bounds`, `LandingKind`, `Point`, `Size`, and `CharacterConfig`.
- Produces: `clampPoint(point, bounds)`, `calculateVelocity(samples)`, `classifyLanding(speed, characterHeight, config)`, `limitToss(velocity, characterHeight, config)`, and `createBounds(viewport, characterHeight)`.

- [x] **Step 1: Write failing motion tests**

  Create `src/domain/motion.test.ts`:

  ```ts
  import { describe, expect, it } from 'vitest';
  import { defaultCharacterConfig } from './config';
  import { clampPoint, classifyLanding, limitToss } from './motion';

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
  });
  ```

- [x] **Step 2: Run the motion test to verify it fails**

  Run:

  ```bash
  npx vitest run src/domain/motion.test.ts
  ```

  Expected: FAIL because `./motion` does not exist.

- [x] **Step 3: Implement vector operations and bounds helpers**

  Implement the following exact functions in `src/domain/motion.ts`:

  ```ts
  export function magnitude(vector: Point): number;
  export function distance(a: Point, b: Point): number;
  export function clampPoint(point: Point, bounds: Bounds): Point;
  export function createBounds(viewport: Size, characterHeight: number): Bounds;
  export function calculateVelocity(samples: ReadonlyArray<{ point: Point; atMs: number }>): Point;
  export function classifyLanding(speed: number, characterHeight: number, config: CharacterConfig): LandingKind;
  export function limitToss(velocity: Point, characterHeight: number, config: CharacterConfig): Point;
  export function moveToward(current: Point, target: Point, followRate: number, deltaSeconds: number): Point;
  ```

  `calculateVelocity` must use the oldest and newest of at most the latest five samples, return `{ x: 0, y: 0 }` for a non-positive time delta, and express result in pixels per second. `createBounds` must use a horizontal margin of `0.35 * characterHeight` and a vertical margin of `0.50 * characterHeight`, so the sprite stays visibly inside HOME at all viewport sizes.

- [x] **Step 4: Add landing motion test coverage before wiring a view**

  Append this test:

  ```ts
  import { calculateVelocity } from './motion';

  it('uses recent pointer samples to calculate pixels per second', () => {
    expect(calculateVelocity([
      { point: { x: 10, y: 20 }, atMs: 0 },
      { point: { x: 110, y: 20 }, atMs: 100 },
    ])).toEqual({ x: 1000, y: 0 });
  });
  ```

- [x] **Step 5: Run motion tests to verify they pass**

  Run:

  ```bash
  npx vitest run src/domain/motion.test.ts
  ```

  Expected: PASS, 4 tests.

- [x] **Step 6: Commit deterministic motion**

  ```bash
  git add src/domain/motion.ts src/domain/motion.test.ts
  git commit -m "feat: add character motion model"
  ```

## Task 4: Implement the controller, gesture recognition, and interruption recovery

**Files:**
- Create: `src/domain/character-controller.ts`
- Create: `src/domain/character-controller.test.ts`

**Interfaces:**
- Consumes: all Task 2 and Task 3 types and helpers.
- Produces: the `CharacterController` interface declared in Shared Interfaces and a snapshot valid for a PixiJS view on every tick.

- [x] **Step 1: Write failing controller tests**

  Create `src/domain/character-controller.test.ts`:

  ```ts
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
  });
  ```

- [x] **Step 2: Run the controller tests to verify they fail**

  Run:

  ```bash
  npx vitest run src/domain/character-controller.test.ts
  ```

  Expected: FAIL because `./character-controller` does not exist.

- [x] **Step 3: Implement controller input sequencing**

  Implement `CharacterController` with these rules:

  ```text
  POINTER_DOWN: save initial point/time and clear samples.
  POINTER_MOVE before HELD: mark gesture cancelled when distance > 0.10H.
  TICK while pointer is down and uncancelled: enter HELD at 350ms.
  POINTER_UP before HELD: enter REACTING only when elapsed <= 300ms and travel <= 0.06H.
  POINTER_MOVE while HELD: keep the latest five samples and update held target.
  POINTER_UP while HELD: calculate/clamp velocity, classify landing, transition to LANDING.
  POINTER_CANCEL or INTERRUPTED: clear pointer state and velocity, clamp position, transition to IDLE.
  VIEWPORT_CHANGED: recalculate character height/bounds and clamp position.
  ```

  On every `TICK`, advance state machine timers and produce state-specific animation values using time in seconds: `heldPhase`, `rotationRadians`, `verticalOffset`, and `reactionProgress`. Use lower amplitudes in reduced-motion mode, but do not change any state transition or landing classification.

- [x] **Step 4: Add landing, resize, and reduced-motion tests**

  Append these tests:

  ```ts
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
  ```

- [x] **Step 5: Run controller tests to verify they pass**

  Run:

  ```bash
  npx vitest run src/domain/character-controller.test.ts
  ```

  Expected: PASS, 6 tests.

- [x] **Step 6: Commit controller behavior**

  ```bash
  git add src/domain/character-controller.ts src/domain/character-controller.test.ts
  git commit -m "feat: add gesture driven character controller"
  ```

## Task 5: Add PixiJS HOME rendering and browser adapters

**Files:**
- Create: `src/view/paper-grain.ts`
- Create: `src/view/asset-paths.ts`
- Create: `src/view/pixi-character-view.ts`
- Create: `src/view/home-scene.ts`
- Create: `src/adapters/pointer-controller.ts`
- Create: `src/adapters/feedback-controller.ts`
- Modify: `src/main.ts`
- Modify: `src/styles.css`

**Interfaces:**
- Consumes: `CharacterController`, `CharacterSnapshot`, `homeBackground`, `/assets/character/jang-han-byeol-base.png`.
- Produces: `createHomeScene(host: HTMLElement): Promise<{ destroy(): void }>` and an interaction surface that does not expose DOM event details to the domain layer.

- [x] **Step 1: Add a failing app-level smoke test for the view contract**

  Create `src/view/home-scene.test.ts`:

  ```ts
  import { describe, expect, it } from 'vitest';
  import { getCharacterAssetPath } from './asset-paths';

  describe('HOME scene assets', () => {
    it('uses the copied web asset rather than the archived source path', () => {
      expect(getCharacterAssetPath()).toBe('/assets/character/jang-han-byeol-base.png');
    });
  });
  ```

- [x] **Step 2: Run the view smoke test to verify it fails**

  Run:

  ```bash
  npx vitest run src/view/home-scene.test.ts
  ```

  Expected: FAIL because `./asset-paths` does not exist.

- [x] **Step 3: Implement the PixiJS character view**

  `PixiCharacterView` must create one sprite from `/assets/character/jang-han-byeol-base.png` and one low-opacity ellipse shadow. It must expose:

  ```ts
  export class PixiCharacterView {
    constructor(texture: Texture, characterHeight: number);
    update(snapshot: CharacterSnapshot, reducedMotion: boolean): void;
    resize(characterHeight: number): void;
    destroy(): void;
  }
  ```

  Set the sprite anchor to `(0.5, 1)` so `snapshot.position` is the foot point. In `update`, apply `position`, `scale`, `rotationRadians`, `verticalOffset`, and a shadow scale/alpha that responds subtly to vertical offset. Never render text, buttons, decorative furniture, or a visible floor line.

- [x] **Step 4: Implement HOME scene and paper grain**

  Create `src/view/asset-paths.ts`:

  ```ts
  export function getCharacterAssetPath(): string {
    return '/assets/character/jang-han-byeol-base.png';
  }
  ```

  `createHomeScene(host)` must create a Pixi Application with the current PixiJS async initialization flow (`const app = new Application(); await app.init({ background: homeBackground, resizeTo: host, antialias: true })`), append `app.canvas` to `host`, use `homeBackground`, add a deterministic procedural grain layer at 2–4% opacity, initialize a `CharacterController` centered near the lower middle, and run one ticker that calls `controller.receive({ type: 'TICK', deltaSeconds, atMs: performance.now() })` before updating `PixiCharacterView`.

  Export:

  ```ts
  export async function createHomeScene(host: HTMLElement): Promise<{ destroy(): void }>;
  ```

  Use `ResizeObserver` to call `controller.setViewport()` and the view resize method. Store and disconnect the observer in `destroy()`.

- [x] **Step 5: Implement browser input and feedback adapters**

  `PointerController` must attach `pointerdown`, `pointermove`, `pointerup`, and `pointercancel` to the canvas; call `setPointerCapture()` on a successful pointer down; map `clientX/clientY` through the canvas bounding rectangle to scene coordinates; and call `preventDefault()` only for active character pointer interactions. Listen to `window.blur` and `document.visibilitychange` to send `INTERRUPTED`.

  `FeedbackController` must expose:

  ```ts
  export class FeedbackController {
    unlock(): void;
    playHeld(): void;
    playSafeLanding(): void;
    playFastLanding(): void;
    vibrate(pattern: number | number[]): void;
  }
  ```

  Lazily create an `AudioContext` inside `unlock()`, use short gain-envelope oscillators for each sound, and catch all audio/vibration failures without throwing. Call `unlock()` on the first pointer interaction only. Map state changes from the last snapshot to the three playback methods; request `navigator.vibrate(8)` for HELD and SAFE, and `navigator.vibrate(16)` for WOBBLE/ROLL only when available.

- [x] **Step 6: Wire the app and reduced-motion presentation**

  Change `src/main.ts` so it gets `#app`, calls `createHomeScene(app)`, and registers `beforeunload` to call `destroy()`. In `src/styles.css`, ensure the canvas fills the visual viewport and add:

  ```css
  @media (prefers-reduced-motion: reduce) {
    canvas { image-rendering: auto; }
  }
  ```

  Read `window.matchMedia('(prefers-reduced-motion: reduce)').matches` when constructing HOME, and listen for change events to call `controller.setReducedMotion()`.

- [x] **Step 7: Run unit tests and production build**

  Run:

  ```bash
  npm test
  npm run build
  ```

  Expected: all domain and view smoke tests pass; `dist/` exists; no test imports PixiJS except the production-only view modules.

- [x] **Step 8: Commit the visual prototype**

  ```bash
  git add src/main.ts src/styles.css src/view src/adapters
  git commit -m "feat: render interactive Jang Han-byeol HOME"
  ```

## Task 6: Document, manually verify, and finalize the web prototype

**Files:**
- Modify: `README.md`
- Modify: `docs/superpowers/plans/2026-08-21-jang-han-byeol-web-prototype.md`

**Interfaces:**
- Consumes: completed npm scripts and application behavior from Tasks 1–5.
- Produces: tester-facing setup and verification instructions without adding product-facing instructions to the app UI.

- [x] **Step 1: Write the manual browser verification checklist in README**

  Add these exact sections: `Requirements`, `Run locally`, `Build`, `Automated tests`, `Tester instructions`, and `Manual verification`.

  Include these commands:

  ```bash
  npm install
  npm run dev
  npm test
  npm run build
  ```

  Under `Tester instructions`, state that the facilitator must hand over the page without explaining controls and observe the first two minutes. Under `Manual verification`, include every item below:

  ```markdown
  - [ ] Chrome mouse: Tap, 350ms Long Press, Drag, gentle release, fast release
  - [ ] iPhone Safari touch: Tap, Long Press, Drag, gentle release, fast release
  - [ ] Character remains inside HOME after drag, toss, resize, and orientation change
  - [ ] Canvas does not scroll or select text during character interaction
  - [ ] Refresh starts with one default character and no visible UI
  - [ ] Browser sound policy failure does not block interaction before or after first input
  - [ ] Reduced Motion preserves state changes while reducing visual amplitude
  - [ ] No egg, currency, HP, work/rest item, furniture, tutorial, label, or selector appears
  ```

- [x] **Step 2: Run complete automated verification**

  Run:

  ```bash
  npm test
  npm run build
  git diff --check
  ```

  Expected: test command exits `0`, build command exits `0`, and `git diff --check` has no output.

- [ ] **Step 3: Run the local server and verify the core flow in a browser**

  Run:

  ```bash
  npm run dev -- --host 127.0.0.1
  ```

  Verify at the local URL that the empty HOME loads, one character idles, long press enters HELD, gentle release is SAFE, fast release produces WOBBLE or ROLL, and no visible UI appears.

- [x] **Step 4: Mark completed plan steps and commit documentation**

  Replace only completed Task 1–6 checkboxes with `- [x]` after their associated verification passes. Then run:

  ```bash
  git add README.md docs/superpowers/plans/2026-08-21-jang-han-byeol-web-prototype.md
  git commit -m "docs: add web prototype verification guide"
  ```
