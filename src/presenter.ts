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
  border?: string;
  frame?: Frame;
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
}

interface Frame {
  vertical: string;
  horizontal: string;
  corners?: [string, string, string, string];
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
      frame: {
        horizontal: '═',
        vertical: '║',
        corners: ['╔', '╗', '╚', '╝'],
      },
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

    const lines = new Lines();

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
      border: '─',
    };
  }

  render(): void {
    if (!this.entry) {return;}
    const { lines, border, frame } = this.entry;

    // Use terminal width, fall back to 80 if not available
    const terminalWidth = process.stdout.columns ?? 80;
    const boxWidth = terminalWidth - 2; // -2 for the side borders (║)
    const innerWidth = boxWidth - 2; // -2 for padding inside frame

    // Exit state: top border + content lines
    if (border && !frame) {
      const topBorder = border.repeat(terminalWidth);
      console.log(colors.cyan(topBorder));

      // Content lines (no side borders for exit)
      for (const l of lines.entries) {
        console.log(l.content);
      }

      console.log('');
      this.entry.lines = new Lines();
      return;
    }

    // Enter state: full box frame
    if (frame) {
      const [topLeft, topRight, bottomLeft, bottomRight] = frame.corners || ['┌', '┐', '└', '┘'];
      const horizontal = frame.horizontal.repeat(innerWidth);
      const vertical = frame.vertical;

      // Top border
      console.log(colors.cyan(`${topLeft}${horizontal}${topRight}`));

      // Content lines with side borders
      for (const l of lines.entries) {
        const padding = innerWidth - (l.content.length + 2);
        const line = `${colors.cyan(vertical)} ${l.content}${' '.repeat(Math.max(0, padding))} ${colors.cyan(vertical)}`;
        console.log(line);
      }

      // Bottom border
      console.log(colors.cyan(`${bottomLeft}${horizontal}${bottomRight}`));
      console.log('');
    }

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
