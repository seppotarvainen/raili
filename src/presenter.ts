interface PresenterEntry {
  count: number;
  stateName: string;
  type: 'agent' | 'command' | 'script' | 'engine' | string;
  enteredAt: string;
  visit: number;
  learningsApplied: boolean;
  learningNote?: string;
}

const EMOJI_MAP: Record<string, string> = {
  agent: '🤖',
  command: '📢',
  script: '📜',
  engine: '⚙️',
};

export class Presenter {
  constructor() {}

  renderEntry(entry: PresenterEntry): void {
    const emoji = EMOJI_MAP[entry.type] ?? 'ℹ️';

    const lines: string[] = [];

    // Header line: emoji, count, stateName
    lines.push(`${emoji} #${entry.count} ${entry.stateName}`);

    // Meta lines
    lines.push(`⏱️ Entered: ${entry.enteredAt}.`);
    lines.push(`🔁 Visit: ${entry.visit}`);

    if (entry.learningsApplied) {
      lines.push(`✅ Learnings applied`);
    } else if (entry.learningNote) {
      lines.push(`   ${entry.learningNote}`);
    } else {
      lines.push(`   No earlier run output`);
    }

    // Compute box width
    const paddedLines = lines.map((l) => `  ${l}`);
    const maxLen = Math.max(...paddedLines.map((l) => l.length));
    const totalWidth = maxLen + 2; // side spaces

    const border = '+' + '-'.repeat(totalWidth) + '+';

    console.log(border);
    for (const l of paddedLines) {
      const padded = l + ' '.repeat(totalWidth - l.length);
      console.log(`|${padded}|`);
    }
    console.log(border);
    console.log('');
  }
}
