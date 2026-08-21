export type CharacterConfig = Readonly<{
  longPressMs: number;
  tapMaxMs: number;
  tapMaxDistanceInHeights: number;
  longPressCancelDistanceInHeights: number;
  heldScale: number;
  safeSpeedInHeightsPerSecond: number;
  wobbleSpeedInHeightsPerSecond: number;
  maxTossSpeedInHeightsPerSecond: number;
  maxTossDistanceInHeights: number;
  reactionDurationSeconds: number;
  glareDurationSeconds: number;
  characterHeightRatio: number;
  visibleCharacterWidthInHeights: number;
  maximumRotationRadians: number;
  heldVerticalOffsetInHeights: number;
  landingVerticalOffsetInHeights: number;
  idleWalkSpeedInHeightsPerSecond: number;
}>;

export const defaultCharacterConfig: CharacterConfig = {
  longPressMs: 350,
  tapMaxMs: 300,
  tapMaxDistanceInHeights: 0.06,
  longPressCancelDistanceInHeights: 0.10,
  heldScale: 1.08,
  safeSpeedInHeightsPerSecond: 0.75,
  wobbleSpeedInHeightsPerSecond: 2.0,
  maxTossSpeedInHeightsPerSecond: 3.0,
  maxTossDistanceInHeights: 1.2,
  reactionDurationSeconds: 0.6,
  glareDurationSeconds: 0.5,
  characterHeightRatio: 0.28,
  visibleCharacterWidthInHeights: 251 / 515,
  maximumRotationRadians: 0.20,
  heldVerticalOffsetInHeights: 7 / 515,
  landingVerticalOffsetInHeights: 4 / 515,
  idleWalkSpeedInHeightsPerSecond: 0.075,
};
