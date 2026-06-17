/**
 * Helpers for parsing exported variables from stdout.
 * Accepts formats like:
 *   ID=123
 *   export ID=123
 *   id = "123"
 * Matching is case-insensitive for the key and trims surrounding quotes/spaces.
 */

export function parseExports(stdout: string, names: string[]): Record<string, string> {
  const exports: Record<string, string> = {};
  if (!stdout || !names || names.length === 0) {
    return exports;
  }

  const lines = stdout.split(/\r?\n/);

  if (lines.length === 1 && names.length === 1) {
    exports[names[0]] = lines[0].trim();
  }

  for (const name of names) {
    // Strip optional marker — matching and storage always use the base name
    const baseName = name.endsWith('?') ? name.slice(0, -1) : name;
    const re = new RegExp(`^\\s*(?:export\\s+)?${baseName}\\s*=\\s*(.*)\\s*$`, 'i');
    for (const line of lines) {
      const m = line.match(re);
      if (m?.[1] !== undefined) {
        let v = m[1].trim();
        // strip surrounding single or double quotes
        if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
          v = v.slice(1, -1);
        }
        exports[baseName] = v.trim();
        break;
      }
    }
  }

  return exports;
}
