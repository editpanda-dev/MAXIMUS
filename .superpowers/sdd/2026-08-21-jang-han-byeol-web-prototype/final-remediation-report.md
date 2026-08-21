# Final remediation report — Jang Han-byeol web prototype

## Commit

- Remediation implementation: `b2211718d5e27941f013334f85d5c714ead192d7` (`fix: complete interaction motion behaviors`)

## Changed files

- `src/domain/types.ts` — added renderer-independent landing stage/transform, held-flail, and HELD-transition snapshot data.
- `src/domain/config.ts`, `src/domain/motion.ts` — added renderer-independent visible-art geometry and motion constants; bounds now use the foot-anchored visible extents, maximum held scale, and vertical offsets.
- `src/domain/state-machine.ts` — ROLL now consists of a 0.45s motion window plus the configured 0.5s glare, rather than double-counting glare.
- `src/domain/character-controller.ts` — timestamp reconciliation on pointer events, retained valid pre-HELD target, delta-time landing/idle/held motion, capped toss travel, and transformed ROLL containment.
- `src/domain/motion.test.ts`, `src/domain/character-controller.test.ts` — focused regression coverage.
- `src/view/pixi-character-view.ts`, `src/view/home-scene.ts` — applies landing squash values and preserves a HELD feedback cue across an immediate post-threshold release.

## Root cause → fix

| Root cause | Fix |
| --- | --- |
| `POINTER_MOVE`/`POINTER_UP` did not advance the long-press deadline. | Reconcile the deadline on each timestamped pointer event; a monotonic `heldTransitionToken` lets HOME observe HELD even if the release immediately enters LANDING. |
| Bounds treated the foot anchor as the character. | Derive safe bounds from cropped-art width/height, held scale, rotation envelope, and vertical offsets; ROLL additionally clamps against its current transformed footprint each tick. |
| Toss jumped on release and all landing transforms were effectively the same. | Store a capped travel plan at release and integrate it over ticks; snapshots encode SAFE squash, damped WOBBLE, and one 0.45s ROLL followed by still glare. |
| IDLE and HELD samples did not drive visible movement. | Added deterministic walk/pause/reverse integration and speed-capped HELD cadence/amplitude. |
| ROLL duration included its glare twice. | Set the ROLL state motion duration to 0.45s and let the existing glare duration provide the remaining 0.5s. |

## TDD evidence

### RED

Before production changes, focused controller/motion tests failed for the intended regressions:

- Exact `350ms` release: expected `LANDING`, received `IDLE`; retained pre-HELD target: expected `x > 196`, received `196`; toss test observed a jump from `x:196` to `x:244` at `POINTER_UP`.
- Visual bounds: held top position was `119.28`, below the required full-sprite minimum `257.64`; geometry helper returned legacy left bound `70` rather than the visible-extent bound near `94.5`.
- Landing snapshot fields were `undefined`; ROLL stage was `undefined`; IDLE position and fast/slow held phase were equal.
- The final ROLL containment regression failed at `y=836.28`, beyond the transformed bottom-safe limit `793.87` before the transform-aware clamp was implemented.

### GREEN

- `npm test -- src/domain/motion.test.ts src/domain/state-machine.test.ts src/domain/character-controller.test.ts --reporter=verbose`: 25 tests passed after the first behavior pass.
- `npm test -- src/domain/character-controller.test.ts --reporter=verbose`: 17 controller tests passed after the ROLL containment regression.

## Full verification

- `npm test -- --reporter=dot` — 5 files, 30 tests passed.
- `npm run build` — succeeded (`tsc --noEmit` and Vite production build).
- `git diff --check` — no whitespace errors.

## Residual concerns

- Automated tests cover the pure domain contracts and build only. No manual iPhone Safari verification was performed in this remediation pass.
- Bounds intentionally use conservative renderer-independent cropped-art dimensions; future replacement art must update the corresponding config ratios rather than importing renderer data into the domain.
