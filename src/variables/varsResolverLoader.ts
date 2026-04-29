import { VarsResolverFn, VarsResolverInput } from '../types';

export function parseResolveVarsArgs(rawArgs?: string[]): {
  namedArgs: Record<string, string>;
  positionalArgs: string[];
} {
  const namedArgs: Record<string, string> = {};
  const positionalArgs: string[] = [];
  if (!rawArgs || rawArgs.length === 0) {
    return { namedArgs, positionalArgs };
  }

  for (const token of rawArgs) {
    if (typeof token !== 'string') {
      positionalArgs.push(String(token));
      continue;
    }
    const eq = token.indexOf('=');
    if (eq > 0) {
      const key = token.slice(0, eq);
      const val = token.slice(eq + 1);
      namedArgs[key] = val;
    } else {
      positionalArgs.push(token);
    }
  }
  return { namedArgs, positionalArgs };
}

export function loadVarsResolver(resolverPath: string | null): VarsResolverFn | null {
  if (!resolverPath) {
    return null;
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const mod = require(resolverPath);
    const fn: VarsResolverFn | undefined = mod && (mod.default || mod);
    if (!fn || typeof fn !== 'function') {
      throw new Error('vars-resolver.js does not export a function');
    }
    return fn as VarsResolverFn;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`Failed to load vars-resolver.js: ${msg}`);
  }
}

export async function executeVarsResolver(
  resolverFn: VarsResolverFn,
  input: VarsResolverInput,
): Promise<Record<string, string>> {
  const res = await resolverFn(input as VarsResolverInput);
  if (res == null) {
    return {};
  }
  if (typeof res !== 'object') {
    throw new Error('vars-resolver returned invalid result (expected object or null)');
  }
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(res)) {
    if (typeof v !== 'string') {
      throw new Error(`vars-resolver returned non-string value for key '${k}'`);
    }
    out[k] = v;
  }
  return out;
}
