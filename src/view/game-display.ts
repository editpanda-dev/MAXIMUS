import { characterCatalog } from '../game/catalog';
import type { AccountProgress, CharacterId } from '../game/types';

export type CollectionDisplay = Readonly<{
  id: CharacterId;
  name: string;
  owned: boolean;
  level: number;
  assetPath: string;
}>;

export type HomeDisplay = Readonly<{
  characterName: string;
  characterId: CharacterId;
  assetPath: string;
  actionLabel: string;
  comboLabel: string;
  collection: readonly CollectionDisplay[];
}>;

export function buildHomeDisplay(progress: AccountProgress, combo: number): HomeDisplay {
  const character = characterCatalog[progress.selectedCharacterId];
  return {
    characterName: character.name,
    characterId: character.id,
    assetPath: character.assetPath,
    actionLabel: character.playLabel,
    comboLabel: `COMBO ${combo}`,
    collection: (Object.keys(characterCatalog) as CharacterId[]).map((id) => ({
      id,
      name: characterCatalog[id].name,
      owned: progress.roster[id].owned,
      level: progress.roster[id].level,
      assetPath: characterCatalog[id].assetPath,
    })),
  };
}
