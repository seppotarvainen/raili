import { StateDef } from './types';
import colors from 'colors/safe';

export interface PresenterEntry {
  count: number;
  stateName: string;
  type: 'agent' | 'command' | 'script' | 'engine' | string;
  enteredAt?: string;
  visit: number;
  learningsApplied: boolean;
  outputsApplied: boolean;
  lines: Lines;
  applyFrame: boolean;
}

const EMOJI_MAP: Record<string, string> = {
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
      applyFrame: true,
    };
  }

  render(): void {
    if (!this.entry) return;
    const { lines, applyFrame } = this.entry;

    if (!applyFrame) {
      for (const l of lines.entries) console.log(l.content);
      console.log('');
      return;
    }

    const totalWidth = lines.maxLength() + 2;
    const border = '='.repeat(totalWidth);

    console.log(colors.cyan(border));
    for (const l of lines.entries) {
      console.log(`${l.content + ' '.repeat(totalWidth - l.content.length + l.emojiCount)}`);
    }
    console.log(colors.cyan(border));
    console.log('');
  }
}
