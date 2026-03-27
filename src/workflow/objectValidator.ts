import { ObjectSchema } from './schemas';
import { validateField } from './fieldValidator';
import { SchemaValidationError } from './schemaErrors';
import { StateType } from '../types';

export function validateObject(
  obj: any,
  schema: ObjectSchema,
  context = '',
  stateType?: StateType,
): void {
  if (typeof obj !== 'object' || obj === null || Array.isArray(obj)) {
    throw new SchemaValidationError(
      `Expected object, got ${Array.isArray(obj) ? 'array' : typeof obj}`,
      context,
    );
  }

  for (const [fieldName, fieldSchema] of Object.entries(schema)) {
    const fieldValue = obj[fieldName];
    validateField(fieldName, fieldValue, fieldSchema, stateType, context);
  }

  for (const fieldName of Object.keys(obj)) {
    if (!(fieldName in schema)) {
      throw new SchemaValidationError(`Unknown field '${fieldName}'`, context);
    }
  }
}
