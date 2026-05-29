// Pure, deterministic help formatter for the Raili CLI.
// Loads help topics from generatedDocs.ts (built from documentation/ markdown files)

import {
  HELP_TOPICS,
  USAGE_HELP,
  USAGE_DOCS,
  AVAILABLE_TOPICS,
  AVAILABLE_USAGE,
} from './generatedDocs';
import { getFileSystem } from '../infrastructure/fileSystemProvider';
import * as path from 'path';

const GLOBAL_USAGE = 'Usage: raili [--version] <command> [options]';

const COMMAND_HELP: Record<string, string> = {
  init: 'Usage: raili init\n\nInitialize a new .raili/ directory with template files.',
  run: 'Usage: raili run [--clean | --continue] [--var key=value ...]\n\nValidate and execute the configured workflow.',
  help: 'Usage: raili help [topic]\n\nShow help on general usage or a specific topic.',
  docs: 'Usage: raili docs [section]\n\nDisplay full workflow.yaml reference documentation.',
  schema: 'Usage: raili schema\n\nDisplay YAML workflow schema with all state fields and types.',
  stats:
    'Usage: raili stats [<workflow>] [--latest N]\n\nShow recent workflow run metrics. Defaults to workflow "main" and latest 10 runs.',
  teach:
    'Usage: raili teach <agentId> [-w <workflow>]\n\nOpen a multiline prompt, finish with /q, and append to .raili/<workflow>/learnings/<agentId>.md',
  create:
    'Usage: raili create -w <workflow>\n\nCreate a new named workflow directory under .raili/<workflow> with a scaffolded workflow.yaml, vars.yaml, outputs/ and learnings/.',
};

function stripTitleFromMarkdown(content: string, stopAtExamples = false): string {
  if (!content) return content;

  // Split lines for line-oriented parsing
  const lines = content.split(/\r?\n/);

  // Remove first top-level title if present
  if (lines.length > 0 && /^\s*#\s+/.test(lines[0])) {
    lines.shift();
    while (lines.length > 0 && /^\s*$/.test(lines[0])) lines.shift();
  }

  // Collect leading blockquote (quote) lines if present
  const quoteLines: string[] = [];
  let idx = 0;
  while (idx < lines.length && /^\s*>/.test(lines[idx])) {
    // strip leading '> ' or '>' and a single optional space
    quoteLines.push(lines[idx].replace(/^\s*>\s?/, ''));
    idx++;
  }

  // Find the Usage header (any level) after the quote
  const usageIdx = lines.findIndex((ln, i) => i >= idx && /^#{1,6}\s*Usage\b/i.test(ln));
  if (usageIdx === -1) {
    return '';
  }

  // Collect Usage header and its content until the next heading
  const usageCollected: string[] = [];
  for (let i = usageIdx; i < lines.length; i++) {
    if (i !== usageIdx && /^\s*#/.test(lines[i])) break;
    usageCollected.push(lines[i]);
  }

  // Trim blank lines from usage block
  while (usageCollected.length > 0 && /^\s*$/.test(usageCollected[0])) usageCollected.shift();
  while (usageCollected.length > 0 && /^\s*$/.test(usageCollected[usageCollected.length - 1]))
    usageCollected.pop();

  const parts: string[] = [];
  if (quoteLines.length > 0) parts.push(quoteLines.join('\n').trim());
  if (usageCollected.length > 0) parts.push(usageCollected.join('\n').trim());

  return parts.join('\n\n').trim();
}

export function formatHelp(command?: string, topic?: string): string {
  // No early legacy return here — prefer returning the full help document when available.
  // If no documentation entry exists, the function will fall back to GLOBAL_USAGE later.

  const loadFromUsageDocs = (name?: string, stopAtExamples = true): string | undefined => {
    if (!name) {
      return undefined;
    }
    // prefer generated bundle
    if (USAGE_DOCS && name in USAGE_DOCS) {
      return stripTitleFromMarkdown(USAGE_DOCS[name], stopAtExamples);
    }
    // fall back to short mapping
    if (USAGE_HELP && name in USAGE_HELP) {
      return stripTitleFromMarkdown(USAGE_HELP[name], stopAtExamples);
    }
    // last resort: read raw documentation file from repository
    try {
      const file = path.resolve(__dirname, '..', '..', 'documentation', 'usage', `${name}.md`);
      const content = getFileSystem().readFileSync(file, 'utf8');
      return stripTitleFromMarkdown(content, stopAtExamples);
    } catch (e) {
      return undefined;
    }
  };

  // If a topic argument was provided via `raili help <topic>` prefer topic semantics
  if (!command && topic) {
    const doc = loadFromUsageDocs(topic, true);
    if (doc) {
      return doc.trim();
    }
    if (topic in HELP_TOPICS) {
      return HELP_TOPICS[topic as keyof typeof HELP_TOPICS].trim();
    }
    return (`Unknown topic: ${topic}\n\nGet help with ` + '`raili help` or `raili --help`.').trim();
  }

  // raili <command> --help or raili help <command> (when passed as first arg)
  if (command && !topic) {
    const doc = loadFromUsageDocs(command, true);
    const txt = COMMAND_HELP[command];
    // Prefer to include the legacy single-line usage while also returning the
    // more detailed documentation when available so tests expecting both
    // the short usage and the extended hints succeed.
    if (txt && doc) {
      return (txt + '\n\n' + doc).trim();
    }
    if (doc) {
      return doc.trim();
    }
    if (txt) {
      return txt.trim();
    }
    return (
      `Unknown command: ${command}\n\nGet help with ` + '`raili help` or `raili --help`.'
    ).trim();
  }

  // raili help (no args) — prefer full help document when available
  const doc = loadFromUsageDocs('help', true);
  if (doc) {
    return doc.trim();
  }
  return GLOBAL_USAGE.trim();
}

export function printHelp(command?: string, topic?: string): void {
  process.stdout.write(formatHelp(command, topic) + '\n');
}
