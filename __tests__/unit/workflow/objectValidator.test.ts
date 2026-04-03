import { validateObject } from '../../../src/workflow/objectValidator';
import { SchemaValidationError } from '../../../src/workflow/schemaErrors';

describe('objectValidator', () => {
  test('throws when obj is null', () => {
    expect(() => validateObject(null, {}, 'ctx')).toThrow(SchemaValidationError);
    expect(() => validateObject(null, {}, 'ctx')).toThrow(/Expected object/);
  });

  test('throws when obj is an array', () => {
    expect(() => validateObject([], {}, 'ctx')).toThrow(SchemaValidationError);
    expect(() => validateObject([], {}, 'ctx')).toThrow(/Expected object, got array/);
  });

  test('throws when obj is a primitive', () => {
    expect(() => validateObject('string' as any, {}, 'ctx')).toThrow(SchemaValidationError);
    expect(() => validateObject(42 as any, {}, 'ctx')).toThrow(/Expected object/);
  });

  test('throws on unknown field', () => {
    expect(() => validateObject({ unknown: 'field' }, {}, 'ctx')).toThrow(SchemaValidationError);
    expect(() => validateObject({ unknown: 'field' }, {}, 'ctx')).toThrow(/Unknown field/);
  });

  test('valid empty object passes', () => {
    expect(() => validateObject({}, {}, 'ctx')).not.toThrow();
  });
});

