// Documentation viewer for Raili workflow reference
// Loads sections from generated-docs.ts (built from documentation/ markdown files)

import { DOCS_SECTIONS, USAGE_DOCS, AVAILABLE_SECTIONS, AVAILABLE_USAGE } from './generated-docs';

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
    return USAGE_DOCS[section as keyof typeof USAGE_DOCS];
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
