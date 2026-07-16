import { Point, PowerUpType, PowerUpItem } from './types';

const BOARD_TICKS = 30;
const SPAWN_CHANCE = 0.25;
const MAX_ON_BOARD = 2;

export const POWERUP_COLOR: Record<PowerUpType, string> = {
  SLOW:         '#4fc3f7',
  INVINCIBLE:   '#ffd54f',
  DOUBLE_SCORE: '#ce93d8',
  SHRINK:       '#80cbc4',
};

export const POWERUP_ICON: Record<PowerUpType, string> = {
  SLOW:         '❄',
  INVINCIBLE:   '★',
  DOUBLE_SCORE: '×2',
  SHRINK:       '↓',
};

export const POWERUP_LABEL: Record<PowerUpType, string> = {
  SLOW:         'SLOW',
  INVINCIBLE:   'SHIELD',
  DOUBLE_SCORE: '2×SCORE',
  SHRINK:       'SHRINK',
};

const ALL_TYPES: PowerUpType[] = ['SLOW', 'INVINCIBLE', 'DOUBLE_SCORE', 'SHRINK'];

export class PowerUpManager {
  private items: PowerUpItem[] = [];

  get active(): PowerUpItem[] {
    return this.items;
  }

  trySpawn(cols: number, rows: number, occupied: Point[]): void {
    if (Math.random() > SPAWN_CHANCE) return;
    if (this.items.length >= MAX_ON_BOARD) return;

    const type = ALL_TYPES[Math.floor(Math.random() * ALL_TYPES.length)];
    let pos: Point;
    do {
      pos = {
        x: Math.floor(Math.random() * cols),
        y: Math.floor(Math.random() * rows),
      };
    } while (occupied.some(p => p.x === pos.x && p.y === pos.y));

    this.items.push({ pos, type, ticksLeft: BOARD_TICKS });
  }

  tick(): void {
    this.items = this.items.filter(item => --item.ticksLeft > 0);
  }

  checkCollision(head: Point): PowerUpItem | null {
    const idx = this.items.findIndex(i => i.pos.x === head.x && i.pos.y === head.y);
    if (idx === -1) return null;
    return this.items.splice(idx, 1)[0];
  }

  clear(): void {
    this.items = [];
  }
}
