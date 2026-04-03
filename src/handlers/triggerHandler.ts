import path from 'path';
import { getFileSystem } from '../infrastructure/fileSystemProvider';
import { TriggerFunction } from '../types';

export async function loadTriggerModule(triggerPath: string): Promise<TriggerFunction> {
  const fs = getFileSystem();
  if (!fs.existsSync(triggerPath)) {
    throw new Error(`Trigger file not found: ${triggerPath}`);
  }

  const resolved = path.resolve(triggerPath);
  let mod: unknown;
  try {
    // Use Node require to load arbitrary JS modules (commonjs). Keep synchronous behavior here.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    mod = require(resolved);
  } catch (err: unknown) {
    // Narrow unknown to extract a message safely
    let msg: string;
    if (
      err &&
      typeof err === 'object' &&
      'message' in err &&
      typeof (err as { message?: unknown }).message === 'string'
    ) {
      msg = (err as { message?: string }).message as string;
    } else {
      msg = String(err);
    }
    throw new Error(`Failed to load trigger module: ${msg}`);
  }

  const modExport = (mod as { default?: unknown } | undefined)?.default ?? mod;
  if (typeof modExport !== 'function') {
    throw new Error(`Trigger module does not export a function: ${triggerPath}`);
  }

  // Lightweight validation: prefer async functions. Inspect constructor name without invoking user code.
  const fnCandidate = modExport as unknown;
  const ctorName =
    (fnCandidate &&
      (fnCandidate as Function).constructor &&
      (fnCandidate as Function).constructor.name) ||
    '';
  if (ctorName !== 'AsyncFunction') {
    throw new Error(`Trigger function must be async or return a Promise: ${triggerPath}`);
  }

  return fnCandidate as TriggerFunction;
}
