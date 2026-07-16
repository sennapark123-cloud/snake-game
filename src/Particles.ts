import { Point } from './types';

interface Particle {
  x: number; y: number;
  vx: number; vy: number;
  life: number;
  color: string;
  size: number;
}

export class ParticleSystem {
  private pool: Particle[] = [];

  emit(pos: Point, cellSize: number, color: string, count = 10): void {
    const cx = pos.x * cellSize + cellSize / 2;
    const cy = pos.y * cellSize + cellSize / 2;
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count + Math.random() * 0.5;
      const speed = 1.5 + Math.random() * 3;
      this.pool.push({
        x: cx, y: cy,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 1,
        color,
        size: 2 + Math.random() * 3,
      });
    }
  }

  update(): void {
    this.pool = this.pool.filter(p => {
      p.x  += p.vx;
      p.y  += p.vy;
      p.vy += 0.12;
      p.vx *= 0.95;
      p.life -= 0.035;
      return p.life > 0;
    });
  }

  draw(ctx: CanvasRenderingContext2D): void {
    this.pool.forEach(p => {
      ctx.globalAlpha = p.life;
      ctx.fillStyle   = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.globalAlpha = 1;
  }

  clear(): void {
    this.pool = [];
  }
}
