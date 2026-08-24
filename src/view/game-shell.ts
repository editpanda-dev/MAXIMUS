import { LocalProgressStore } from '../adapters/local-progress-store';
import { characterCatalog } from '../game/catalog';
import { GameCoordinator } from '../game/game-coordinator';
import type { CharacterId } from '../game/types';
import { buildHomeDisplay } from './game-display';

export type GameShell = Readonly<{ destroy(): void }>;

function browserStore(): LocalProgressStore {
  return new LocalProgressStore(window.localStorage);
}

function randomSeed(): number {
  return Math.floor(Math.random() * 0x7fffffff);
}

function ingredientLabel(ingredient: string): string {
  return { noodles: '면', broth: '국물', tempura: '튀김', garnish: '고명' }[ingredient] ?? ingredient;
}

export function createGameShell(host: HTMLElement): GameShell {
  const coordinator = new GameCoordinator(browserStore());
  let frame = 0;
  let lastTime = performance.now();
  let destroyed = false;

  const render = (): void => {
    const snapshot = coordinator.snapshot();
    const display = buildHomeDisplay(snapshot.progress, snapshot.baseCombo);
    const progressToNext = Math.max(1, 30 + snapshot.progress.level * 20);
    const xpPercent = Math.min(100, snapshot.progress.xpIntoLevel / progressToNext * 100);

    let scene = '';
    if (snapshot.screen === 'HOME') {
      const canStart = display.characterId !== 'base';
      scene = `
        <section class="home-scene" data-character="${display.characterId}">
          <p class="scene-kicker">Lv.${snapshot.progress.roster[display.characterId].level} ${display.characterName}</p>
          <button class="character-stage" data-action="tap-character" aria-label="${display.actionLabel}">
            <span class="tap-spark">✦</span>
            <img src="${display.assetPath}" alt="${display.characterName}" />
          </button>
          <p class="action-copy">${display.actionLabel}</p>
          ${display.characterId === 'base' ? `<p class="combo">${display.comboLabel}</p>` : `
            <button class="primary-button" data-action="start-game">${display.actionLabel} 시작</button>
          `}
          ${canStart ? '<p class="sub-copy">Tap만으로 플레이해요.</p>' : '<p class="sub-copy">빠르게 탭해서 콤보 보너스를 받아요.</p>'}
        </section>`;
    } else if (snapshot.screen === 'PLAYING' && snapshot.game !== null && 'obstacles' in snapshot.game) {
      const game = snapshot.game;
      const obstacles = game.obstacles.map((obstacle) => `<span class="obstacle ${obstacle.kind}" style="left:${obstacle.x}px">${obstacle.kind === 'shrimp' ? '🦐' : '🧄'}</span>`).join('');
      scene = `
        <section class="runner-scene" data-action="play-tap">
          <p class="game-score">거리 ${game.distance} · 회피 ${game.avoids}</p>
          <div class="runner-ground"></div>
          <img class="runner-character" src="${characterCatalog.pogo.assetPath}" alt="스카이콩콩 한별" style="left:${game.playerX}px;top:${game.playerY - 130}px" />
          ${obstacles}
          <p class="game-hint">Tap해서 점프!</p>
        </section>`;
    } else if (snapshot.screen === 'PLAYING' && snapshot.game !== null && 'currentIngredient' in snapshot.game) {
      const game = snapshot.game;
      scene = `
        <section class="udon-scene" data-action="play-tap">
          <p class="game-score">${game.remainingSeconds}초 · ${game.completedBowls}그릇 · 콤보 ${game.combo}</p>
          <img class="udon-character" src="${characterCatalog.udon.assetPath}" alt="튀김우동 한별" />
          <div class="timing-track"><span class="timing-perfect">PERFECT</span><span class="ingredient-dot" style="left:${game.ingredientProgress * 100}%">${ingredientLabel(game.currentIngredient)}</span></div>
          <p class="recipe">지금 넣을 재료: <strong>${ingredientLabel(game.currentIngredient)}</strong></p>
          <p class="judgement">${game.lastJudgement ?? '탭해서 재료 넣기'}</p>
        </section>`;
    } else if (snapshot.screen === 'RESULT' && snapshot.result !== null) {
      scene = `
        <section class="modal-scene result-scene">
          <p class="scene-kicker">오늘의 정산</p>
          <h2>잘했어 한별아!</h2>
          <p class="reward">+${snapshot.result.stardust} 별가루</p>
          <p class="reward-sub">+${snapshot.result.xp} 경험치</p>
          <button class="primary-button" data-action="dismiss">HOME으로</button>
        </section>`;
    } else if (snapshot.screen === 'EGG_REVEAL' && snapshot.egg !== null) {
      const egg = snapshot.egg;
      const entry = snapshot.progress.roster[egg.characterId];
      scene = `
        <section class="modal-scene egg-scene">
          <p class="scene-kicker">장알별이 부화했어!</p>
          <img class="egg-character" src="${characterCatalog[egg.characterId].assetPath}" alt="${characterCatalog[egg.characterId].name}" />
          <h2>${characterCatalog[egg.characterId].name}</h2>
          <p>${egg.outcome === 'NEW' ? '새 한별을 만났어!' : `중복! Lv.${entry.level}로 성장했어.`}</p>
          <button class="primary-button" data-action="dismiss">확인</button>
        </section>`;
    }

    const collection = display.collection.map((entry) => `
      <button class="collection-card ${entry.owned ? '' : 'locked'}" data-character-id="${entry.id}" ${entry.owned ? '' : 'disabled'}>
        <img src="${entry.assetPath}" alt="" />
        <span>${entry.name}</span>
        <small>${entry.owned ? `Lv.${entry.level}` : '잠김'}</small>
      </button>`).join('');

    host.innerHTML = `
      <div class="game-shell">
        <header class="hud">
          <div><span>계정 Lv.${snapshot.progress.level}</span><div class="xp-bar"><i style="width:${xpPercent}%"></i></div></div>
          <strong>✦ 별가루 ${snapshot.progress.stardust}</strong>
        </header>
        ${scene}
        ${snapshot.screen === 'HOME' ? `
          <footer class="home-actions">
            <details><summary>한별 컬렉션</summary><div class="collection-list">${collection}</div></details>
            <button class="egg-button" data-action="buy-egg" ${snapshot.progress.stardust < 100 ? 'disabled' : ''}>알 뽑기 · 100 ✦</button>
          </footer>` : ''}
      </div>`;

    host.querySelector<HTMLElement>('[data-action="tap-character"]')?.addEventListener('click', () => {
      coordinator.tap(performance.now() / 1_000);
      render();
    });
    host.querySelector<HTMLElement>('[data-action="play-tap"]')?.addEventListener('click', () => coordinator.tap(performance.now() / 1_000));
    host.querySelector<HTMLElement>('[data-action="start-game"]')?.addEventListener('click', () => {
      coordinator.startSelectedGame(randomSeed(), host.clientWidth || 393, Math.max(420, host.clientHeight * 0.78));
      render();
    });
    host.querySelector<HTMLElement>('[data-action="buy-egg"]')?.addEventListener('click', () => {
      coordinator.buyEgg(Math.random);
      render();
    });
    host.querySelector<HTMLElement>('[data-action="dismiss"]')?.addEventListener('click', () => {
      coordinator.dismissResult();
      render();
    });
    host.querySelectorAll<HTMLElement>('[data-character-id]').forEach((element) => element.addEventListener('click', () => {
      coordinator.selectCharacter(element.dataset.characterId as CharacterId);
      render();
    }));
  };

  const tick = (now: number): void => {
    if (destroyed) return;
    coordinator.tick(Math.min(0.1, Math.max(0, (now - lastTime) / 1_000)));
    lastTime = now;
    render();
    frame = window.requestAnimationFrame(tick);
  };

  render();
  frame = window.requestAnimationFrame(tick);
  return {
    destroy: () => {
      destroyed = true;
      window.cancelAnimationFrame(frame);
      host.replaceChildren();
    },
  };
}
