// Pure, deterministic help formatter for the Raili CLI.
// Loads help topics from generatedDocs.ts (built from documentation/ markdown files)

import { HELP_TOPICS, USAGE_HELP, AVAILABLE_TOPICS, AVAILABLE_USAGE } from './generatedDocs';

const GLOBAL_USAGE = 'Usage: raili <command> [options]';

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

export function formatHelp(command?: string, topic?: string): string {
  // raili help <topic> or <usage>
  if (!command && topic) {
    // Check usage docs first
    if (topic in USAGE_HELP) {
      return USAGE_HELP[topic as keyof typeof USAGE_HELP];
    }
    // Then check feature topics
    if (topic in HELP_TOPICS) {
      return HELP_TOPICS[topic as keyof typeof HELP_TOPICS];
    }
    const allTopics = [...AVAILABLE_USAGE, ...AVAILABLE_TOPICS];
    return 'Unknown topic: ' + topic + '\n\nAvailable topics:\n' + allTopics.join(', ');
  }

  // raili help <command>
  if (command && !topic) {
    const txt = COMMAND_HELP[command];
    if (txt) {
      return txt.trim();
    }
    return ('Unknown command: ' + command + '\n\n' + GLOBAL_USAGE).trim();
  }

  // raili help (no args)
  return GLOBAL_USAGE.trim();
}

export function printHelp(command?: string, topic?: string): void {
  process.stdout.write(formatHelp(command, topic) + '\n');
}
