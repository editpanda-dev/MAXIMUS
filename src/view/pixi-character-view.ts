import { Container, Graphics, Rectangle, Sprite, Texture } from 'pixi.js';
import type { CharacterSnapshot, Point } from '../domain/types';
import { characterArtBounds } from './asset-paths';
import { shadowColor } from './home-theme';

const SHADOW_WIDTH_IN_HEIGHTS = 0.56;
const SHADOW_HEIGHT_IN_HEIGHTS = 0.075;

export class PixiCharacterView {
  readonly container = new Container();
  private readonly shadow = new Graphics();
  private readonly croppedTexture: Texture;
  private readonly sprite: Sprite;
  private characterHeight: number;
  private baseScale = 1;

  constructor(texture: Texture, characterHeight: number) {
    this.characterHeight = characterHeight;
    this.croppedTexture = new Texture({
      source: texture.source,
      frame: new Rectangle(
        characterArtBounds.x,
        characterArtBounds.y,
        characterArtBounds.width,
        characterArtBounds.height,
      ),
    });
    this.sprite = new Sprite(this.croppedTexture);
    this.sprite.anchor.set(0.5, 1);
    // White pixels in the opaque reference image are neutral over the paper background.
    this.sprite.blendMode = 'multiply';
    this.container.addChild(this.shadow, this.sprite);
    this.resize(characterHeight);
  }

  update(snapshot: CharacterSnapshot, reducedMotion: boolean): void {
    const motion = reducedMotion ? 0.45 : 1;
    const verticalOffset = snapshot.verticalOffset * motion;
    const scale = snapshot.scale;

    this.container.position.set(snapshot.position.x, snapshot.position.y);
    this.sprite.position.set(0, verticalOffset);
    this.sprite.scale.set(
      snapshot.facing * this.baseScale * scale * snapshot.landingScaleX,
      this.baseScale * scale * snapshot.landingScaleY,
    );
    this.sprite.rotation = snapshot.rotationRadians * motion;

    const lift = Math.max(0, -verticalOffset) / Math.max(1, this.characterHeight);
    const shadowScale = 1 - Math.min(0.22, lift * 0.42);
    this.shadow.scale.set(shadowScale * scale, shadowScale);
    this.shadow.alpha = 0.18 * (1 - Math.min(0.45, lift * 0.85));
  }

  resize(characterHeight: number): void {
    this.characterHeight = characterHeight;
    this.baseScale = characterHeight / Math.max(1, this.sprite.texture.orig.height);
    this.sprite.scale.set(this.baseScale, this.baseScale);
    this.shadow.clear()
      .ellipse(
        0,
        0,
        characterHeight * SHADOW_WIDTH_IN_HEIGHTS / 2,
        characterHeight * SHADOW_HEIGHT_IN_HEIGHTS / 2,
      )
      .fill({ color: shadowColor, alpha: 0.18 });
  }

  hitTest(point: Point, padding: Point): boolean {
    const spriteWidth = this.sprite.width;
    const spriteHeight = this.sprite.height;
    const left = this.container.x - spriteWidth / 2 - padding.x;
    const right = this.container.x + spriteWidth / 2 + padding.x;
    const top = this.container.y - spriteHeight + this.sprite.y - padding.y;
    const bottom = this.container.y + this.sprite.y + padding.y;
    return point.x >= left && point.x <= right && point.y >= top && point.y <= bottom;
  }

  destroy(): void {
    this.container.destroy({ children: true });
    this.croppedTexture.destroy(false);
  }
}
