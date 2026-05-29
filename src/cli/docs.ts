// Documentation viewer for Raili workflow reference
// Loads sections from generatedDocs.ts (built from documentation/ markdown files)

import { DOCS_SECTIONS, USAGE_DOCS, AVAILABLE_SECTIONS, AVAILABLE_USAGE } from './generatedDocs';

export function extractUsageFromDoc(content: string): string {
  if (!content) return '';

  // Split into lines for robust line-oriented parsing
  const lines = content.split(/\r?\n/);

  // Trim out the first top-level heading if present (e.g. "# create")
  if (lines.length > 0 && /^\s*#\s+/.test(lines[0])) {
    lines.shift();
  }

  // Find the first Usage header (any level)
  const usageIdx = lines.findIndex((ln) => /^#{1,6}\s*Usage\b/i.test(ln));
  if (usageIdx === -1) return '';

  // Collect lines after the Usage header until the next heading (a line starting with '#')
  const collected: string[] = [];
  for (let i = usageIdx + 1; i < lines.length; i++) {
    const ln = lines[i];
    if (/^\s*#/.test(ln)) break; // stop at next heading
    collected.push(ln);
  }

  // Trim leading/trailing blank lines and return
  while (collected.length > 0 && /^\s*$/.test(collected[0])) collected.shift();
  while (collected.length > 0 && /^\s*$/.test(collected[collected.length - 1])) collected.pop();

  return collected.join('\n');
}

export function formatDocs(section?: string): string {
  if (!section) {
    // Main index showing both usage and sections
    return (
      'RAILI DOCUMENTATION\n\nTo look up either usage or available sections, type e.g. `raili docs init` or `raili docs routing`\n\nUsage:\n  ' +
      AVAILABLE_USAGE.join('\n  ') +
      '\n\nAvailable sections:\n  ' +
      AVAILABLE_SECTIONS.join('\n  ')
    );
  }

  // Check usage docs first
  if (section in USAGE_DOCS) {
    const raw = USAGE_DOCS[section as keyof typeof USAGE_DOCS];
    const extracted = extractUsageFromDoc(raw);
    return extracted || raw; // fall back to raw if extraction produced empty string
  }

  // Then check feature sections
  if (section in DOCS_SECTIONS) {
    return DOCS_SECTIONS[section as keyof typeof DOCS_SECTIONS];
  }

  const allAvailable = [...AVAILABLE_USAGE, ...AVAILABLE_SECTIONS];
  return `Unknown section: ${section}\n\nAvailable: ${allAvailable.join(', ')}`;
}

export function printDocs(section?: string): void {
  process.stdout.write(formatDocs(section) + '\n');
}
