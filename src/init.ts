import fs from 'fs';
import path from 'path';

export async function initCommand(cwd: string) {
  const railiDir = path.join(cwd, '.raili');
  if (fs.existsSync(railiDir)) {
    // Do not overwrite existing files
    throw new Error('.raili/ already exists. Initialization aborted.');
  }

  fs.mkdirSync(railiDir);

  const workflowYaml = `states:\n  analyze:\n    type: agent\n    agent: analyzer.agent\n`;
  const agentRegistry = JSON.stringify({
    'analyzer.agent': { path: './agents/analyzer.agent.md' }
  }, null, 2);
  const scriptRegistry = JSON.stringify({
    'archive-part': './archive.sh'
  }, null, 2);

  fs.writeFileSync(path.join(railiDir, 'workflow.yaml'), workflowYaml);
  fs.writeFileSync(path.join(railiDir, 'agent-registry.json'), agentRegistry);
  fs.writeFileSync(path.join(railiDir, 'script-registry.json'), scriptRegistry);

  return { created: true };
}

