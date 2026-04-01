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

  test("rejects state with 'continue' and 'on'", () => {
    const cfg = { type: 'script', continue: 'next', on: { PASSED: 'a' } };
    expect(() => validateStateConfig(cfg, 's3')).toThrow(SchemaValidationError);
  });

  test("rejects state with 'continue' and 'transitions'", () => {
    const cfg = { type: 'script', continue: 'next', transitions: { ok: 'b' } };
    expect(() => validateStateConfig(cfg, 's4')).toThrow(SchemaValidationError);
  });

  test("rejects state with 'continue' and 'approval'", () => {
    const cfg = { type: 'script', continue: 'next', approval: { question: 'ok?', PASSED: 'p', FAILED: 'f' } };
    expect(() => validateStateConfig(cfg, 's5')).toThrow(SchemaValidationError);
  });

  test("rejects non-string or empty 'continue' values", () => {
    expect(() => validateStateConfig({ type: 'script', continue: 123 as any }, 's6')).toThrow(SchemaValidationError);
    expect(() => validateStateConfig({ type: 'script', continue: '' }, 's7')).toThrow(SchemaValidationError);
  });
});
