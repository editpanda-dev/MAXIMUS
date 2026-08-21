# Task 6 report: web prototype verification guide

## Changes

- Expanded `README.md` into Korean-friendly tester documentation with the six required sections, setup/build/test commands, facilitator guidance, and the eight required unchecked manual-verification items.
- Marked completed plan work for Tasks 1–5 and the documented/automated portions of Task 6 as complete. Task 6 Step 3 remains unchecked because full browser/device gesture verification has not been completed.
- Added `node_modules/` and `dist/` to `.gitignore`; dependencies and static build output remain local-only and static hosts must build from source.

## Exact verification

- `npm test` — passed: 5 test files and 19 tests.
- `npm run build` — passed: `tsc --noEmit` and Vite production build completed successfully.
- `git diff --check` — passed with no output.

## Commit

`docs: add web prototype verification guide`

## Remaining manual limitations

The README checklist is intentionally entirely unchecked. Existing local Chrome evidence confirms an empty warm HOME, a single character, no visible UI or opaque white asset box, desktop drag movement, and no response to a background click. It does not establish the full Chrome gesture matrix, iPhone Safari behavior, resize/orientation containment, browser sound-policy resilience, Reduced Motion behavior, or facilitator-based two-minute observation. Those require a separate device/facilitator pass.
