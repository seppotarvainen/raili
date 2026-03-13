// YAML schema reference for workflow.yaml
// Reads schema definitions from schemas.ts and formats them for display

import { generateSchemaOutput } from './schema-formatter';

export function formatSchema(): string {
  return generateSchemaOutput();
}

export function printSchema(): void {
  process.stdout.write(formatSchema() + "\n");
}

