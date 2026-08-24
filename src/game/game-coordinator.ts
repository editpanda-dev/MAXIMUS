import { buyEgg } from './egg-service';
import { settleReward } from './reward-service';
import { selectCharacter } from './progress';
import type { AccountProgress, CharacterId, EggPurchaseResult, SettledReward } from './types';
import { BaseTapSession } from '../games/base-tap-session';
import { PogoSession, type PogoSnapshot } from '../games/pogo-session';
import { UdonSession, type UdonSnapshot } from '../games/udon-session';

export interface ProgressStore {
  load(): AccountProgress;
  save(progress: AccountProgress): void;
}

export type Screen = 'HOME' | 'PLAYING' | 'RESULT' | 'EGG_REVEAL';
export type ActiveGameSnapshot = PogoSnapshot | UdonSnapshot | null;
export type GameCoordinatorSnapshot = Readonly<{
  screen: Screen;
  progress: AccountProgress;
  activeCharacterId: CharacterId | null;
  game: ActiveGameSnapshot;
  result: SettledReward | null;
  egg: EggPurchaseResult | null;
  baseCombo: number;
}>;

type ActiveGame = Readonly<{
  characterId: 'pogo' | 'udon';
  session: PogoSession | UdonSession;
}>;

export class GameCoordinator {
  private progress: AccountProgress;
  private screen: Screen = 'HOME';
  private baseSession = new BaseTapSession(1, 0);
  private activeGame: ActiveGame | null = null;
  private result: SettledReward | null = null;
  private egg: EggPurchaseResult | null = null;

  constructor(private readonly store: ProgressStore) {
    this.progress = store.load();
    this.baseSession = new BaseTapSession(this.progress.roster.base.level, 0);
  }

  snapshot(): GameCoordinatorSnapshot {
    return {
      screen: this.screen,
      progress: this.progress,
      activeCharacterId: this.activeGame?.characterId ?? null,
      game: this.activeGame?.session.snapshot() ?? null,
      result: this.result,
      egg: this.egg,
      baseCombo: this.baseSession.snapshot().combo,
    };
  }

  tap(atSeconds: number): void {
    if (this.screen === 'HOME' && this.progress.selectedCharacterId === 'base') {
      const before = this.baseSession.finish();
      this.baseSession.receive({ type: 'TAP', atSeconds });
      const after = this.baseSession.finish();
      const settled = settleReward(this.progress, 'base', {
        xp: after.xp - before.xp,
        stardust: after.stardust - before.stardust,
      });
      this.progress = settled.progress;
      this.store.save(this.progress);
      return;
    }
    if (this.screen === 'PLAYING' && this.activeGame !== null) {
      this.activeGame.session.receive({ type: 'TAP' });
    }
  }

  tick(deltaSeconds: number): void {
    this.baseSession.tick(deltaSeconds);
    if (this.screen !== 'PLAYING' || this.activeGame === null) return;
    this.activeGame.session.tick(deltaSeconds);
    if (!this.activeGame.session.isComplete()) return;
    this.finishActiveGame();
  }

  startSelectedGame(seed: number, viewportWidth = 393, groundY = 700): void {
    if (this.progress.selectedCharacterId === 'base') return;
    this.result = null;
    this.egg = null;
    this.activeGame = this.progress.selectedCharacterId === 'pogo'
      ? { characterId: 'pogo', session: new PogoSession({ seed, viewportWidth, groundY }) }
      : { characterId: 'udon', session: new UdonSession({ seed }) };
    this.screen = 'PLAYING';
  }

  buyEgg(roll: () => number): EggPurchaseResult {
    const result = buyEgg(this.progress, roll);
    this.progress = result.progress;
    this.store.save(this.progress);
    this.egg = result;
    this.result = null;
    this.screen = 'EGG_REVEAL';
    return result;
  }

  selectCharacter(characterId: CharacterId): void {
    this.progress = selectCharacter(this.progress, characterId);
    this.store.save(this.progress);
    this.baseSession = new BaseTapSession(this.progress.roster.base.level, 0);
    this.screen = 'HOME';
    this.activeGame = null;
    this.result = null;
    this.egg = null;
  }

  dismissResult(): void {
    this.screen = 'HOME';
    this.activeGame = null;
    this.result = null;
    this.egg = null;
  }

  private finishActiveGame(): void {
    if (this.activeGame === null) return;
    const settled = settleReward(this.progress, this.activeGame.characterId, this.activeGame.session.finish());
    this.progress = settled.progress;
    this.store.save(this.progress);
    this.result = settled;
    this.screen = 'RESULT';
  }
}
