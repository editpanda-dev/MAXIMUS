import type { RawReward } from '../game/types';

export interface GameSession<Input, Snapshot> {
  receive(input: Input): void;
  tick(deltaSeconds: number): void;
  snapshot(): Snapshot;
  isComplete(): boolean;
  finish(): RawReward;
}
