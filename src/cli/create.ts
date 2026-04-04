import { getFileSystem } from '../infrastructure/fileSystemProvider';
import path from 'path';
import { generateWorkflowYaml } from '../init';

export async function createCommand(
  cwd: string,
  workflowName: string,
): Promise<{ created: true; workflowName: string }> {
  const fs = getFileSystem();
  if (!workflowName || typeof workflowName !== 'string') {
    throw new Error('Workflow name must be provided');
  }
  if (workflowName.trim() === '' || workflowName.includes('/') || workflowName.includes('\\')) {
    throw new Error('Invalid workflow name');
  }

  const railiDir = path.join(cwd, '.raili');
  if (!fs.existsSync(railiDir)) {
    throw new Error('.raili/ directory not found. Run `raili init` first');
  }

  const targetDir = path.join(railiDir, workflowName);
  if (fs.existsSync(targetDir)) {
    throw new Error(`.raili/${workflowName} already exists`);
  }

  // Create scaffold
  fs.mkdirSync(targetDir, { recursive: true });
  fs.mkdirSync(path.join(targetDir, 'outputs'), { recursive: true });
  fs.mkdirSync(path.join(targetDir, 'learnings'), { recursive: true });

  const yaml = generateWorkflowYaml(workflowName);
  fs.writeFileSync(path.join(targetDir, 'workflow.yaml'), yaml);
  fs.writeFileSync(path.join(targetDir, 'vars.yaml'), `# vars for ${workflowName}\n`);

  return { created: true, workflowName };
}
