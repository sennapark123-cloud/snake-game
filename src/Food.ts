import { Point } from './types';

export class Food {
  private position: Point;

  constructor(cols: number, rows: number, occupied: Point[]) {
    this.position = this.randomPos(cols, rows, occupied);
  }

  get pos(): Point {
    return this.position;
  }

  respawn(cols: number, rows: number, occupied: Point[]): void {
    this.position = this.randomPos(cols, rows, occupied);
  }

  private randomPos(cols: number, rows: number, occupied: Point[]): Point {
    let pos: Point;
    do {
      pos = {
        x: Math.floor(Math.random() * cols),
        y: Math.floor(Math.random() * rows),
      };
    } while (occupied.some(p => p.x === pos.x && p.y === pos.y));
    return pos;
  }
}
