import path from 'path';
import { getFileSystem } from '../infrastructure/fileSystemProvider';
import { loadWorkflowConfig } from '../workflow/workflowLoader';
import {
  validateAgentRegistry,
  validateScriptRegistry,
  validateWorkflowReferences,
} from '../registry/registryValidator';
import { buildGraph } from './graphBuilder';
import { renderMermaid } from './mermaidRenderer';
import { wrapMermaidInHtml } from './htmlWrapper';
import { resolveWorkflowDir } from '../context/pathUtils';

function getErrorMessage(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (typeof e === 'string') return e;
  try {
    return String(e);
  } catch {
    return 'Unknown error';
  }
}

export function visualCommand(
  cwd: string,
  workflowArg: string = 'main',
  format: string = 'mermaid',
  outPath?: string,
): void {
  const fs = getFileSystem();
  const railiDir = path.join(cwd, '.raili');
  if (!fs.existsSync(railiDir)) {
    throw new Error('.raili/ directory not found. Run `raili init` first.');
  }

  let workflowConfig;
  try {
    workflowConfig = loadWorkflowConfig(cwd, workflowArg);
  } catch (e: unknown) {
    // Wrap and rethrow with context so CLI surfaces clearer error messages in tests/logs
    throw new Error(`visual: failed to load workflow: ${getErrorMessage(e)}`);
  }

  // Validate registries and that workflow references exist (fail-fast)
  // Keep strict behavior: missing registries or invalid references should cause immediate failure
  const agents = validateAgentRegistry(cwd);
  const scripts = validateScriptRegistry(cwd);
  try {
    validateWorkflowReferences(workflowConfig, agents, scripts);
  } catch (e: unknown) {
    throw new Error(`visual: workflow reference validation failed: ${getErrorMessage(e)}`);
  }

  // Build graph and render
  const graph = buildGraph(workflowConfig);
  const mermaid = renderMermaid(graph);

  if (outPath === '-') {
    // Print raw mermaid to stdout
    // Keep behavior simple: console.log
    console.log(mermaid);
    return;
  }

  const workflowDir = resolveWorkflowDir(cwd, workflowArg);

  let target = outPath;
  if (!target) {
    target = path.join(workflowDir, 'diagram.html');
  }

  const dir = path.dirname(target);
  if (!fs.existsSync(dir)) {
    // Ensure directory exists
    try {
      fs.mkdirSync(dir, { recursive: true });
    } catch (e) {
      // Fallback: attempt plain mkdir
      fs.mkdirSync(dir);
    }
  }

  if (target.endsWith('.mmd')) {
    fs.writeFileSync(target, mermaid);
    printClickablePath(target);
    return;
  }

  // Default: produce HTML wrapper
  const html = wrapMermaidInHtml(mermaid);
  fs.writeFileSync(target, html);
  printClickablePath(target);
}

function printClickablePath(filePath: string): void {
  // Use OSC 8 hyperlink protocol for clickable paths in modern terminals
  const absolutePath = path.resolve(filePath);
  const fileUrl = `file://${absolutePath}`;
  const link = `\x1b]8;;${fileUrl}\x1b\\${filePath}\x1b]8;;\x1b\\`;
  console.log(`\nDiagram saved to: ${link}`);
}
