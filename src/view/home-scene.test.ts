import { describe, expect, it } from 'vitest';
import { getCharacterAssetPath } from './asset-paths';

describe('HOME scene assets', () => {
  it('uses the copied web asset rather than the archived source path', () => {
    expect(getCharacterAssetPath()).toBe('/assets/character/jang-han-byeol-base.png');
  });
});
