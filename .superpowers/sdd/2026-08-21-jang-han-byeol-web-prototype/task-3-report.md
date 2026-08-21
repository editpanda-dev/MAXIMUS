# Task 3 report: deterministic motion helpers

## Implementation summary

Implemented `src/domain/motion.ts` with renderer-independent vector, bounds, velocity, landing, toss, and follow helpers:

- `magnitude`, `distance`, and `clampPoint`
- `createBounds` using 0.35H horizontal and 0.50H vertical margins
- `calculateVelocity` using the oldest/newest samples from only the latest five, in pixels per second
- `classifyLanding` using exact SAFE `< 0.75H/s`, WOBBLE `< 2.0H/s`, ROLL `>= 2.0H/s` thresholds
- `limitToss` capped at 3.0H/s
- `moveToward` with a clamped time-scaled follow amount

Added focused coverage in `src/domain/motion.test.ts`, including zero/non-positive time handling, latest-five sampling, bounds, and follow behavior.

## RED/GREEN evidence

RED: `npx vitest run src/domain/motion.test.ts` failed because `./motion` did not exist (`Cannot find module './motion'`).

GREEN: after implementation, the focused suite passed with 7 tests.

## Files changed

- `src/domain/motion.ts`
- `src/domain/motion.test.ts`

## Verification output

- `npx vitest run src/domain/motion.test.ts`: 1 file, 7 tests passed
- `npm test`: 3 files, 11 tests passed
- `npm run build`: TypeScript check and Vite production build passed

## Self-review

- API signatures match the brief and use existing domain types/config.
- No DOM, PixiJS, Web Audio, or renderer imports were added.
- Inputs are not mutated; velocity and toss calculations return new points.
- Exact threshold boundary behavior and maximum toss speed are covered.

## Concerns

`createBounds` follows the specified margin formula directly; extremely small viewports smaller than the character margins can necessarily produce an inverted usable area because the character cannot physically fit within both margins.
