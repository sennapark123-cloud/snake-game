import { ScoreEntry } from './types';

const STORAGE_KEY = 'snake2026_scores';
const MAX_ENTRIES = 10;

export class Leaderboard {
  private entries: ScoreEntry[];

  constructor() {
    this.entries = this.load();
  }

  get scores(): ScoreEntry[] {
    return this.entries;
  }

  isHighScore(score: number): boolean {
    if (score === 0) return false;
    if (this.entries.length < MAX_ENTRIES) return true;
    return score > this.entries[this.entries.length - 1].score;
  }

  add(name: string, score: number, level: number): void {
    this.entries.push({
      name: name.trim() || 'PLAYER',
      score,
      level,
      date: new Date().toLocaleDateString('ko-KR'),
    });
    this.entries.sort((a, b) => b.score - a.score);
    this.entries = this.entries.slice(0, MAX_ENTRIES);
    this.save();
  }

  private load(): ScoreEntry[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? (JSON.parse(raw) as ScoreEntry[]) : [];
    } catch {
      return [];
    }
  }

  private save(): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(this.entries));
  }
}
