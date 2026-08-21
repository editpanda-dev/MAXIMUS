# 장한별 애착 인터랙션 토이: 웹 프로토타입 설계

- 문서 상태: 사용자 검토 대기
- 작성일: 2026-08-21
- 기준 PRD: `docs/superpowers/specs/2026-08-21-jang-han-byeol-interaction-toy-design.md`
- 대상: 모바일 터치와 데스크톱 마우스를 모두 지원하는 반응형 웹

## 1. 목적

이 웹 프로토타입은 아무 설명과 보상이 없어도 사용자가 Long Press로 장한별을 집는 법을 스스로 발견하고, 허우적거리는 반응이 귀여워 반복해서 집고 놓는지 검증한다.

웹 구현은 폐기용 목업이 아니라 향후 iOS SpriteKit 구현으로 옮길 상태, 입력, 움직임 규칙의 레퍼런스다.

## 2. 범위

### 2.1 포함

- 따뜻한 미색의 단일 HOME
- 기본형 장한별 1명
- `IDLE`, `REACTING`, `HELD`, `LANDING` 네 상태
- Tap, Long Press, Drag, Drop, 짧은 던지기
- 안전 착지, 휘청, 짧은 데굴 반응
- Pointer Events 기반 터치·마우스 공통 입력
- 반응형 세로 HOME
- Web Audio API 합성 효과음
- 지원 브라우저의 선택적 진동
- `prefers-reduced-motion` 대응
- 로컬 개발 서버와 정적 빌드

### 2.2 제외

- 장알별, 부화, 재화, 체력, 업무, 휴식
- 우동·푸들·슬랑이·스카이콩콩 변형 선택 UI
- 다중 캐릭터
- 상시 UI, 메뉴, 튜토리얼, 조작 문구, 손가락 힌트
- 실제 8프레임 투명 스프라이트 교체
- 서버, 계정, 저장, 분석, 결제, 광고
- 강한 충돌, 부상, 고통, 장시간 쓰러짐

## 3. 기술 선택

- Vite
- TypeScript
- PixiJS
- Vitest
- 브라우저 Pointer Events
- Web Audio API

React, 외부 물리 엔진, 상태 관리 라이브러리, 외부 사운드 자산은 사용하지 않는다.

## 4. 아키텍처

```text
Browser Pointer Events
        ↓
CharacterInput
        ↓
CharacterStateMachine
        ↓
MotionModel + CharacterConfig
        ↓
PixiCharacterView
        ↓
AudioFeedback + OptionalVibration
```

핵심 도메인 로직은 PixiJS, DOM, Web Audio API를 직접 알지 못한다. 렌더러와 브라우저 입출력은 순수 TypeScript 모델의 결과를 사용한다.

### 4.1 주요 단위

- `CharacterConfig`: 시간, 속도, 감쇠, 투척 상한, 스케일, 모션 강도
- `CharacterInput`: 도메인이 사용하는 포인터 입력 이벤트
- `CharacterStateMachine`: 네 상태의 전환
- `MotionModel`: 위치, 속도, 가속도, 경계, 감쇠, 착지 분류
- `CharacterController`: 입력·상태·움직임 조정
- `PixiCharacterView`: 스프라이트, 그림자, 스케일, 회전, 기울기
- `PointerController`: Pointer Events를 `CharacterInput`으로 변환
- `FeedbackController`: 사운드와 진동 호출
- `HomeScene`: 배경, viewport, 컨트롤러, View 조립

### 4.2 iOS 대응

| Web | iOS |
|---|---|
| `HomeScene` | `SKScene` |
| `PixiCharacterView` | `SKSpriteNode` |
| `CharacterStateMachine` | Swift 상태 머신 |
| `MotionModel` | Swift 움직임 모델 |
| `PointerController` | `UITouch`/`SKScene` 입력 어댑터 |
| `FeedbackController` | `UIFeedbackGenerator` + 오디오 |

모든 시간과 움직임은 프레임 개수가 아니라 초 단위 `deltaTime`을 사용한다.

## 5. 화면과 반응형 레이아웃

- 모바일은 viewport 전체를 HOME으로 사용한다.
- 데스크톱은 세로 HOME을 중앙에 배치하고 최대 폭을 제한한다.
- HOME은 따뜻한 미색, 미세한 종이 질감, 부드러운 타원 그림자만 가진다.
- 캐릭터 기본 크기는 HOME 높이의 25~30%다.
- 초기 위치는 하단 중앙 근처다.
- resize, 화면 회전, viewport 변경 후 위치를 안전 영역 안으로 보정한다.
- 실제 HOME에는 버튼, 문구, 지표, 힌트를 추가하지 않는다.

## 6. 상태와 입력

### 6.1 상태 전환

```text
IDLE --Tap--> REACTING --complete--> IDLE
IDLE --LongPress--> HELD
REACTING --LongPress--> HELD
HELD --Release--> LANDING --complete--> IDLE
LANDING --LongPress--> HELD
```

### 6.2 입력 규칙

- Pointer Down 후 0.35초 이내에 종료되고 이동이 Tap 허용 거리 이하면 Tap이다.
- Pointer Down이 0.35초 유지되면 HELD로 전환한다.
- HELD 진입 전 이동이 Long Press 취소 거리를 넘으면 캐릭터 입력을 취소한다.
- HELD에서는 최근 포인터 샘플의 위치와 시간으로 Release 속도를 계산한다.
- Pointer capture를 사용해 포인터가 캐릭터 영역을 벗어나도 HELD를 유지한다.
- `pointercancel`, `visibilitychange`, `blur`는 투척 속도를 폐기하고 캐릭터를 안전하게 IDLE로 복귀시킨다.
- 이미지 기본 Drag와 HOME 영역의 스크롤·선택을 방지한다.

Tap 허용 거리, Long Press 취소 거리, 착지 속도 임계값은 `CharacterConfig`에서 집중 관리하고 실제 기기 테스트로 조정한다.

### 6.3 초깃값

화면 크기와 iOS 이식성에 영향을 적게 받도록 거리와 속도는 캐릭터 높이 `H` 기준으로 표현한다.

| 항목 | 초깃값 |
|---|---:|
| Long Press 시간 | `0.35s` |
| Tap 최대 시간 | `0.30s` |
| Tap 최대 이동 | `0.06H` |
| Long Press 취소 이동 | `0.10H` |
| HELD 스케일 | `1.08x` |
| 안전 착지 | Release 속도 `< 0.75H/s` |
| 휘청 착지 | Release 속도 `0.75H/s 이상, 2.0H/s 미만` |
| 데굴 착지 | Release 속도 `2.0H/s 이상` |
| 투척 속도 상한 | `3.0H/s` |
| 투척 이동 거리 상한 | `1.2H` |
| 째려보기 | `0.5s` |

이 값은 관찰 테스트 전의 구현 기준이며, 조정할 때는 상태 분류 경계와 제품 검증 결과를 함께 기록한다.

## 7. 상태별 표현

### 7.1 IDLE

- 천천히 좌우로 걷는다.
- 무작위 시점에 멈추고 방향을 바꾼다.
- 이동 범위는 HOME 안전 영역으로 제한한다.

### 7.2 REACTING

- Tap 후 0.4~0.8초 동안 작은 회전, 스케일, 움찔 움직임으로 반응한다.
- 반응 중 Tap은 추가로 쌓지 않는다.
- Long Press는 반응을 끊고 HELD로 전환한다.

### 7.3 HELD

- 캐릭터를 기본 크기의 1.08배로 확대한다.
- 목표 포인터를 즉시 복사하지 않고 감쇠된 보간으로 약간 늦게 따라와 말랑한 무게감을 만든다.
- 현재 기본형 PNG에 회전, 기울기, 스케일, 상하 움직임을 조합해 허우적거림을 표현한다.
- 드래그 속도가 빠를수록 허우적 주기와 강도를 상한 안에서 높인다.
- 향후 8프레임 투명 스프라이트가 준비되면 `PixiCharacterView`만 교체한다.

### 7.4 LANDING

- 낮은 Release 속도: 안전 착지, 작은 squash, IDLE 복귀
- 중간 Release 속도: 짧은 관성 이동, 휘청, IDLE 복귀
- 높은 Release 속도: 상한 내 짧은 관성 이동, 한 번의 코믹한 데굴, 0.5초 째려보기, IDLE 복귀
- 최대 속도와 최대 이동 거리를 제한한다.
- 바닥과 좌우 경계 밖으로 나가지 않는다.

## 8. 피드백

- HELD 진입: 1.08배 확대, 작은 `톡` 합성음, 지원 기기에서 짧은 진동
- 안전 착지: 작은 squash, 부드러운 합성 착지음, 지원 기기에서 짧은 진동
- 빠른 착지: 탄성·휘청·데굴, 조금 더 높은 합성 착지음
- 사운드는 첫 사용자 입력 후에만 AudioContext를 활성화한다.
- 사운드, 진동, AudioContext가 없거나 차단되어도 예외를 밖으로 전파하지 않는다.

## 9. Reduced Motion

`prefers-reduced-motion: reduce`가 활성화되면:

- HELD 확대 폭을 줄인다.
- 회전, 탄성, squash, 데굴 강도를 줄인다.
- 상태 전환, 드래그, 안전 경계, 피드백 시점은 유지한다.

## 10. 에셋

- 원본: `design-assets/reference/jang-han-byeol-base.png`
- 웹 사용본: `public/assets/character/jang-han-byeol-base.png`

웹 사용본은 원본을 덩어쓰지 않고 빌드에서 안정적으로 참조할 별도 복사본으로 관리한다. 파생 변형 자산은 첫 웹 버전에서 사용하지 않는다.

## 11. 테스트

### 11.1 자동 테스트

- `IDLE → REACTING → IDLE`
- 0.35초 전에 HELD로 전환되지 않음
- 0.35초 Long Press 후 HELD 전환
- Release 속도별 안전 착지, 휘청, 데굴 분류
- 투척 최대 속도와 이동 거리 제한
- viewport 변경 후 위치 보정
- `pointercancel`, `visibilitychange`, `blur` 후 IDLE 복귀
- 모든 LANDING 시퀀스의 IDLE 복귀
- Reduced Motion에서 모션 강도 감소

### 11.2 브라우저 검증

- 모바일 터치와 데스크톱 마우스에서 Tap, Long Press, Drag, Release가 동작한다.
- 이미지 기본 Drag, 선택, HOME 스크롤이 캐릭터 조작을 방해하지 않는다.
- 캐릭터가 HOME 밖으로 나가지 않는다.
- 첫 사용자 입력 전 AudioContext 오류가 발생하지 않는다.
- 새로고침, resize, 화면 회전 후 정상 상태로 시작하거나 복귀한다.
- Chrome과 iPhone Safari에서 핵심 흐름을 확인한다.

### 11.3 제품 검증

- 5명 중 4명 이상이 60초 안에 Long Press를 스스로 발견한다.
- 5명 중 3명 이상이 첫 집기 후 3회 이상 반복해서 집는다.
- 5명 중 3명 이상이 놓는 속도나 방향을 바꿔 반응을 탐색한다.

## 12. 완료 조건

- `npm install`, `npm run dev`, `npm test`, `npm run build`가 명시된 환경에서 동작한다.
- 정적 빌드 결과를 일반 웹 호스팅에 배포할 수 있다.
- 핵심 상태·움직임 로직은 PixiJS와 DOM 없이 자동 테스트된다.
- 모바일 터치와 데스크톱 마우스의 핵심 흐름을 수동 검증한다.
- README에 개발·빌드·테스트 명령과 테스트 진행자용 조작법을 기록한다.
