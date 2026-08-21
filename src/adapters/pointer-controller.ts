import type { CharacterInput, Point, Size } from '../domain/types';

export type CharacterHitTest = (point: Point, padding: Point) => boolean;
export type CharacterInputReceiver = (input: CharacterInput) => void;

const CHARACTER_HIT_PADDING_CSS_PIXELS = 16;

/** Converts browser pointer events into domain inputs only after a character hit. */
export class PointerController {
  private activePointerId: number | null = null;
  private hasInteracted = false;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly receive: CharacterInputReceiver,
    private readonly hitTest: CharacterHitTest,
    private readonly onFirstInteraction: () => void = () => undefined,
    private readonly getSceneSize: () => Size = () => ({
      width: this.canvas.width,
      height: this.canvas.height,
    }),
  ) {
    canvas.addEventListener('pointerdown', this.onPointerDown);
    canvas.addEventListener('pointermove', this.onPointerMove);
    canvas.addEventListener('pointerup', this.onPointerUp);
    canvas.addEventListener('pointercancel', this.onPointerCancel);
    window.addEventListener('blur', this.onWindowBlur);
    document.addEventListener('visibilitychange', this.onVisibilityChange);
  }

  destroy(): void {
    this.canvas.removeEventListener('pointerdown', this.onPointerDown);
    this.canvas.removeEventListener('pointermove', this.onPointerMove);
    this.canvas.removeEventListener('pointerup', this.onPointerUp);
    this.canvas.removeEventListener('pointercancel', this.onPointerCancel);
    window.removeEventListener('blur', this.onWindowBlur);
    document.removeEventListener('visibilitychange', this.onVisibilityChange);
    this.releaseActivePointer();
  }

  private onPointerDown = (event: PointerEvent): void => {
    if (this.activePointerId !== null) return;

    const point = this.localPoint(event);
    if (!this.hitTest(point, this.scenePadding())) return;

    this.activePointerId = event.pointerId;
    this.canvas.setPointerCapture(event.pointerId);
    if (!this.hasInteracted) {
      this.hasInteracted = true;
      this.onFirstInteraction();
    }
    this.receive({ type: 'POINTER_DOWN', point, atMs: performance.now() });
    event.preventDefault();
  };

  private onPointerMove = (event: PointerEvent): void => {
    if (!this.isActive(event)) return;
    this.receive({ type: 'POINTER_MOVE', point: this.localPoint(event), atMs: performance.now() });
    event.preventDefault();
  };

  private onPointerUp = (event: PointerEvent): void => {
    if (!this.isActive(event)) return;
    this.receive({ type: 'POINTER_UP', point: this.localPoint(event), atMs: performance.now() });
    this.releaseActivePointer();
    event.preventDefault();
  };

  private onPointerCancel = (event: PointerEvent): void => {
    if (!this.isActive(event)) return;
    this.receive({ type: 'POINTER_CANCEL', atMs: performance.now() });
    this.releaseActivePointer();
    event.preventDefault();
  };

  private onWindowBlur = (): void => this.interrupt();

  private onVisibilityChange = (): void => {
    if (document.visibilityState === 'hidden') this.interrupt();
  };

  private interrupt(): void {
    this.receive({ type: 'INTERRUPTED', atMs: performance.now() });
    this.releaseActivePointer();
  }

  private isActive(event: PointerEvent): boolean {
    return event.pointerId === this.activePointerId;
  }

  private localPoint(event: PointerEvent): Point {
    const rect = this.canvas.getBoundingClientRect();
    return {
      x: (event.clientX - rect.left) * this.getSceneSize().width / Math.max(1, rect.width),
      y: (event.clientY - rect.top) * this.getSceneSize().height / Math.max(1, rect.height),
    };
  }

  private scenePadding(): Point {
    const rect = this.canvas.getBoundingClientRect();
    return {
      x: CHARACTER_HIT_PADDING_CSS_PIXELS * this.getSceneSize().width / Math.max(1, rect.width),
      y: CHARACTER_HIT_PADDING_CSS_PIXELS * this.getSceneSize().height / Math.max(1, rect.height),
    };
  }

  private releaseActivePointer(): void {
    if (this.activePointerId === null) return;
    const pointerId = this.activePointerId;
    this.activePointerId = null;
    if (this.canvas.hasPointerCapture(pointerId)) this.canvas.releasePointerCapture(pointerId);
  }
}
