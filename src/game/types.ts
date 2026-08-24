export type CharacterId = 'base' | 'pogo' | 'udon';

export type RosterEntry = Readonly<{
  owned: boolean;
  level: number;
}>;

export type RawReward = Readonly<{
  xp: number;
  stardust: number;
}>;

export type AccountProgress = Readonly<{
  schemaVersion: 1;
  xp: number;
  level: number;
  xpIntoLevel: number;
  stardust: number;
  selectedCharacterId: CharacterId;
  roster: Readonly<Record<CharacterId, RosterEntry>>;
}>;

export type CharacterDefinition = Readonly<{
  id: CharacterId;
  name: string;
  assetPath: string;
  playLabel: string;
}>;

export type EggOutcome = 'NEW' | 'LEVEL_UP' | 'MAX_LEVEL_REFUND';

export type EggPurchaseResult = Readonly<{
  progress: AccountProgress;
  characterId: CharacterId;
  outcome: EggOutcome;
}>;

export type SettledReward = Readonly<{
  progress: AccountProgress;
  xp: number;
  stardust: number;
}>;
