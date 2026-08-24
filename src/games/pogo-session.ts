import type { RawReward } from '../game/types';
import type { GameSession } from './session';

const GRAVITY = 1_850;
const JUMP_VELOCITY = -690;
const OBSTACLE_SPEED = 360;
const PLAYER_WIDTH = 44;
const PLAYER_HEIGHT = 56;

export type PogoObstacleKind = 'shrimp' | 'garlic';
export type PogoObstacle = Readonly<{
  kind: PogoObstacleKind;
  x: number;
  width: number;
  height: number;
}>;

export type PogoInput = Readonly<{ type: 'TAP' }>;
export type PogoSnapshot = Readonly<{
  playerX: number;
  playerY: number;
  groundY: number;
  verticalVelocity: number;
  distance: number;
  avoids: number;
  obstacles: readonly PogoObstacle[];
  ended: boolean;
}>;

export type PogoOptions = Readonly<{ seed: number; viewportWidth: number; groundY: number }>;
type MutableObstacle = PogoObstacle & { counted: boolean };

export class PogoSession implements GameSession<PogoInput, PogoSnapshot> {
  private randomState: number;
  private readonly playerX: number;
  private playerY: number;
  private verticalVelocity = 0;
  private distance = 0;
  private avoids = 0;
  private ended = false;
  private untilSpawnSeconds = 0.9;
  private readonly obstacles: MutableObstacle[] = [];

  constructor(private readonly options: PogoOptions) {
    this.randomState = options.seed >>> 0 || 1;
    this.playerX = options.viewportWidth * 0.24;
    this.playerY = options.groundY;
  }

  receive(input: PogoInput): void {
    if (input.type === 'TAP' && !this.ended && this.playerY >= this.options.groundY) {
      this.verticalVelocity = JUMP_VELOCITY;
    }
  }

  tick(deltaSeconds: number): void {
    if (this.ended) return;
    const delta = Math.max(0, Math.min(deltaSeconds, 0.1));
    this.verticalVelocity += GRAVITY * delta;
    this.playerY = Math.min(this.options.groundY, this.playerY + this.verticalVelocity * delta);
    if (this.playerY === this.options.groundY) this.verticalVelocity = 0;

    this.distance += OBSTACLE_SPEED * delta;
    this.untilSpawnSeconds -= delta;
    if (this.untilSpawnSeconds <= 0) this.spawnObstacle();

    for (const obstacle of this.obstacles) {
      obstacle.x -= OBSTACLE_SPEED * delta;
      if (this.collides(obstacle)) this.ended = true;
      if (!obstacle.counted && obstacle.x + obstacle.width < 0) {
        obstacle.counted = true;
        this.avoids += 1;
      }
    }
    while (this.obstacles.length > 0 && this.obstacles[0]?.x + this.obstacles[0].width < -48) {
      this.obstacles.shift();
    }
  }

  snapshot(): PogoSnapshot {
    return {
      playerX: this.playerX,
      playerY: this.playerY,
      groundY: this.options.groundY,
      verticalVelocity: this.verticalVelocity,
      distance: Math.floor(this.distance),
      avoids: this.avoids,
      obstacles: this.obstacles.map(({ counted: _counted, ...obstacle }) => obstacle),
      ended: this.ended,
    };
  }

  isComplete(): boolean {
    return this.ended;
  }

  finish(): RawReward {
    return {
      xp: Math.floor(this.distance / 45) + this.avoids * 3,
      stardust: 5 + Math.floor(this.distance / 30) + this.avoids * 5,
    };
  }

  debugPlaceObstacle(obstacle: PogoObstacle): void {
    this.obstacles.push({ ...obstacle, counted: false });
  }

  private spawnObstacle(): void {
    const kind: PogoObstacleKind = this.nextRandom() < 0.5 ? 'shrimp' : 'garlic';
    this.obstacles.push({
      kind,
      x: this.options.viewportWidth + 18,
      width: kind === 'shrimp' ? 42 : 36,
      height: kind === 'shrimp' ? 32 : 42,
      counted: false,
    });
    this.untilSpawnSeconds = 0.85 + this.nextRandom() * 0.8;
  }

  private collides(obstacle: MutableObstacle): boolean {
    const playerLeft = this.playerX - PLAYER_WIDTH / 2;
    const playerRight = this.playerX + PLAYER_WIDTH / 2;
    const playerTop = this.playerY - PLAYER_HEIGHT;
    const obstacleTop = this.options.groundY - obstacle.height;
    return playerRight > obstacle.x &&
      playerLeft < obstacle.x + obstacle.width &&
      this.playerY > obstacleTop &&
      playerTop < this.options.groundY;
  }

  private nextRandom(): number {
    this.randomState = (Math.imul(1_664_525, this.randomState) + 1_013_904_223) >>> 0;
    return this.randomState / 4_294_967_296;
  }
}
