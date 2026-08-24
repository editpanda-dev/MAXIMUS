import type { RawReward } from '../game/types';
import type { GameSession } from './session';

const SESSION_SECONDS = 45;
const PERFECT_DISTANCE = 0.08;
const GOOD_DISTANCE = 0.18;
const INGREDIENT_SPEED = 0.34;
const ingredients = ['noodles', 'broth', 'tempura', 'garnish'] as const;

export type UdonIngredient = (typeof ingredients)[number];
export type Judgement = 'PERFECT' | 'GOOD' | 'MISS';
export type UdonInput = Readonly<{ type: 'TAP' }>;
export type UdonSnapshot = Readonly<{
  remainingSeconds: number;
  currentIngredient: UdonIngredient;
  ingredientProgress: number;
  combo: number;
  peakCombo: number;
  completedBowls: number;
  lastJudgement: Judgement | null;
  ended: boolean;
}>;

export class UdonSession implements GameSession<UdonInput, UdonSnapshot> {
  private elapsedSeconds = 0;
  private ingredientProgress = 0;
  private ingredientIndex = 0;
  private combo = 0;
  private peakCombo = 0;
  private completedBowls = 0;
  private perfects = 0;
  private lastJudgement: Judgement | null = null;
  private readonly order: readonly UdonIngredient[];

  constructor({ seed }: Readonly<{ seed: number }>) {
    const offset = Math.abs(Math.floor(seed)) % ingredients.length;
    this.order = ingredients.map((_, index) => ingredients[(index + offset) % ingredients.length] ?? 'noodles');
  }

  receive(input: UdonInput): void {
    if (input.type !== 'TAP' || this.isComplete()) return;
    const distance = Math.abs(this.ingredientProgress - 0.5);
    const judgement: Judgement = distance <= PERFECT_DISTANCE
      ? 'PERFECT'
      : distance <= GOOD_DISTANCE
        ? 'GOOD'
        : 'MISS';
    this.lastJudgement = judgement;

    if (judgement === 'MISS') {
      this.combo = 0;
      this.ingredientProgress = 0;
      return;
    }

    this.combo += 1;
    this.peakCombo = Math.max(this.peakCombo, this.combo);
    if (judgement === 'PERFECT') this.perfects += 1;
    this.ingredientIndex += 1;
    this.ingredientProgress = 0;
    if (this.ingredientIndex === this.order.length) {
      this.ingredientIndex = 0;
      this.completedBowls += 1;
    }
  }

  tick(deltaSeconds: number): void {
    const delta = Math.max(0, deltaSeconds);
    this.elapsedSeconds = Math.min(SESSION_SECONDS, this.elapsedSeconds + delta);
    if (!this.isComplete()) {
      this.ingredientProgress = Math.min(1, this.ingredientProgress + INGREDIENT_SPEED * delta);
    }
  }

  snapshot(): UdonSnapshot {
    return {
      remainingSeconds: Math.max(0, Math.ceil(SESSION_SECONDS - this.elapsedSeconds)),
      currentIngredient: this.order[this.ingredientIndex] ?? 'noodles',
      ingredientProgress: this.ingredientProgress,
      combo: this.combo,
      peakCombo: this.peakCombo,
      completedBowls: this.completedBowls,
      lastJudgement: this.lastJudgement,
      ended: this.isComplete(),
    };
  }

  isComplete(): boolean {
    return this.elapsedSeconds >= SESSION_SECONDS;
  }

  finish(): RawReward {
    return {
      xp: this.completedBowls * 8 + this.perfects * 2 + this.peakCombo,
      stardust: this.completedBowls * 14 + this.perfects * 3 + Math.floor(this.peakCombo / 2),
    };
  }

  debugSetIngredientProgress(progress: number): void {
    this.ingredientProgress = Math.min(1, Math.max(0, progress));
  }
}
