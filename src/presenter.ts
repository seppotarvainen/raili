import { StateDef } from './types';
import colors from 'colors/safe';

interface PresenterEntry {
  count: number;
  stateName: string;
  type: 'agent' | 'command' | 'script' | 'engine' | string;
  enteredAt?: string;
  visit: number;
  learningsApplied: boolean;
  outputsApplied: boolean;
  lines: Lines;
  borderTop?: string;
  borderBottom?: string;
}

export const EMOJI_MAP: Record<string, string> = {
  agent: '🤖',
  command: '📢',
  script: '📜',
  engine: '⚙️',
};

class Lines {
  get entries(): { content: string; emojiCount: number }[] {
    return this._entries;
  }

  private _entries: { content: string; emojiCount: number }[] = [];

  push(content: string, emojiCount = 0): void {
    this._entries.push({ content, emojiCount });
  }

  maxLength() {
    let currentMax = 0;

    this._entries.forEach((l) => {
      currentMax = Math.max(currentMax, l.emojiCount * 2 + l.content.length);
    });
    return currentMax;
  }
}

export class Presenter {
  public entry: PresenterEntry | null = null;

  appendStateEnter(
    stateDef: StateDef,
    visits: number,
    count: number,
    enteredAt?: string,
    learningsApplied = false,
    outputsApplied = false,
  ): void {
    const type = stateDef.config.type ?? 'engine';
    const stateName = stateDef.id.toUpperCase();
    const emoji = EMOJI_MAP[type] ?? 'ℹ️';

    const lines = new Lines();
    lines.push(`${emoji} #${count} ${stateName}`, 1);
    lines.push(`⏱️ Entered: ${enteredAt}.`, 1);
    lines.push(`🔁 Visit: ${visits}`, 1);

    if (learningsApplied) {
      lines.push(`✅ Learnings applied`, 1);
    }
    if (outputsApplied) {
      lines.push(`✅ Earlier output applied`, 1);
    } else {
      lines.push(`No earlier run output`);
    }

    this.entry = {
      count,
      stateName,
      type,
      enteredAt,
      visit: visits,
      learningsApplied,
      outputsApplied,
      lines,
      borderTop: '=',
      borderBottom: '=',
    };
  }

  appendStateExit(
    stateDef: StateDef,
    outcome: string,
    next?: string,
    elapsedMs?: number
  ): void {
    const type = stateDef.config.type ?? 'engine';
    const emoji = outcome === 'PASSED' ? '✅' : outcome === 'FAILED' ? '❌' : '➡️';

    const lines = this.entry ? this.entry.lines : new Lines();

    // Compose message
    const outcomePart = `${emoji} ${outcome}`;
    const nextPart = next ? ` -> ${next}` : '';
    const elapsedPart =
      typeof elapsedMs === 'number' ? ` | ⏱️ Elapsed time: ${formatElapsed(elapsedMs)}` : '';

    lines.push(`${outcomePart}${nextPart}${elapsedPart}`, 1);

    this.entry = {
      count: 0,
      stateName: stateDef.id.toUpperCase(),
      type,
      enteredAt: undefined,
      visit: 0,
      learningsApplied: false,
      outputsApplied: false,
      lines,
      borderTop: '-',
    };
  }

  render(): void {
    if (!this.entry) {return;}
    const { lines, borderTop, borderBottom } = this.entry;

    const totalWidth = lines.maxLength() + 2;
    const bt = (borderTop || '').repeat(totalWidth);
    const bb = (borderBottom || '').repeat(totalWidth);

    if (bt) {console.log(colors.cyan(bt));}
    for (const l of lines.entries) {
      console.log(l.content + ' '.repeat(totalWidth - l.content.length + l.emojiCount));
    }
    if (bb) {console.log(colors.cyan(bb));}
    console.log('');
    this.entry.lines = new Lines();
  }
}

function formatElapsed(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const hours = Math.floor(totalSec / 3600);
  const mins = Math.floor((totalSec % 3600) / 60);
  const secs = totalSec % 60;
  if (hours > 0)
    {return `${hours}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;}
  return `${String(mins)}:${String(secs).padStart(2, '0')}`;
}
