// Schema formatter: Convert ObjectSchema definitions to readable text
// This reads src/schemas.ts exports and formats them for `raili schema` command

import * as schemasModule from '../workflow/schemas';
import {FieldSchema, ObjectSchema} from '../workflow/schemas';

/**
 * Format a single field for display
 */
function formatField(key: string, field: FieldSchema, indent: string = '  '): string {
  const required = field.required ? '(REQUIRED)' : '(OPTIONAL)';
  const typeStr = field.type === 'record' ? 'object' : field.type;

  let line = `${indent}${key}: ${typeStr} ${required}`;

  if (field.enum) {
    line += ` — one of: ${field.enum.join(', ')}`;
  }

  const description = field.description ? `\n${indent}  ${field.description}` : '';

  if (field.validForTypes) {
    const types = field.validForTypes.join(', ');
    return `${line}${description}\n${indent}  (only for type: ${types})`;
  }

  return line + description;
}

/**
 * Format a complete object schema section
 */
function formatObjectSchema(title: string, schema: ObjectSchema): string {
  const lines = [`${title}\n`];

  for (const [key, field] of Object.entries(schema)) {
    lines.push(formatField(key, field));
  }

  return lines.join('\n');
}

/**
 * Generate the complete schema output
 */
export function generateSchemaOutput(): string {
  const output: string[] = [];

  output.push('RAILI WORKFLOW YAML SCHEMA');
  output.push('');
  output.push('This schema describes all valid fields in workflow.yaml');
  output.push('');
  output.push('');

  // Top-level workflow schema
  output.push(formatObjectSchema('Workflow Top-Level', schemasModule.WorkflowConfigSchema));
  output.push('');
  output.push('');

  // State configuration schema
  output.push(formatObjectSchema('State Configuration', schemasModule.StateConfigSchema));
  output.push('');
  output.push('');

  // Output configuration schema
  output.push(formatObjectSchema('Output Configuration', schemasModule.OutputConfigSchema));
  output.push('');
  output.push('');

  // Approval configuration schema
  output.push(formatObjectSchema('Approval Configuration', schemasModule.ApprovalConfigSchema));
  output.push('');
  output.push('');

  output.push('ROUTING RULES');
  output.push('');
  output.push('A state MUST have exactly ONE of: on, transitions, or approval');
  output.push('');
  output.push('- on:          Binary routing (exit code 0=PASSED, else FAILED)');
  output.push('- transitions: Named routing (last stdout line must match a key)');
  output.push('- approval:    Manual approval (user yes/no)');
  output.push('');
  output.push('No routing defined → terminal state (workflow stops)');
  output.push('');
  output.push('SPECIAL NOTES');
  output.push('');
  output.push('- Agents always exit code 0 → use transitions: for routing agents');
  output.push('- A state must have exactly ONE of: on, transitions, approval');
  output.push('- Missing routing key in transitions: throws immediately');
  output.push('- Variables can be interpolated in prompts and approval questions');

  return output.join('\n');
}

const SCHEMA_OUTPUT = generateSchemaOutput();
