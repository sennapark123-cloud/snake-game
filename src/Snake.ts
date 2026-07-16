import { Point, Direction } from './types';

const OPPOSITE: Record<Direction, Direction> = {
  UP: 'DOWN', DOWN: 'UP', LEFT: 'RIGHT', RIGHT: 'LEFT',
};

export class Snake {
  private body: Point[];
  private direction: Direction;
  private nextDirection: Direction;
  private growing = false;

  constructor(startX: number, startY: number) {
    this.body = [
      { x: startX,     y: startY },
      { x: startX - 1, y: startY },
      { x: startX - 2, y: startY },
    ];
    this.direction = 'RIGHT';
    this.nextDirection = 'RIGHT';
  }

  get head(): Point {
    return this.body[0];
  }

  get segments(): Point[] {
    return this.body;
  }

  setDirection(dir: Direction): void {
    if (OPPOSITE[dir] !== this.direction) {
      this.nextDirection = dir;
    }
  }

  move(): void {
    this.direction = this.nextDirection;
    const head = { ...this.body[0] };

    switch (this.direction) {
      case 'UP':    head.y -= 1; break;
      case 'DOWN':  head.y += 1; break;
      case 'LEFT':  head.x -= 1; break;
      case 'RIGHT': head.x += 1; break;
    }

    this.body.unshift(head);
    if (!this.growing) this.body.pop();
    this.growing = false;
  }

  grow(): void {
    this.growing = true;
  }

  shrink(amount: number): void {
    const minLen = 3;
    const removeCount = Math.min(amount, this.body.length - minLen);
    if (removeCount > 0) this.body.splice(this.body.length - removeCount, removeCount);
  }

  wrapHead(cols: number, rows: number): void {
    const h = this.body[0];
    if (h.x < 0)    h.x = cols - 1;
    if (h.x >= cols) h.x = 0;
    if (h.y < 0)    h.y = rows - 1;
    if (h.y >= rows) h.y = 0;
  }

  checkSelfCollision(): boolean {
    const { x, y } = this.body[0];
    return this.body.slice(1).some(seg => seg.x === x && seg.y === y);
  }

  checkWallCollision(cols: number, rows: number): boolean {
    const { x, y } = this.body[0];
    return x < 0 || x >= cols || y < 0 || y >= rows;
  }

  reset(startX: number, startY: number): void {
    this.body = [
      { x: startX,     y: startY },
      { x: startX - 1, y: startY },
      { x: startX - 2, y: startY },
    ];
    this.direction = 'RIGHT';
    this.nextDirection = 'RIGHT';
    this.growing = false;
  }
}
