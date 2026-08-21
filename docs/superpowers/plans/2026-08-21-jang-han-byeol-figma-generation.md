# Jang Han-byeol Figma Generation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 승인된 애착 인터랙션 토이 PRD와 원본 디자인 자산을 Figma 생성 도구가 오해 없이 재현할 수 있는 실행용 프롬프트를 만들고 검증한다.

**Architecture:** 프롬프트는 PRD를 재서술하지 않고 Figma에서 생성할 페이지, 프레임, 컴포넌트, 상태, 모션 명세를 직접 지시한다. 원본 PNG 3개의 역할과 금지 사항을 분리해 캐릭터 재해석을 막고, 생성 후 체크리스트로 PRD 누락을 판정한다.

**Tech Stack:** Figma, Figma AI/Make 프롬프트, Markdown, PNG 레퍼런스 자산

**Spec:** `docs/superpowers/specs/2026-08-21-jang-han-byeol-interaction-toy-design.md`

## Global Constraints

- 대상은 iPhone 세로형 단일 HOME이다.
- 흑백 선화와 따뜻한 미색 배경을 사용한다.
- 상시 UI, 소품, 이름표, 메뉴, 튜토리얼, 조작 문구, 손가락 힌트를 생성하지 않는다.
- 장한별 1명과 `IDLE`, `REACTING`, `HELD`, `LANDING` 상태만 다룬다.
- 웃기고 귀여움 80%, 살짝 귀찮아하는 반응 20%를 유지한다.
- 부상, 고통, 강한 충돌, 장시간 쓰러짐 연출을 생성하지 않는다.
- `jang-han-byeol-base.png`의 인물 비율, 헤어, 의상, 선 스타일을 변경하지 않는다.
- `jang-han-byeol-drag-motion-guide.png`의 8프레임 순서와 허우적 리듬을 기준으로 삼는다.
- `jang-al-byeol-egg.png`는 향후 참조로만 보관하고 이번 HOME 프레임에 배치하지 않는다.

---

### Task 1: Figma 생성 프롬프트 작성

**Files:**
- Create: `design-prompts/figma/jang-han-byeol-interaction-toy-prompt.md`
- Read: `docs/superpowers/specs/2026-08-21-jang-han-byeol-interaction-toy-design.md`
- Read: `design-assets/reference/README.md`

**Interfaces:**
- Consumes: PRD의 범위, 4개 상태, Figma 페이지 구조, 감각 피드백 명세와 PNG 원본 3개
- Produces: Figma AI/Make에 복사해 사용할 수 있는 단일 Markdown 프롬프트

- [ ] **Step 1: 프롬프트 파일의 구조를 작성한다**

  순서를 `Role → Attached assets → Product intent → File structure → Screen specification → Component states → Motion → Handoff annotations → Do not generate → Final checklist` 로 고정한다.

- [ ] **Step 2: 원본 자산 매핑을 명시한다**

  다음 파일명과 역할을 그대로 포함한다.

  ```text
  jang-han-byeol-base.png = canonical character reference
  jang-han-byeol-drag-motion-guide.png = canonical 8-frame HELD motion reference
  jang-al-byeol-egg.png = archive-only reference; do not place in this prototype
  ```

- [ ] **Step 3: Figma 페이지와 프레임 생성 지시를 작성한다**

  `00 Foundations`, `01 Character Assets`, `02 Held Motion`, `03 Landing States`, `04 HOME Prototype`, `05 iOS Handoff` 페이지와 각 페이지의 필수 프레임을 정확히 나열한다.

- [ ] **Step 4: 상태와 전환 명세를 작성한다**

  다음 상태 흐름을 누락 없이 포함한다.

  ```text
  IDLE --Tap--> REACTING --complete--> IDLE
  IDLE/REACTING --Long Press--> HELD --Release--> LANDING --complete--> IDLE
  LANDING --Long Press--> HELD
  ```

- [ ] **Step 5: 시각·모션·피드백 수치를 작성한다**

  Long Press `0.3~0.4s`, HELD scale `1.05~1.1x`, Tap response `0.4~0.8s`, HELD playback `1.0~1.5x`, glare `0.5s`와 햄틱·사운드 시점을 명시한다.

- [ ] **Step 6: 금지 생성 항목을 작성한다**

  다음 문구를 포함한다.

  ```text
  Do not add economy, HP, jobs, rest objects, egg, menus, labels, tutorial copy,
  gesture hints, decorative furniture, colorized character art, dialogue,
  injury, pain, hard collision, or long knockdown reactions.
  ```

- [ ] **Step 7: 프롬프트 누락 검사를 실행한다**

  Run:

  ```bash
  rg -n '00 Foundations|01 Character Assets|02 Held Motion|03 Landing States|04 HOME Prototype|05 iOS Handoff|IDLE|REACTING|HELD|LANDING|jang-han-byeol-base.png|jang-han-byeol-drag-motion-guide.png|jang-al-byeol-egg.png|Do not' design-prompts/figma/jang-han-byeol-interaction-toy-prompt.md
  ```

  Expected: 모든 페이지, 상태, 자산 파일명, 금지 지시가 출력된다.

- [ ] **Step 8: 프롬프트 작성을 커밋한다**

  ```bash
  git add design-prompts/figma/jang-han-byeol-interaction-toy-prompt.md
  git commit -m "docs: add Figma generation prompt"
  ```

### Task 2: Figma 생성 결과 검수

**Files:**
- Create: `design-reviews/figma/jang-han-byeol-interaction-toy-review.md`
- Read: `design-prompts/figma/jang-han-byeol-interaction-toy-prompt.md`
- Read: `docs/superpowers/specs/2026-08-21-jang-han-byeol-interaction-toy-design.md`

**Interfaces:**
- Consumes: Task 1의 Figma 생성 프롬프트와 생성된 Figma 파일 URL
- Produces: 페이지·상태·자산 충실도·iOS 핸드오프 통과 여부가 기록된 리뷰

- [ ] **Step 1: 생성 전 원본 3개를 Figma 생성 입력에 첨부한다**

  ```text
  design-assets/reference/jang-han-byeol-base.png
  design-assets/reference/jang-han-byeol-drag-motion-guide.png
  design-assets/reference/jang-al-byeol-egg.png
  ```

- [ ] **Step 2: Task 1의 프롬프트를 수정 없이 1회 실행한다**

  Expected: 6개 페이지와 iPhone 세로형 HOME, 4개 상태, 8프레임 HELD 모션 명세가 생성된다.

- [ ] **Step 3: 검수 문서에 각 항목을 PASS/FAIL로 기록한다**

  ```markdown
  - [ ] Six required pages exist
  - [ ] HOME is portrait, empty, warm off-white, and UI-free
  - [ ] Character silhouette and clothing match the canonical base asset
  - [ ] HELD contains eight ordered frames matching the motion guide
  - [ ] IDLE, REACTING, HELD, and LANDING are all represented
  - [ ] Safe landing and short-toss reactions are visually distinct
  - [ ] No egg appears in HOME
  - [ ] No economy, HP, job, rest, menu, label, or tutorial element appears
  - [ ] iOS handoff page includes timing, easing, haptic, sound, and export names
  ```

- [ ] **Step 4: FAIL이 있으면 오류만 수정하는 보정 프롬프트를 리뷰 문서에 작성한다**

  보정 프롬프트는 통과한 항목을 재생성하지 말고, FAIL 항목의 페이지·프레임 이름과 수정 결과를 명시한다.

- [ ] **Step 5: 모든 항목 PASS 후 리뷰를 커밋한다**

  ```bash
  git add design-reviews/figma/jang-han-byeol-interaction-toy-review.md
  git commit -m "docs: record Figma interaction toy review"
  ```

