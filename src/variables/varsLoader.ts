import { getFileSystem } from '../infrastructure/fileSystemProvider';
import * as path from 'path';
import * as yaml from 'js-yaml';
import colors from 'colors/safe';
import { resolveWorkflowDir } from '../context/pathUtils';

/** Load .raili/vars.yaml if it exists. Only keys declared in workflow inputs are used. */
export function loadVarsFile(
  cwd: string,
  declared: string[],
  workflowPath?: string,
): Record<string, string> {
  const fs = getFileSystem();
  const railiDir = path.join(cwd, '.raili');

  function readAndFilter(filePath: string): Record<string, string> {
    if (!fs.existsSync(filePath)) {
      return {};
    }
    // Attempt to read file content; if unreadable, warn and skip.
    let content: string;
    try {
      content = fs.readFileSync(filePath, 'utf8');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(colors.yellow(`[Warning] Unable to read ${path.basename(filePath)}: ${msg}`));
      return {};
    }

    let parsed: any;
    try {
      parsed = yaml.load(content) as any;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(colors.yellow(`[Warning] Could not parse ${path.basename(filePath)}: ${msg}`));
      return {};
    }

    if (!parsed || typeof parsed !== 'object') {
      return {};
    }
    const result: Record<string, string> = {};
    const declaredSet = new Set(declared);
    const acceptAll = declared.length === 0;
    for (const [key, value] of Object.entries(parsed)) {
      if (acceptAll || declaredSet.has(key)) {
        if (value != null) {
          result[key] = String(value);
        }
      } else {
        console.warn(
          colors.yellow(
            `[Warning] Variable '${key}' in ${path.basename(filePath)} is not declared in workflow inputs. It will be ignored.`,
          ),
        );
      }
    }
    return result;
  }

  const workflowDir = resolveWorkflowDir(cwd, workflowPath);
  const data = readAndFilter(path.join(workflowDir, 'vars.yaml'));
  if (Object.keys(data).length > 0) {
    return data;
  }

  return readAndFilter(path.join(railiDir, 'vars.yaml'));
}
