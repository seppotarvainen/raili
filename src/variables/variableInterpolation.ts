/**
 * Variable interpolation utility for workflow configuration strings.
 *
 * Substitutes ${VARIABLE_NAME} placeholders with values from context.vars.
 * - Fails fast if a referenced variable is not defined.
 * - $$ escapes to a literal $ (so $${VAR} becomes ${VAR}).
 * - All other $ characters are left as-is.
 */

interface InterpolationOptions {
  throwOnMissing?: boolean; // default: true (fail-fast)
  missingValue?: string; // when provided and throwOnMissing is false, use this for missing vars
}

/**
 * Interpolate a single string by substituting ${VAR_NAME} with values from vars.
 *
 * @param text - The text to interpolate
 * @param vars - Variable dictionary (typically context.vars)
 * @param options - Interpolation options
 * @returns Interpolated string
 * @throws Error if a variable is referenced but not defined (when throwOnMissing is true)
 */
export function interpolateString(
  text: string,
  vars: Record<string, string>,
  options: InterpolationOptions = {},
): string {
  const { throwOnMissing = true, missingValue } = options;

  // First pass: replace $$ with a placeholder to protect it
  const ESCAPE_PLACEHOLDER = '\x00RAILI_ESCAPED_DOLLAR\x00';
  let result = text.replace(/\$\$/g, ESCAPE_PLACEHOLDER);

  // Second pass: find and replace ${VAR_NAME} patterns
  const varPattern = /\$\{([A-Za-z_][A-Za-z0-9_]*)\}/g;
  result = result.replace(varPattern, (match, varName) => {
    if (!(varName in vars)) {
      if (throwOnMissing) {
        throw new Error(`Variable '${varName}' is not defined. Referenced in: "${text}"`);
      }
      if (typeof missingValue !== 'undefined') {
        return missingValue;
      }
      return match; // leave as-is if not throwing and no missingValue provided
    }
    return vars[varName];
  });

  // Third pass: restore escaped dollars
  result = result.replace(new RegExp(ESCAPE_PLACEHOLDER, 'g'), '$');

  return result;
}

/**
 * Interpolate all string values in an object recursively.
 * Useful for processing entire config objects.
 *
 * @param obj - Object to interpolate (mutated in place)
 * @param vars - Variable dictionary
 * @param options - Interpolation options
 */
export function interpolateObject(
  obj: any,
  vars: Record<string, string>,
  options: InterpolationOptions = {},
): any {
  if (typeof obj === 'string') {
    return interpolateString(obj, vars, options);
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => interpolateObject(item, vars, options));
  }

  if (obj !== null && typeof obj === 'object') {
    const result: Record<string, any> = {};
    for (const [key, value] of Object.entries(obj)) {
      result[key] = interpolateObject(value, vars, options);
    }
    return result;
  }

  // Primitives (number, boolean, null)
  return obj;
}
