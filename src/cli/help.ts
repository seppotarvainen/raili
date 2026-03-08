// Pure, deterministic help formatter for the Raili CLI.
// No filesystem access, no side effects beyond formatting strings.

export const GLOBAL_USAGE = `Usage: raili <command>

Commands:
  init   Initialize a .raili/ directory with template files
  run    Validate and execute the configured workflow

Examples:
  raili init
  raili run
  raili <command> --help
`;

const COMMAND_HELP: Record<string, string> = {
  init: `Usage: raili init

Initialize a new .raili/ directory with template files.

Examples:
  raili init
`,

  run: `Usage: raili run [--clean | --continue] [--var key=value ...]

Validate and execute the configured workflow. Fails fast if .raili/ or registries are missing or malformed.

Examples:
  raili run
  raili run --clean --var ticketId=123
`,
};

export function formatHelp(command?: string): string {
  if (!command) return GLOBAL_USAGE.trim();
  const txt = COMMAND_HELP[command];
  if (txt) return txt.trim();
  return (`Unknown command: ${command}\n\n${GLOBAL_USAGE}`).trim();
}

export function printHelp(command?: string): void {
  // Keep printing deterministic and easy to mock in tests.
  process.stdout.write(formatHelp(command) + '\n');
}

