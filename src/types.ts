export interface Point {
  x: number;
  y: number;
}

export type Direction = 'UP' | 'DOWN' | 'LEFT' | 'RIGHT';

export type GameState = 'WAITING' | 'PLAYING' | 'LEVEL_UP' | 'GAME_OVER' | 'LEADERBOARD';

export type PowerUpType = 'SLOW' | 'INVINCIBLE' | 'DOUBLE_SCORE' | 'SHRINK';

export interface PowerUpItem {
  pos: Point;
  type: PowerUpType;
  ticksLeft: number;
}

export interface ScoreEntry {
  name: string;
  score: number;
  level: number;
  date: string;
}
