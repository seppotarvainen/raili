import { validateStateConfig } from '../../../src/workflow/stateValidator';
import { SchemaValidationError } from '../../../src/workflow/schemaErrors';

describe('stateValidator', () => {
  test("rejects state with both 'on' and 'transitions'", () => {
    const cfg = { type: 'script', on: { PASSED: 'a' }, transitions: { ok: 'b' } };
    expect(() => validateStateConfig(cfg, 's1')).toThrow(SchemaValidationError);
  });

  test("'on' requires PASSED key", () => {
    const cfg = { type: 'script', on: { FAILED: 'err' } };
    expect(() => validateStateConfig(cfg, 's2')).toThrow(SchemaValidationError);
  });
});
