import { Direction, GameState, PowerUpType } from './types';
import { Snake } from './Snake';
import { Food } from './Food';
import { PowerUpManager, POWERUP_COLOR, POWERUP_ICON, POWERUP_LABEL } from './PowerUp';
import { ParticleSystem } from './Particles';
import { Leaderboard } from './Leaderboard';

const CELL  = 20;
const COLS  = 30;
const ROWS  = 25;

const LEVEL_THRESHOLDS = [0, 100, 250, 500, 800, 1200];
const LEVEL_SPEEDS     = [150, 130, 110, 90, 75, 60]; // ms/tick

const EFFECT_TICKS: Record<PowerUpType, number> = {
  SLOW:         20,
  INVINCIBLE:   18,
  DOUBLE_SCORE: 25,
  SHRINK:       0,
};

export class Game {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;

  private snake: Snake;
  private food: Food;
  private powerUps: PowerUpManager;
  private particles: ParticleSystem;
  private leaderboard: Leaderboard;

  private score = 0;
  private level = 1;
  private baseSpeed = LEVEL_SPEEDS[0];
  private state: GameState = 'WAITING';

  private effects = new Map<PowerUpType, number>(); // type → ticks remaining
  private lastTick = 0;
  private levelUpFrames = 0;

  private askingName = false;
  private playerName = '';

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.canvas.width  = COLS * CELL;
    this.canvas.height = ROWS * CELL;
    this.ctx = canvas.getContext('2d')!;

    this.snake       = new Snake(Math.floor(COLS / 2), Math.floor(ROWS / 2));
    this.food        = new Food(COLS, ROWS, this.snake.segments);
    this.powerUps    = new PowerUpManager();
    this.particles   = new ParticleSystem();
    this.leaderboard = new Leaderboard();

    window.addEventListener('keydown', (e) => this.onKey(e));
    requestAnimationFrame((t) => this.loop(t));
  }

  // ─── Input ────────────────────────────────────────────────────────────────

  private onKey(e: KeyboardEvent): void {
    if (this.askingName) {
      this.handleNameInput(e);
      return;
    }

    if (this.state === 'WAITING' || this.state === 'LEADERBOARD') {
      if (e.key === ' ' || e.key === 'Enter') this.start();
      return;
    }

    if (this.state === 'GAME_OVER') {
      if (e.key === ' ' || e.key === 'Enter') this.afterGameOver();
      return;
    }

    if (this.state !== 'PLAYING') return;

    const map: Record<string, Direction> = {
      ArrowUp: 'UP',    w: 'UP',    W: 'UP',
      ArrowDown: 'DOWN', s: 'DOWN', S: 'DOWN',
      ArrowLeft: 'LEFT', a: 'LEFT', A: 'LEFT',
      ArrowRight: 'RIGHT', d: 'RIGHT', D: 'RIGHT',
    };
    const dir = map[e.key];
    if (dir) { e.preventDefault(); this.snake.setDirection(dir); }
  }

  private handleNameInput(e: KeyboardEvent): void {
    e.preventDefault();
    if (e.key === 'Enter') {
      this.leaderboard.add(this.playerName || 'PLAYER', this.score, this.level);
      this.askingName = false;
      this.state = 'LEADERBOARD';
    } else if (e.key === 'Backspace') {
      this.playerName = this.playerName.slice(0, -1);
    } else if (e.key.length === 1 && this.playerName.length < 10) {
      this.playerName += e.key.toUpperCase();
    }
  }

  // ─── Game flow ────────────────────────────────────────────────────────────

  private start(): void {
    this.score      = 0;
    this.level      = 1;
    this.baseSpeed  = LEVEL_SPEEDS[0];
    this.effects.clear();
    this.snake.reset(Math.floor(COLS / 2), Math.floor(ROWS / 2));
    this.food.respawn(COLS, ROWS, this.snake.segments);
    this.powerUps.clear();
    this.particles.clear();
    this.playerName = '';
    this.askingName = false;
    this.lastTick   = 0;
    this.state      = 'PLAYING';
  }

  private afterGameOver(): void {
    if (this.leaderboard.isHighScore(this.score)) {
      this.askingName = true;
    } else {
      this.state = 'LEADERBOARD';
    }
  }

  // ─── Main loop ────────────────────────────────────────────────────────────

  private loop(ts: number): void {
    requestAnimationFrame((t) => this.loop(t));

    if (this.state === 'PLAYING') {
      const speed = this.effects.has('SLOW')
        ? Math.min(this.baseSpeed * 1.7, 280)
        : this.baseSpeed;
      if (ts - this.lastTick >= speed) {
        this.lastTick = ts;
        this.tick();
      }
    }

    if (this.state === 'LEVEL_UP') {
      if (--this.levelUpFrames <= 0) this.state = 'PLAYING';
    }

    this.particles.update();
    this.draw(ts);
  }

  // ─── Update ───────────────────────────────────────────────────────────────

  private tick(): void {
    // Decrement active effects
    for (const [type, left] of this.effects) {
      if (left <= 1) this.effects.delete(type);
      else this.effects.set(type, left - 1);
    }

    this.powerUps.tick();
    this.snake.move();

    const shielded = this.effects.has('INVINCIBLE');

    if (shielded) {
      this.snake.wrapHead(COLS, ROWS);
    } else if (this.snake.checkWallCollision(COLS, ROWS) || this.snake.checkSelfCollision()) {
      this.state = 'GAME_OVER';
      return;
    }

    const head = this.snake.head;

    // Food
    if (head.x === this.food.pos.x && head.y === this.food.pos.y) {
      this.snake.grow();
      const pts = this.effects.has('DOUBLE_SCORE') ? 20 : 10;
      this.score += pts;
      this.particles.emit(this.food.pos, CELL, '#ff6b6b', 14);
      this.food.respawn(COLS, ROWS, this.snake.segments);
      this.powerUps.trySpawn(COLS, ROWS, [...this.snake.segments, this.food.pos]);
      this.checkLevelUp();
    }

    // Power-up
    const collected = this.powerUps.checkCollision(head);
    if (collected) {
      this.particles.emit(collected.pos, CELL, POWERUP_COLOR[collected.type], 18);
      if (collected.type === 'SHRINK') {
        this.snake.shrink(5);
      } else {
        this.effects.set(collected.type, EFFECT_TICKS[collected.type]);
      }
    }
  }

  private checkLevelUp(): void {
    let newLevel = 1;
    for (let i = LEVEL_THRESHOLDS.length - 1; i >= 0; i--) {
      if (this.score >= LEVEL_THRESHOLDS[i]) { newLevel = i + 1; break; }
    }
    newLevel = Math.min(newLevel, LEVEL_SPEEDS.length);
    if (newLevel > this.level) {
      this.level      = newLevel;
      this.baseSpeed  = LEVEL_SPEEDS[newLevel - 1];
      this.levelUpFrames = 90;
      this.state      = 'LEVEL_UP';
    }
  }

  // ─── Rendering ────────────────────────────────────────────────────────────

  private draw(ts: number): void {
    const { ctx, canvas } = this;
    const W = canvas.width, H = canvas.height;

    ctx.fillStyle = '#1a0514';
    ctx.fillRect(0, 0, W, H);

    this.drawGrid();
    this.drawFood(ts);
    this.drawPowerUpItems(ts);
    this.drawSnake(ts);
    this.particles.draw(ctx);
    this.drawHUD(ts);

    if (this.state === 'WAITING')     this.drawWaiting();
    if (this.state === 'LEVEL_UP')    this.drawLevelUp();
    if (this.state === 'GAME_OVER')   this.drawGameOver(ts);
    if (this.state === 'LEADERBOARD') this.drawLeaderboard();
  }

  private drawGrid(): void {
    const { ctx, canvas } = this;
    ctx.strokeStyle = 'rgba(255,255,255,0.04)';
    ctx.lineWidth   = 0.5;
    for (let x = 0; x <= COLS; x++) {
      ctx.beginPath(); ctx.moveTo(x * CELL, 0); ctx.lineTo(x * CELL, canvas.height); ctx.stroke();
    }
    for (let y = 0; y <= ROWS; y++) {
      ctx.beginPath(); ctx.moveTo(0, y * CELL); ctx.lineTo(canvas.width, y * CELL); ctx.stroke();
    }
  }

  private drawFood(ts: number): void {
    const { ctx } = this;
    const pulse = Math.sin(ts / 300) * 1.5;
    const fp = this.food.pos;
    const doubled = this.effects.has('DOUBLE_SCORE');

    ctx.fillStyle  = doubled ? '#ce93d8' : '#ff6b6b';
    ctx.shadowColor = doubled ? '#ce93d8' : '#ff6b6b';
    ctx.shadowBlur  = 12 + pulse;
    ctx.beginPath();
    ctx.arc(fp.x * CELL + CELL / 2, fp.y * CELL + CELL / 2, CELL / 2 - 1.5 + pulse * 0.3, 0, Math.PI * 2);
    ctx.fill();

    if (doubled) {
      ctx.shadowBlur = 0;
      ctx.fillStyle  = '#fff';
      ctx.font       = 'bold 9px monospace';
      ctx.textAlign  = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('×2', fp.x * CELL + CELL / 2, fp.y * CELL + CELL / 2);
      ctx.textBaseline = 'alphabetic';
    }
    ctx.shadowBlur = 0;
    ctx.textAlign  = 'left';
  }

  private drawPowerUpItems(ts: number): void {
    const { ctx } = this;
    this.powerUps.active.forEach(item => {
      // Blink when about to expire
      if (item.ticksLeft < 10 && Math.floor(ts / 120) % 2 === 0) return;

      const color = POWERUP_COLOR[item.type];
      const icon  = POWERUP_ICON[item.type];
      const x = item.pos.x * CELL;
      const y = item.pos.y * CELL;

      ctx.fillStyle   = color + '33';
      ctx.strokeStyle = color;
      ctx.lineWidth   = 1.5;
      ctx.shadowColor = color;
      ctx.shadowBlur  = 10;
      ctx.fillRect(x + 1, y + 1, CELL - 2, CELL - 2);
      ctx.strokeRect(x + 1, y + 1, CELL - 2, CELL - 2);
      ctx.shadowBlur = 0;

      ctx.fillStyle    = color;
      ctx.font         = `bold ${CELL * 0.55}px monospace`;
      ctx.textAlign    = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(icon, x + CELL / 2, y + CELL / 2);
      ctx.textBaseline = 'alphabetic';
      ctx.textAlign    = 'left';
    });
  }

  private drawSnake(ts: number): void {
    const { ctx } = this;
    const shielded = this.effects.has('INVINCIBLE');
    const segs = this.snake.segments;

    segs.forEach((seg, i) => {
      const t = i / segs.length;
      if (i === 0) {
        ctx.fillStyle  = shielded ? `hsl(${(ts / 6) % 360}, 100%, 65%)` : '#4ecca3';
        ctx.shadowColor = shielded ? '#fff' : '#4ecca3';
        ctx.shadowBlur  = shielded ? 18 : 10;
      } else {
        const g = Math.floor(200 - t * 110);
        ctx.fillStyle  = shielded
          ? `hsla(${((ts / 6) + i * 18) % 360}, 80%, 55%, 0.85)`
          : `rgb(18, ${g}, 88)`;
        ctx.shadowBlur = 0;
      }
      ctx.fillRect(seg.x * CELL + 1, seg.y * CELL + 1, CELL - 2, CELL - 2);
    });
    ctx.shadowBlur = 0;
  }

  private drawHUD(ts: number): void {
    const { ctx, canvas } = this;
    const W = canvas.width;

    // Score
    ctx.fillStyle  = '#e0e0e0';
    ctx.font       = 'bold 15px monospace';
    ctx.textAlign  = 'left';
    ctx.fillText(`SCORE: ${this.score}`, 8, 18);

    // Level
    ctx.textAlign  = 'center';
    ctx.fillStyle  = '#4ecca3';
    ctx.fillText(`LEVEL ${this.level}`, W / 2, 18);
    ctx.textAlign  = 'left';

    // Next level threshold
    const nextThresh = LEVEL_THRESHOLDS[this.level] ?? null;
    if (nextThresh !== null) {
      const pct = Math.min((this.score - (LEVEL_THRESHOLDS[this.level - 1] ?? 0)) /
                           (nextThresh - (LEVEL_THRESHOLDS[this.level - 1] ?? 0)), 1);
      const barW = 100, barH = 5;
      const bx = W / 2 - barW / 2;
      ctx.fillStyle = 'rgba(78,204,163,0.2)';
      ctx.fillRect(bx, 22, barW, barH);
      ctx.fillStyle = '#4ecca3';
      ctx.fillRect(bx, 22, barW * pct, barH);
    }

    // Active effects bar
    let ex = 8;
    const ey = canvas.height - 24;
    for (const [type, left] of this.effects) {
      const total = EFFECT_TICKS[type];
      const pct   = left / total;
      const color = POWERUP_COLOR[type];
      const label = POWERUP_LABEL[type];
      const barW  = 64;

      ctx.fillStyle = color + '30';
      ctx.fillRect(ex, ey, barW, 18);
      ctx.fillStyle = color + '88';
      ctx.fillRect(ex, ey, barW * pct, 18);
      ctx.strokeStyle = color;
      ctx.lineWidth   = 1;
      ctx.strokeRect(ex, ey, barW, 18);

      ctx.fillStyle    = '#fff';
      ctx.font         = 'bold 9px monospace';
      ctx.textAlign    = 'center';
      ctx.textBaseline = 'middle';

      // Blink icon when almost done
      const showIcon = left > 5 || Math.floor(ts / 120) % 2 === 0;
      if (showIcon) ctx.fillText(`${POWERUP_ICON[type]} ${label}`, ex + barW / 2, ey + 9);

      ctx.textBaseline = 'alphabetic';
      ctx.textAlign    = 'left';
      ex += barW + 6;
    }
  }

  // ─── Overlays ─────────────────────────────────────────────────────────────

  private drawDimOverlay(): void {
    const { ctx, canvas } = this;
    ctx.fillStyle = 'rgba(0,0,0,0.68)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  private centeredText(text: string, y: number, font: string, color: string, glow?: string): void {
    const { ctx, canvas } = this;
    ctx.font       = font;
    ctx.fillStyle  = color;
    ctx.textAlign  = 'center';
    if (glow) { ctx.shadowColor = glow; ctx.shadowBlur = 20; }
    ctx.fillText(text, canvas.width / 2, y);
    ctx.shadowBlur = 0;
    ctx.textAlign  = 'left';
  }

  private drawWaiting(): void {
    this.drawDimOverlay();
    const H = this.canvas.height;
    this.centeredText('SNAKE 2026', H / 2 - 50, 'bold 48px monospace', '#4ecca3', '#4ecca3');
    this.centeredText('SPACE / ENTER 로 시작', H / 2 + 4, '20px monospace', '#ffffff');
    this.centeredText('WASD 또는 방향키로 이동', H / 2 + 34, '16px monospace', '#aaaaaa');

    // Power-up legend
    const types: PowerUpType[] = ['SLOW', 'INVINCIBLE', 'DOUBLE_SCORE', 'SHRINK'];
    const { ctx, canvas } = this;
    const startY = H / 2 + 76;
    const spacing = 28;
    types.forEach((type, i) => {
      const lx = canvas.width / 2 - 140;
      const ly = startY + i * spacing;
      ctx.fillStyle   = POWERUP_COLOR[type];
      ctx.shadowColor = POWERUP_COLOR[type];
      ctx.shadowBlur  = 6;
      ctx.fillRect(lx, ly - 14, 20, 18);
      ctx.shadowBlur = 0;
      ctx.fillStyle    = '#000';
      ctx.font         = 'bold 11px monospace';
      ctx.textAlign    = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(POWERUP_ICON[type], lx + 10, ly - 5);
      ctx.textBaseline = 'alphabetic';
      ctx.textAlign    = 'left';
      ctx.fillStyle = '#cccccc';
      ctx.font      = '13px monospace';
      const desc: Record<PowerUpType, string> = {
        SLOW: '속도 감소', INVINCIBLE: '무적 (벽 통과)',
        DOUBLE_SCORE: '점수 2배', SHRINK: '길이 줄이기',
      };
      ctx.fillText(`${POWERUP_LABEL[type]}  —  ${desc[type]}`, lx + 28, ly - 3);
    });
    ctx.textBaseline = 'alphabetic';
    ctx.textAlign    = 'left';
  }

  private drawLevelUp(): void {
    const { ctx, canvas } = this;
    const alpha = Math.min(this.levelUpFrames / 20, 1) * Math.min((90 - this.levelUpFrames) / 10 + 1, 1);
    ctx.fillStyle = `rgba(78,204,163,${0.15 * alpha})`;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const H = canvas.height;
    ctx.globalAlpha = alpha;
    this.centeredText(`LEVEL ${this.level}`, H / 2 - 10, 'bold 56px monospace', '#4ecca3', '#4ecca3');
    this.centeredText('LEVEL UP!', H / 2 + 36, '24px monospace', '#ffffff');
    ctx.globalAlpha = 1;
  }

  private drawGameOver(ts: number): void {
    this.drawDimOverlay();
    const H = this.canvas.height;
    const { ctx, canvas } = this;

    this.centeredText('GAME OVER', H / 2 - 60, 'bold 46px monospace', '#ff6b6b', '#ff6b6b');
    this.centeredText(`점수: ${this.score}   레벨: ${this.level}`, H / 2 - 14, '20px monospace', '#ffffff');

    if (this.askingName) {
      this.centeredText('이름을 입력하세요 (Enter로 확인)', H / 2 + 28, '15px monospace', '#aaaaaa');
      const cursor = Math.floor(ts / 500) % 2 === 0 ? '▌' : '';
      this.centeredText(`[ ${this.playerName}${cursor} ]`, H / 2 + 58, 'bold 24px monospace', '#4ecca3', '#4ecca3');
    } else {
      const isHigh = this.leaderboard.isHighScore(this.score);
      if (isHigh) {
        this.centeredText('🏆 새 최고 기록!', H / 2 + 28, 'bold 18px monospace', '#ffd54f');
      }
      this.centeredText('SPACE / ENTER 로 계속', H / 2 + 58, '16px monospace', '#aaaaaa');
    }

    // Draw board border highlight
    ctx.strokeStyle = '#ff6b6b';
    ctx.lineWidth   = 2;
    ctx.shadowColor = '#ff6b6b';
    ctx.shadowBlur  = 8;
    ctx.strokeRect(1, 1, canvas.width - 2, canvas.height - 2);
    ctx.shadowBlur  = 0;
  }

  private drawLeaderboard(): void {
    this.drawDimOverlay();
    const { ctx, canvas } = this;
    const W = canvas.width, H = canvas.height;
    const scores = this.leaderboard.scores;

    // Panel
    const pw = 420, ph = Math.min(scores.length * 30 + 120, H - 60);
    const px = (W - pw) / 2, py = (H - ph) / 2;
    ctx.fillStyle   = 'rgba(15,15,40,0.95)';
    ctx.strokeStyle = '#4ecca3';
    ctx.lineWidth   = 2;
    ctx.shadowColor = '#4ecca3';
    ctx.shadowBlur  = 12;
    ctx.fillRect(px, py, pw, ph);
    ctx.strokeRect(px, py, pw, ph);
    ctx.shadowBlur  = 0;

    this.centeredText('🏆  LEADERBOARD', py + 36, 'bold 22px monospace', '#4ecca3');

    if (scores.length === 0) {
      this.centeredText('아직 기록이 없습니다', py + ph / 2, '16px monospace', '#888');
    } else {
      const colX = [px + 20, px + 50, px + 170, px + 280, px + 370];
      const headerY = py + 64;
      const headers = ['#', 'NAME', 'SCORE', 'LEVEL', 'DATE'];

      ctx.fillStyle = '#4ecca3';
      ctx.font      = 'bold 12px monospace';
      ctx.textAlign = 'left';
      headers.forEach((h, i) => ctx.fillText(h, colX[i], headerY));

      ctx.strokeStyle = '#4ecca3';
      ctx.lineWidth   = 0.5;
      ctx.globalAlpha = 0.4;
      ctx.beginPath();
      ctx.moveTo(px + 10, headerY + 6);
      ctx.lineTo(px + pw - 10, headerY + 6);
      ctx.stroke();
      ctx.globalAlpha = 1;

      scores.forEach((entry, idx) => {
        const ry = headerY + 22 + idx * 28;
        const rankColors = ['#ffd700', '#c0c0c0', '#cd7f32'];
        ctx.fillStyle = rankColors[idx] ?? '#cccccc';
        ctx.font      = `bold 13px monospace`;
        ctx.fillText(`${idx + 1}`, colX[0], ry);
        ctx.fillStyle = '#ffffff';
        ctx.fillText(entry.name,             colX[1], ry);
        ctx.fillStyle = '#4ecca3';
        ctx.fillText(`${entry.score}`,       colX[2], ry);
        ctx.fillStyle = '#ce93d8';
        ctx.fillText(`${entry.level}`,       colX[3], ry);
        ctx.fillStyle = '#888888';
        ctx.font      = '11px monospace';
        ctx.fillText(entry.date,             colX[4], ry);
      });
    }

    ctx.textAlign = 'left';
    this.centeredText('SPACE / ENTER 로 재시작', py + ph - 18, '13px monospace', '#666666');
  }
}
