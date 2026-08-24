import type { RawReward } from '../game/types';
import type { GameSession } from './session';

const COMBO_WINDOW_SECONDS = 1.8;

export type BaseTapInput = Readonly<{ type: 'TAP'; atSeconds: number }>;
export type BaseTapSnapshot = Readonly<{ combo: number; comboTier: number; rawReward: RawReward }>;

export class BaseTapSession implements GameSession<BaseTapInput, BaseTapSnapshot> {
  private nowSeconds: number;
  private lastTapSeconds: number | null = null;
  private combo = 0;
  private reward: RawReward = { xp: 0, stardust: 0 };

  constructor(readonly level: number, startedAtSeconds: number) {
    this.nowSeconds = startedAtSeconds;
  }

  receive(input: BaseTapInput): void {
    this.nowSeconds = Math.max(this.nowSeconds, input.atSeconds);
    this.combo = this.lastTapSeconds !== null && input.atSeconds - this.lastTapSeconds <= COMBO_WINDOW_SECONDS
      ? this.combo + 1
      : 1;
    this.lastTapSeconds = input.atSeconds;
    const comboBonus = Math.floor((this.combo - 1) / 10);
    this.reward = {
      xp: this.reward.xp + 1,
      stardust: this.reward.stardust + 1 + comboBonus,
    };
  }

  tick(deltaSeconds: number): void {
    this.nowSeconds += Math.max(0, deltaSeconds);
    if (this.lastTapSeconds !== null && this.nowSeconds - this.lastTapSeconds > COMBO_WINDOW_SECONDS) {
      this.combo = 0;
    }
  }

  snapshot(): BaseTapSnapshot {
    return {
      combo: this.combo,
      comboTier: Math.floor(this.combo / 10),
      rawReward: this.reward,
    };
  }

  isComplete(): boolean {
    return false;
  }

  finish(): RawReward {
    return this.reward;
  }
}
