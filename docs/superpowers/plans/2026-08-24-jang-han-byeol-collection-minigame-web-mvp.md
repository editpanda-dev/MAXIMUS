# 장한별 수집·미니게임 웹 MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 기본·스카이콩콩·튀김우동 한별을 수집하고 선택해 서로 다른 Tap 기반 방식으로 별가루와 계정 경험치를 얻는 웹 MVP를 만든다.

**Architecture:** PixiJS와 DOM은 화면·입력·연출만 담당하고, 컬렉션·알·보상·세 미니게임 규칙은 브라우저를 모르는 순수 TypeScript 모델로 구현한다. `GameCoordinator`가 선택한 한별의 세션을 시작하고, 세션의 원시 결과를 `RewardService` 하나를 통해 계정 상태에 반영하며 버전이 있는 로컬 저장소에 기록한다.

**Tech Stack:** Vite 8, TypeScript, PixiJS 8, Vitest 4, Browser LocalStorage

**Spec:** `docs/superpowers/specs/2026-08-24-jang-han-byeol-collection-minigame-design.md`

## Global Constraints

- 모바일 우선 웹이며, 이후 iOS Swift/SpriteKit으로 옮길 수 있도록 도메인 로직은 PixiJS·DOM·LocalStorage를 직접 참조하지 않는다.
- 모든 게임 시간·물리는 프레임 수가 아니라 초 단위 `deltaSeconds`로 진행한다.
- 첫 알 풀은 기본·스카이콩콩·튀김우동 한별이며 각각 가중치 1, 알 가격은 100 별가루다.
- 기본 한별은 시작 시 Lv.1 보유하고 알 풀에도 포함하며, 중복은 자동 레벨업한다.
- 최고 레벨은 10, 별가루 보상 계수는 `1 + 0.10 × (level - 1)`이며 XP·난이도에는 적용하지 않는다.
- 기본 한별은 순수 Tap, 스카이콩콩은 단일 점프 Tap, 튀김우동은 타이밍 Tap만 사용한다. 방치 수익·Long Press·Drag는 새 HOME 루프에 넣지 않는다.
- 모든 생산 코드 변경은 먼저 그 동작을 검증하는 실패 테스트를 추가하고, 실패를 확인한 다음 최소 구현을 작성한다.
- 기존 `CharacterController` 기반의 단일 인터랙션 토이는 삭제하지 않고 새 게임 셸에서 사용하지 않게 둔다. 이번 MVP의 HOME은 새 `GameCoordinator`를 기준으로 한다.

---

## File Structure

| 경로 | 책임 |
| --- | --- |
| `src/game/types.ts` | 계정, 캐릭터, 알, 보상, 화면 상태의 공통 타입 |
| `src/game/balance.ts` | 가격·확률·레벨·점수 상수와 보상 계수 함수 |
| `src/game/catalog.ts` | 세 한별의 메타데이터와 알 풀 조회 |
| `src/game/progress.ts` | 불변 계정 상태 생성, 캐릭터 선택, XP·별가루 반영 |
| `src/game/egg-service.ts` | 잔액 검증, 시드 난수 선택, 신규 획득·중복 레벨업 |
| `src/game/reward-service.ts` | 원시 게임 결과에 레벨 계수를 적용하고 계정에 반영 |
| `src/game/game-coordinator.ts` | HOME/PLAYING/RESULT 화면 전환과 세션·저장 조정 |
| `src/games/session.ts` | 공통 `GameSession`·입력·스냅샷 인터페이스 |
| `src/games/base-tap-session.ts` | 기본 한별 Tap·콤보·원시 보상 |
| `src/games/pogo-session.ts` | 점프·장애물·충돌·거리·회피 결과 |
| `src/games/udon-session.ts` | 주문·재료 도착·Perfect/Good/Miss·콤보·45초 종료 |
| `src/adapters/local-progress-store.ts` | 버전 있는 LocalStorage 직렬화·손상 복구 |
| `src/view/game-scene.ts` | Pixi 앱과 HUD/캐릭터/미니게임 렌더러를 묶는 수명주기 |
| `src/view/game-shell.ts` | 컬렉션·알·결과의 DOM 오버레이와 접근 가능한 버튼 |
| `src/view/game-views/*.ts` | Base Tap/Pogo/Udon 스냅샷을 Pixi Graphics로 그리는 뷰 |
| `src/main.ts`, `src/styles.css` | 새 게임 셸 부팅과 모바일 UI 스타일 |

## Task 1: 수집·계정 도메인 기반

**Files:**
- Create: `src/game/types.ts`
- Create: `src/game/balance.ts`
- Create: `src/game/catalog.ts`
- Create: `src/game/progress.ts`
- Test: `src/game/progress.test.ts`

**Interfaces:**
- Produces `CharacterId = 'base' | 'pogo' | 'udon'`, `AccountProgress`, `RosterEntry`, `createInitialProgress()`, `grantRawReward()`, `selectCharacter()`, `levelRewardMultiplier()`.
- `AccountProgress` contains `schemaVersion`, `xp`, `level`, `xpIntoLevel`, `stardust`, `selectedCharacterId`, and `roster: Record<CharacterId, RosterEntry>`.

- [x] **Step 1: Write the failing account-progress tests**

```ts
import { describe, expect, it } from 'vitest';
import { createInitialProgress, grantRawReward, selectCharacter } from './progress';

describe('progress', () => {
  it('starts with only the base Hanbyeol at level one', () => {
    const progress = createInitialProgress();
    expect(progress.selectedCharacterId).toBe('base');
    expect(progress.roster.base).toEqual({ owned: true, level: 1 });
    expect(progress.roster.pogo.owned).toBe(false);
  });

  it('adds XP and stardust without changing the selected character', () => {
    const before = createInitialProgress();
    const after = grantRawReward(before, { xp: 12, stardust: 8 });
    expect(after.xp).toBe(12);
    expect(after.stardust).toBe(8);
    expect(after.selectedCharacterId).toBe('base');
  });

  it('rejects selection of an unowned Hanbyeol', () => {
    expect(() => selectCharacter(createInitialProgress(), 'pogo')).toThrow('not owned');
  });
});
```

- [x] **Step 2: Run the progress test to verify it fails**

Run: `npm test -- src/game/progress.test.ts`

Expected: FAIL because `./progress` does not exist.

- [x] **Step 3: Implement the minimum pure account model**

```ts
export function createInitialProgress(): AccountProgress {
  return {
    schemaVersion: 1, xp: 0, level: 1, xpIntoLevel: 0, stardust: 0,
    selectedCharacterId: 'base',
    roster: {
      base: { owned: true, level: 1 },
      pogo: { owned: false, level: 0 },
      udon: { owned: false, level: 0 },
    },
  };
}
```

Define `grantRawReward()` as an immutable update, define a deterministic XP threshold function in `balance.ts`, and make `selectCharacter()` throw `Error('Character is not owned')` for unavailable IDs.

- [x] **Step 4: Run the focused and full test suites**

Run: `npm test -- src/game/progress.test.ts && npm test`

Expected: PASS.

- [x] **Step 5: Commit the domain foundation**

```bash
git add src/game/types.ts src/game/balance.ts src/game/catalog.ts src/game/progress.ts src/game/progress.test.ts
git commit -m "feat: add account progression model"
```

## Task 2: 알 구매와 중복 레벨업

**Files:**
- Create: `src/game/egg-service.ts`
- Test: `src/game/egg-service.test.ts`
- Modify: `src/game/types.ts`
- Modify: `src/game/balance.ts`

**Interfaces:**
- Consumes `AccountProgress`, `CharacterId`, and `MAX_CHARACTER_LEVEL` from Task 1.
- Produces `buyEgg(progress: AccountProgress, roll: () => number): EggPurchaseResult` where `EggPurchaseResult` contains `progress`, `characterId`, and `outcome: 'NEW' | 'LEVEL_UP' | 'MAX_LEVEL_REFUND'`.

- [x] **Step 1: Write failing purchase tests with deterministic rolls**

```ts
it('spends 100 stardust and unlocks the rolled unowned Hanbyeol', () => {
  const progress = grantRawReward(createInitialProgress(), { xp: 0, stardust: 100 });
  const result = buyEgg(progress, () => 0.4);
  expect(result.characterId).toBe('pogo');
  expect(result.outcome).toBe('NEW');
  expect(result.progress.stardust).toBe(0);
  expect(result.progress.roster.pogo).toEqual({ owned: true, level: 1 });
});

it('levels up an owned duplicate without creating another roster entry', () => {
  const first = buyEgg(grantRawReward(createInitialProgress(), { xp: 0, stardust: 200 }), () => 0.4);
  const second = buyEgg(first.progress, () => 0.4);
  expect(second.outcome).toBe('LEVEL_UP');
  expect(second.progress.roster.pogo.level).toBe(2);
});

it('does not spend currency when the player cannot afford an egg', () => {
  expect(() => buyEgg(createInitialProgress(), () => 0)).toThrow('Not enough stardust');
});
```

- [x] **Step 2: Run the egg test to verify it fails**

Run: `npm test -- src/game/egg-service.test.ts`

Expected: FAIL because `buyEgg` is not exported.

- [x] **Step 3: Implement the weighted, deterministic egg service**

Use the ordered candidate list `['base', 'pogo', 'udon']` with weights `[1, 1, 1]`. Convert the injected roll in `[0, 1)` to a candidate by cumulative weight; clamp a value of `1` to the final candidate for defensive browser adapters. Deduct `EGG_COST = 100` before adding the result. At Lv.10, keep the level at 10 and add `MAX_LEVEL_REFUND` from `balance.ts`.

- [x] **Step 4: Run focused and full tests**

Run: `npm test -- src/game/egg-service.test.ts && npm test`

Expected: PASS.

- [x] **Step 5: Commit egg logic**

```bash
git add src/game/egg-service.ts src/game/egg-service.test.ts src/game/types.ts src/game/balance.ts
git commit -m "feat: add random egg collection"
```

## Task 3: 공통 보상과 기본 한별 Tap 세션

**Files:**
- Create: `src/games/session.ts`
- Create: `src/games/base-tap-session.ts`
- Create: `src/game/reward-service.ts`
- Test: `src/games/base-tap-session.test.ts`
- Test: `src/game/reward-service.test.ts`

**Interfaces:**
- Produces `GameSession<Input, Snapshot>` with `receive(input)`, `tick(deltaSeconds)`, `snapshot()`, `isComplete()`, and `finish()`.
- Produces `BaseTapSession`, constructed as `new BaseTapSession(level, nowSeconds)` and accepting `{ type: 'TAP'; atSeconds: number }`.
- Produces `settleReward(progress, characterId, rawReward): SettledReward`.

- [x] **Step 1: Write failing Tap-session and reward tests**

```ts
it('creates a combo when taps arrive inside the 1.8 second window', () => {
  const session = new BaseTapSession(1, 0);
  session.receive({ type: 'TAP', atSeconds: 0 });
  session.receive({ type: 'TAP', atSeconds: 1.7 });
  expect(session.snapshot().combo).toBe(2);
});

it('expires the combo after 1.8 seconds without a tap', () => {
  const session = new BaseTapSession(1, 0);
  session.receive({ type: 'TAP', atSeconds: 0 });
  session.tick(1.81);
  expect(session.snapshot().combo).toBe(0);
});

it('applies a character level multiplier to stardust but not XP', () => {
  const progress = createInitialProgress();
  const settled = settleReward(progress, 'base', { xp: 4, stardust: 10 }, 5);
  expect(settled.xp).toBe(4);
  expect(settled.stardust).toBe(14);
});
```

- [x] **Step 2: Run the two test files and verify failure**

Run: `npm test -- src/games/base-tap-session.test.ts src/game/reward-service.test.ts`

Expected: FAIL because session and reward modules do not exist.

- [x] **Step 3: Implement raw Tap scoring and centralized settlement**

Each valid Tap contributes raw `{ xp: 1, stardust: 1 }`. Preserve a `combo` counter and expose a presentation-only combo tier every 10 taps. `BaseTapSession.finish()` returns accumulated raw reward but does not mutate account state. `settleReward()` uses `Math.floor(raw.stardust * levelRewardMultiplier(level))`, retains XP unchanged, then calls `grantRawReward()`.

- [x] **Step 4: Run focused and full tests**

Run: `npm test -- src/games/base-tap-session.test.ts src/game/reward-service.test.ts && npm test`

Expected: PASS.

- [x] **Step 5: Commit Tap and reward modules**

```bash
git add src/games/session.ts src/games/base-tap-session.ts src/games/base-tap-session.test.ts src/game/reward-service.ts src/game/reward-service.test.ts
git commit -m "feat: add base tap earnings"
```

## Task 4: 스카이콩콩 러너 도메인

**Files:**
- Create: `src/games/pogo-session.ts`
- Test: `src/games/pogo-session.test.ts`
- Modify: `src/games/session.ts`
- Modify: `src/game/balance.ts`

**Interfaces:**
- Produces `PogoSession`, constructed as `new PogoSession({ seed, viewportWidth, groundY })`.
- Accepts `{ type: 'TAP' }`, exposes snapshot fields `playerY`, `verticalVelocity`, `distance`, `avoids`, `obstacles`, and `ended`.
- `finish()` returns raw `{ xp, stardust }` based on distance and avoided obstacles.

- [x] **Step 1: Write failing runner behavior tests**

```ts
it('jumps from the ground and ignores a second tap while airborne', () => {
  const session = new PogoSession({ seed: 7, viewportWidth: 393, groundY: 700 });
  session.receive({ type: 'TAP' });
  const firstVelocity = session.snapshot().verticalVelocity;
  session.receive({ type: 'TAP' });
  expect(firstVelocity).toBeLessThan(0);
  expect(session.snapshot().verticalVelocity).toBe(firstVelocity);
});

it('ends when an obstacle overlaps the player hitbox', () => {
  const session = new PogoSession({ seed: 7, viewportWidth: 393, groundY: 700 });
  session.debugPlaceObstacle({ kind: 'shrimp', x: 96, width: 32, height: 36 });
  session.tick(0.01);
  expect(session.isComplete()).toBe(true);
});

it('counts an obstacle as avoided exactly once after it leaves the screen', () => {
  const session = new PogoSession({ seed: 7, viewportWidth: 393, groundY: 700 });
  session.debugPlaceObstacle({ kind: 'garlic', x: 0, width: 32, height: 36 });
  session.tick(0.1);
  expect(session.snapshot().avoids).toBe(1);
});
```

- [x] **Step 2: Run the runner test to verify it fails**

Run: `npm test -- src/games/pogo-session.test.ts`

Expected: FAIL because `PogoSession` does not exist.

- [x] **Step 3: Implement deterministic physics and obstacle generation**

Use seconds-based gravity, a single negative jump velocity, player `x = viewportWidth * 0.24`, and axis-aligned hitboxes smaller than the visible character. Add one seeded linear-congruential random generator local to the session; use it only to pick obstacle kind and a spawn gap constrained by `MIN_SPAWN_GAP_SECONDS` and `MAX_SPAWN_GAP_SECONDS`. Keep `debugPlaceObstacle()` exported only for deterministic tests. Mark each obstacle `counted` before incrementing `avoids`.

- [x] **Step 4: Run focused and full tests**

Run: `npm test -- src/games/pogo-session.test.ts && npm test`

Expected: PASS.

- [x] **Step 5: Commit the runner domain**

```bash
git add src/games/pogo-session.ts src/games/pogo-session.test.ts src/games/session.ts src/game/balance.ts
git commit -m "feat: add pogo runner session"
```

## Task 5: 튀김우동 타이밍 세션 도메인

**Files:**
- Create: `src/games/udon-session.ts`
- Test: `src/games/udon-session.test.ts`
- Modify: `src/games/session.ts`
- Modify: `src/game/balance.ts`

**Interfaces:**
- Produces `UdonSession`, constructed as `new UdonSession({ seed })`.
- Accepts `{ type: 'TAP' }`, exposes `remainingSeconds`, `currentIngredient`, `ingredientProgress`, `combo`, `completedBowls`, and `lastJudgement`.
- Uses `Judgement = 'PERFECT' | 'GOOD' | 'MISS'` and completes exactly at 45 seconds.

- [x] **Step 1: Write failing timing-session tests**

```ts
it('scores PERFECT when the active ingredient is inside the narrow timing window', () => {
  const session = new UdonSession({ seed: 3 });
  session.debugSetIngredientProgress(0.5);
  session.receive({ type: 'TAP' });
  expect(session.snapshot().lastJudgement).toBe('PERFECT');
  expect(session.snapshot().combo).toBe(1);
});

it('resets combo on a miss without ending the 45 second session', () => {
  const session = new UdonSession({ seed: 3 });
  session.debugSetIngredientProgress(0.5);
  session.receive({ type: 'TAP' });
  session.debugSetIngredientProgress(0.1);
  session.receive({ type: 'TAP' });
  expect(session.snapshot().lastJudgement).toBe('MISS');
  expect(session.snapshot().combo).toBe(0);
  expect(session.isComplete()).toBe(false);
});

it('ends exactly after 45 seconds', () => {
  const session = new UdonSession({ seed: 3 });
  session.tick(45);
  expect(session.isComplete()).toBe(true);
});
```

- [x] **Step 2: Run the timing test to verify it fails**

Run: `npm test -- src/games/udon-session.test.ts`

Expected: FAIL because `UdonSession` does not exist.

- [x] **Step 3: Implement order, timing windows, and raw scoring**

Generate each bowl with a seeded rotation of `['noodles', 'broth', 'tempura', 'garnish']`. Move the active ingredient from 0 to 1 using `deltaSeconds`; resolve a Tap in the central window as Perfect, the surrounding window as Good, and all other input as Miss. Perfect/Good advance the recipe; the fourth success increments `completedBowls` and begins a new seeded order. A Miss resets the combo and starts the same ingredient again. `finish()` returns raw XP and stardust from bowls, Perfect count, and peak combo.

- [x] **Step 4: Run focused and full tests**

Run: `npm test -- src/games/udon-session.test.ts && npm test`

Expected: PASS.

- [x] **Step 5: Commit the timing game**

```bash
git add src/games/udon-session.ts src/games/udon-session.test.ts src/games/session.ts src/game/balance.ts
git commit -m "feat: add udon timing session"
```

## Task 6: 저장소와 게임 조정자

**Files:**
- Create: `src/adapters/local-progress-store.ts`
- Create: `src/game/game-coordinator.ts`
- Test: `src/adapters/local-progress-store.test.ts`
- Test: `src/game/game-coordinator.test.ts`

**Interfaces:**
- Produces `LocalProgressStore.load(): AccountProgress` and `save(progress: AccountProgress): void`.
- Produces `GameCoordinator` with `snapshot()`, `tap(atSeconds)`, `startSelectedGame(seed)`, `tick(deltaSeconds)`, `buyEgg(roll)`, `selectCharacter(id)`, and `dismissResult()`.
- `GameCoordinatorSnapshot.screen` is `'HOME' | 'PLAYING' | 'RESULT' | 'EGG_REVEAL'`.

- [x] **Step 1: Write failing store and coordinator tests**

```ts
it('falls back to the initial progress when saved JSON is invalid', () => {
  const storage = fakeStorage({ 'jang-han-byeol.progress.v1': '{bad json' });
  expect(new LocalProgressStore(storage).load()).toEqual(createInitialProgress());
});

it('settles a completed pogo session once and persists the reward', () => {
  const store = new MemoryProgressStore(createInitialProgress());
  const coordinator = new GameCoordinator(store);
  coordinator.unlockForTest('pogo');
  coordinator.selectCharacter('pogo');
  coordinator.startSelectedGame(12);
  coordinator.finishActiveGameForTest({ xp: 5, stardust: 10 });
  expect(coordinator.snapshot().screen).toBe('RESULT');
  expect(store.load().stardust).toBe(10);
});
```

- [x] **Step 2: Run store and coordinator tests to verify failure**

Run: `npm test -- src/adapters/local-progress-store.test.ts src/game/game-coordinator.test.ts`

Expected: FAIL because storage and coordinator modules do not exist.

- [x] **Step 3: Implement versioned persistence and one-way settlement**

Use the key `jang-han-byeol.progress.v1`. Parse JSON defensively, require the current schema version and valid roster IDs, otherwise return `createInitialProgress()`. `GameCoordinator` owns the only mutable in-memory progress reference; it saves after reward settlement, egg result, and selection. Guard `finish()` with an active-session token so repeated ticks cannot grant the same reward twice.

- [x] **Step 4: Run focused and full tests**

Run: `npm test -- src/adapters/local-progress-store.test.ts src/game/game-coordinator.test.ts && npm test`

Expected: PASS.

- [x] **Step 5: Commit persistence and coordination**

```bash
git add src/adapters/local-progress-store.ts src/adapters/local-progress-store.test.ts src/game/game-coordinator.ts src/game/game-coordinator.test.ts
git commit -m "feat: coordinate games and local progress"
```

## Task 7: Pixi/DOM 게임 셸과 세 한별 화면

**Files:**
- Create: `src/view/game-scene.ts`
- Create: `src/view/game-shell.ts`
- Create: `src/view/game-views/base-tap-view.ts`
- Create: `src/view/game-views/pogo-view.ts`
- Create: `src/view/game-views/udon-view.ts`
- Create: `src/view/game-views/result-view.ts`
- Create: `src/view/game-display.ts`
- Create: `src/view/game-display.test.ts`
- Modify: `src/main.ts`
- Modify: `src/styles.css`
- Modify: `src/view/asset-paths.ts`
- Create: `public/assets/character/jang-han-byeol-pogo-stick.png`
- Create: `public/assets/character/jang-han-byeol-tempura-udon.png`

**Interfaces:**
- Consumes only `GameCoordinator.snapshot()` and game session snapshots from Tasks 1–6.
- Produces `createGameShell(host: HTMLElement): Promise<{ destroy(): void }>`.
- DOM buttons call coordinator methods; Pixi canvas Tap calls only `coordinator.tap(performance.now() / 1000)`.

- [x] **Step 1: Write the failing pure HOME-display test**

```ts
it('describes the base Hanbyeol as an immediate tap earner', () => {
  const display = buildHomeDisplay(createInitialProgress(), 4);
  expect(display.characterName).toBe('기본 한별');
  expect(display.actionLabel).toBe('한별이를 탭해 별가루 받기');
  expect(display.comboLabel).toBe('COMBO 4');
});
```

- [x] **Step 2: Run the HOME-display test to verify it fails**

Run: `npm test -- src/view/game-display.test.ts`

Expected: FAIL because `game-display` does not exist.

- [x] **Step 3: Implement the smallest playable UI**

Replace `createHomeScene()` booting in `main.ts` with `createGameShell()`. Build a compact DOM HUD containing level/XP, stardust, selected character name, collection button, and egg button. Render collection as a bottom sheet with one selectable card per roster item; unavailable cards are visible but disabled. Copy the two approved derived PNGs into `public/assets/character/` and add asset paths. Keep the current base asset crop for base HOME; render simple Pixi `Graphics` shapes for shrimp, garlic, timing ring, ingredients, and result particles so no unapproved art is invented. Set canvas input to run Base Tap directly on HOME and start Pogo/Udon via an explicit button next to their selected character.

- [x] **Step 4: Connect update and teardown behavior**

In `game-scene.ts`, create one Pixi `Application`, forward ticker `deltaMS / 1000` to the coordinator, re-render the active view from snapshot, and remove ticker/listeners/canvas in `destroy()`. Use `ResizeObserver` to keep the scene responsive. Do not import DOM storage, Pixi, or browser globals into any `src/game/` or `src/games/` module.

- [x] **Step 5: Run focused tests, full tests, and production build**

Run: `npm test -- src/view/game-display.test.ts && npm test && npm run build`

Expected: PASS.

- [x] **Step 6: Commit the playable shell**

```bash
git add src/view src/main.ts src/styles.css public/assets/character
git commit -m "feat: add playable collection game shell"
```

## Task 8: README, browser verification, and final quality gate

**Files:**
- Modify: `README.md`
- Modify: `docs/superpowers/specs/2026-08-24-jang-han-byeol-collection-minigame-design.md`

**Interfaces:**
- No new production interfaces.

- [x] **Step 1: Add executable player verification instructions**

Add this checklist to `README.md`:

```markdown
- [ ] 기본 한별: 빠르게 탭하면 콤보가 보이고 별가루·XP가 증가한다.
- [ ] 알: 별가루 100개 이상일 때만 구매되며, 세 한별 중 하나가 나온다.
- [ ] 중복: 같은 한별이 나오면 레벨이 정확히 1 오른다.
- [ ] 스카이콩콩: 탭 점프만 가능하고 새우·마늘 충돌 시 한 번만 정산된다.
- [ ] 튀김우동: 45초 후 한 번만 정산되고 Perfect/Good/Miss가 표시된다.
- [ ] 새로고침 후 별가루·XP·컬렉션·선택 한별이 유지된다.
```

- [x] **Step 2: Mark the implemented design scope accurately**

Change the collection design document status from `사용자 승인 완료, 구현 계획 전 검토` to `웹 MVP 구현 완료, 사용자 검증 대기` only after all automated and manual checks in this task pass.

- [x] **Step 3: Run final automated checks**

Run: `npm test && npm run build && git diff --check`

Expected: all tests pass, build exits 0, and whitespace check has no output.

- [x] **Step 4: Verify each player flow in Chrome**

Run: `npm run dev -- --host 127.0.0.1`

Verify the six README checklist items manually using the browser. Stop the local server after recording the result.

- [x] **Step 5: Commit verification documentation**

```bash
git add README.md docs/superpowers/specs/2026-08-24-jang-han-byeol-collection-minigame-design.md
git commit -m "docs: add collection game verification guide"
```
