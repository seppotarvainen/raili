// Documentation viewer for Raili workflow reference
// Loads sections from generated-docs.ts (built from documentation/ markdown files)

import { DOCS_SECTIONS, AVAILABLE_SECTIONS } from './generated-docs';

export function formatDocs(section?: string): string {
  if (!section) {
    return "RAILI WORKFLOW DOCUMENTATION\n\nAvailable sections:\n  " +
      AVAILABLE_SECTIONS.join("\n  ");
  }

  if (section in DOCS_SECTIONS) {
    return DOCS_SECTIONS[section as keyof typeof DOCS_SECTIONS];
  }

  return `Unknown section: ${section}`;
}

export function printDocs(section?: string): void {
  process.stdout.write(formatDocs(section) + "\n");
}

