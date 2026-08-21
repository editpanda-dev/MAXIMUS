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
  let attached = false;
  let destroyed = false;
  let pointer: PointerController | undefined;
  let resizeObserver: ResizeObserver | undefined;
  let reducedMotionQuery: MediaQueryList | undefined;
  let onReducedMotionChange: ((event: MediaQueryListEvent) => void) | undefined;
  let onTick: (() => void) | undefined;
  let character: PixiCharacterView | undefined;
  let grain: ReturnType<typeof createPaperGrain> | undefined;

  const destroy = (): void => {
    if (destroyed) return;
    destroyed = true;
    if (reducedMotionQuery !== undefined && onReducedMotionChange !== undefined) {
      reducedMotionQuery.removeEventListener('change', onReducedMotionChange);
    }
    resizeObserver?.disconnect();
    pointer?.destroy();
    if (onTick !== undefined) app.ticker.remove(onTick);
    if (grain !== undefined) {
      grain.parent?.removeChild(grain);
      grain.destroy();
    }
    if (character !== undefined) {
      character.container.parent?.removeChild(character.container);
      character.destroy();
    }
    if (attached) app.canvas.remove();
    try {
      app.destroy({ removeView: true }, { children: true });
    } catch {
      // A partially initialized Pixi application may not have a renderer to destroy.
    }
  };

  try {
    await app.init({ background: homeBackground, resizeTo: host, antialias: true });
    host.appendChild(app.canvas);
    attached = true;

    let viewport = viewportOf(host);
    reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const controller = new CharacterController(
      defaultCharacterConfig,
      viewport,
      reducedMotionQuery.matches,
    );
    const texture = await Assets.load<Texture>(getCharacterAssetPath());
    character = new PixiCharacterView(
      texture,
      viewport.height * defaultCharacterConfig.characterHeightRatio,
    );
    grain = createPaperGrain(viewport.width, viewport.height);
    app.stage.addChild(grain, character.container);

    const feedback = new FeedbackController();
    pointer = new PointerController(
      app.canvas,
      (input) => controller.receive(input),
      (point, padding) => character?.hitTest(point, padding) ?? false,
      () => feedback.unlock(),
      () => viewport,
    );

    let lastFeedbackSnapshot = controller.snapshot();
    character.update(lastFeedbackSnapshot, reducedMotionQuery.matches);
    onTick = (): void => {
      if (destroyed) return;
      const now = performance.now();
      controller.receive({
        type: 'TICK',
        deltaSeconds: app.ticker.deltaMS / 1_000,
        atMs: now,
      });
      const snapshot = controller.snapshot();
      character?.update(snapshot, reducedMotionQuery?.matches ?? false);
      dispatchFeedback(lastFeedbackSnapshot, snapshot, feedback);
      lastFeedbackSnapshot = snapshot;
    };
    app.ticker.add(onTick);

    const resize = (): void => {
      if (destroyed) return;
      viewport = viewportOf(host);
      app.renderer.resize(viewport.width, viewport.height);
      controller.setViewport(viewport);
      character?.resize(viewport.height * defaultCharacterConfig.characterHeightRatio);
      if (grain !== undefined) {
        app.stage.removeChild(grain);
        grain.destroy();
      }
      grain = createPaperGrain(viewport.width, viewport.height);
      app.stage.addChildAt(grain, 0);
      character?.update(controller.snapshot(), reducedMotionQuery?.matches ?? false);
    };
    resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(host);

    onReducedMotionChange = (event: MediaQueryListEvent): void => {
      if (destroyed) return;
      controller.setReducedMotion(event.matches);
      character?.update(controller.snapshot(), event.matches);
    };
    reducedMotionQuery.addEventListener('change', onReducedMotionChange);

    return { destroy };
  } catch (error) {
    destroy();
    throw error;
  }
}
