import { Application, Assets, type Texture } from 'pixi.js';
import { FeedbackController } from '../adapters/feedback-controller';
import { PointerController } from '../adapters/pointer-controller';
import { CharacterController } from '../domain/character-controller';
import { defaultCharacterConfig } from '../domain/config';
import type { CharacterSnapshot, Size } from '../domain/types';
import { getCharacterAssetPath } from './asset-paths';
import { homeBackground } from './home-theme';
import { createPaperGrain } from './paper-grain';
import { PixiCharacterView } from './pixi-character-view';

export type HomeScene = Readonly<{ destroy(): void }>;

function viewportOf(host: HTMLElement): Size {
  return {
    width: Math.max(1, host.clientWidth),
    height: Math.max(1, host.clientHeight),
  };
}

function dispatchFeedback(
  previous: CharacterSnapshot,
  current: CharacterSnapshot,
  feedback: FeedbackController,
): void {
  if (current.state === 'HELD' && previous.state !== 'HELD') {
    feedback.playHeld();
    feedback.vibrate(8);
  }

  if (current.state !== 'LANDING' || previous.state === 'LANDING') return;
  if (current.landingKind === 'SAFE') {
    feedback.playSafeLanding();
    feedback.vibrate(8);
    return;
  }
  feedback.playFastLanding();
  feedback.vibrate(16);
}

export async function createHomeScene(host: HTMLElement): Promise<HomeScene> {
  const app = new Application();
  await app.init({ background: homeBackground, resizeTo: host, antialias: true });
  host.appendChild(app.canvas);

  let viewport = viewportOf(host);
  const reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  const controller = new CharacterController(
    defaultCharacterConfig,
    viewport,
    reducedMotionQuery.matches,
  );
  const texture = await Assets.load<Texture>(getCharacterAssetPath());
  const character = new PixiCharacterView(
    texture,
    viewport.height * defaultCharacterConfig.characterHeightRatio,
  );
  let grain = createPaperGrain(viewport.width, viewport.height);
  app.stage.addChild(grain, character.container);

  const feedback = new FeedbackController();
  const pointer = new PointerController(
    app.canvas,
    (input) => controller.receive(input),
    (point, padding) => character.hitTest(point, padding),
    () => feedback.unlock(),
    () => viewport,
  );

  let lastSnapshot = controller.snapshot();
  character.update(lastSnapshot, reducedMotionQuery.matches);
  const onTick = (): void => {
    const now = performance.now();
    controller.receive({
      type: 'TICK',
      deltaSeconds: app.ticker.deltaMS / 1_000,
      atMs: now,
    });
    const snapshot = controller.snapshot();
    character.update(snapshot, reducedMotionQuery.matches);
    dispatchFeedback(lastSnapshot, snapshot, feedback);
    lastSnapshot = snapshot;
  };
  app.ticker.add(onTick);

  const resize = (): void => {
    viewport = viewportOf(host);
    app.renderer.resize(viewport.width, viewport.height);
    controller.setViewport(viewport);
    character.resize(viewport.height * defaultCharacterConfig.characterHeightRatio);
    app.stage.removeChild(grain);
    grain.destroy();
    grain = createPaperGrain(viewport.width, viewport.height);
    app.stage.addChildAt(grain, 0);
    const snapshot = controller.snapshot();
    character.update(snapshot, reducedMotionQuery.matches);
    lastSnapshot = snapshot;
  };
  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(host);

  const onReducedMotionChange = (event: MediaQueryListEvent): void => {
    controller.setReducedMotion(event.matches);
    const snapshot = controller.snapshot();
    character.update(snapshot, event.matches);
    lastSnapshot = snapshot;
  };
  reducedMotionQuery.addEventListener('change', onReducedMotionChange);

  return {
    destroy(): void {
      reducedMotionQuery.removeEventListener('change', onReducedMotionChange);
      resizeObserver.disconnect();
      pointer.destroy();
      app.ticker.remove(onTick);
      character.destroy();
      app.destroy({ removeView: true }, { children: true });
    },
  };
}
