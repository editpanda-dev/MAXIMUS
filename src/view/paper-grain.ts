import { Graphics } from 'pixi.js';

const GRAIN_ALPHA = 0.03;
const GRAIN_DENSITY = 0.0008;

function seededRandom(seed: number): () => number {
  let value = seed >>> 0;
  return () => {
    value = (value * 1_664_525 + 1_013_904_223) >>> 0;
    return value / 0x1_0000_0000;
  };
}

/** Creates a subtle, repeatable paper texture without a raster asset. */
export function createPaperGrain(width: number, height: number): Graphics {
  const grain = new Graphics();
  const random = seededRandom(0x6a616e67);
  const dots = Math.max(24, Math.round(width * height * GRAIN_DENSITY));

  for (let index = 0; index < dots; index += 1) {
    const size = random() < 0.88 ? 1 : 2;
    const color = random() < 0.5 ? 0x776557 : 0xffffff;
    grain.rect(random() * width, random() * height, size, size).fill({ color, alpha: GRAIN_ALPHA });
  }

  return grain;
}
