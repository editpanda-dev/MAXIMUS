import { describe, expect, it } from 'vitest';
import { characterArtBounds, getCharacterAssetPath } from './asset-paths';

describe('HOME scene assets', () => {
  it('uses the copied web asset rather than the archived source path', () => {
    expect(getCharacterAssetPath()).toBe('/assets/character/jang-han-byeol-base.png');
  });

  it('frames the visible character rather than its opaque source matte', () => {
    expect(characterArtBounds).toEqual({ x: 357, y: 237, width: 251, height: 515 });
  });
});
