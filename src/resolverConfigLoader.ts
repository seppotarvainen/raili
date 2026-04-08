import { getFileSystem } from './infrastructure/fileSystemProvider';
import { ResolverConfig } from './types';

export function getResolverConfigDefaults(): ResolverConfig {
  return {
    trigger: {
      interval: 15,
      timeout: 10 * 60,
      retry_interval: 5,
    },
    approval: {
      timeout: 3600,
    },
    feedback: {
      timeout: 3600,
    },
  };
}

function isPlainObject(x: unknown): x is Record<string, unknown> {
  return x !== null && typeof x === 'object' && !Array.isArray(x);
}

function getNumberFieldStrict(
  obj: Record<string, unknown>,
  key: string,
  pathPrefix: string,
): number | undefined {
  if (Object.prototype.hasOwnProperty.call(obj, key)) {
    const v = obj[key];
    if (typeof v === 'number') return v;
    throw new Error(`${pathPrefix}.${key} must be a number`);
  }
  return undefined;
}

export function loadResolverConfig(configPath: string | null): ResolverConfig {
  const defaults = getResolverConfigDefaults();
  if (!configPath) return defaults;

  const fs = getFileSystem();
  if (!fs.existsSync(configPath)) {
    throw new Error(`Resolver config path does not exist: ${configPath}`);
  }

  let raw: string;
  try {
    raw = fs.readFileSync(configPath, 'utf8');
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`Unable to read resolver config at ${configPath}: ${msg}`);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`Malformed JSON in resolver config at ${configPath}: ${msg}`);
  }

  if (!isPlainObject(parsed)) {
    throw new Error('Resolver config must be a JSON object');
  }

  const parsedObj = parsed as Record<string, unknown>;

  const result: ResolverConfig = JSON.parse(JSON.stringify(defaults)); // deep copy

  if (parsedObj.trigger != null) {
    if (!isPlainObject(parsedObj.trigger)) throw new Error('resolverConfig.trigger must be an object');
    const trg = parsedObj.trigger as Record<string, unknown>;
    const interval = getNumberFieldStrict(trg, 'interval', 'resolverConfig.trigger');
    const timeout = getNumberFieldStrict(trg, 'timeout', 'resolverConfig.trigger');
    const retry_interval = getNumberFieldStrict(trg, 'retry_interval', 'resolverConfig.trigger');
    if (interval !== undefined) result.trigger = { ...result.trigger, interval };
    if (timeout !== undefined) result.trigger = { ...result.trigger, timeout };
    if (retry_interval !== undefined) result.trigger = { ...result.trigger, retry_interval };
  }

  if (parsedObj.approval != null) {
    if (!isPlainObject(parsedObj.approval)) throw new Error('resolverConfig.approval must be an object');
    const apr = parsedObj.approval as Record<string, unknown>;
    const timeout = getNumberFieldStrict(apr, 'timeout', 'resolverConfig.approval');
    if (timeout !== undefined) result.approval = { ...result.approval, timeout };
  }

  if (parsedObj.feedback != null) {
    if (!isPlainObject(parsedObj.feedback)) throw new Error('resolverConfig.feedback must be an object');
    const fb = parsedObj.feedback as Record<string, unknown>;
    const timeout = getNumberFieldStrict(fb, 'timeout', 'resolverConfig.feedback');
    if (timeout !== undefined) result.feedback = { ...result.feedback, timeout };
  }

  return result;
}
