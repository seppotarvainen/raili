import { validateField, validateFieldType } from '../../src/workflow/fieldValidator';
import { SchemaValidationError } from '../../src/workflow/schemaErrors';

describe('fieldValidator', () => {
  test('rejects wrong primitive types', () => {
    expect(() =>
      validateField('name', 123 as any, { required: true, type: 'string' } as any, undefined, 'ctx'),
    ).toThrow(SchemaValidationError);

    expect(() => validateFieldType(42 as any, 'string', 'age')).toThrow(SchemaValidationError);
  });

  test('allows correct types', () => {
    expect(() => validateField('ok', 'yes', { required: true, type: 'string' } as any)).not.toThrow();
  });
});
