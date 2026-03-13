// Pure, deterministic help formatter for the Raili CLI.
// Loads help topics from generated-docs.ts (built from documentation/ markdown files)

import { HELP_TOPICS, AVAILABLE_TOPICS } from './generated-docs';

export const GLOBAL_USAGE = "Usage: raili <command> [options]";

const COMMAND_HELP: Record<string, string> = {
  init: "Usage: raili init\n\nInitialize a new .raili/ directory with template files.",
  run: "Usage: raili run [--clean | --continue] [--var key=value ...]\n\nValidate and execute the configured workflow.",
  help: "Usage: raili help [topic]\n\nShow help on general usage or a specific topic.",
  docs: "Usage: raili docs [section]\n\nDisplay full workflow.yaml reference documentation.",
  schema: "Usage: raili schema\n\nDisplay YAML workflow schema with all state fields and types.",
};

export function formatHelp(command?: string, topic?: string): string {
  // raili help <topic>
  if (!command && topic) {
    if (topic in HELP_TOPICS) {
      return HELP_TOPICS[topic as keyof typeof HELP_TOPICS];
    }
    return "Unknown topic: " + topic + "\n\nAvailable topics:\n" + AVAILABLE_TOPICS.join(", ");
  }

  // raili help <command>
  if (command && !topic) {
    const txt = COMMAND_HELP[command];
    if (txt) return txt.trim();
    return ("Unknown command: " + command + "\n\n" + GLOBAL_USAGE).trim();
  }

  // raili help (no args)
  return GLOBAL_USAGE.trim();
}

export function printHelp(command?: string, topic?: string): void {
  process.stdout.write(formatHelp(command, topic) + "\n");
}

