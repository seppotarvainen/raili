import { StateType } from '../types';
import { FieldSchema } from './schemas';
import { SchemaValidationError } from './schemaErrors';

export function validateFieldType(value: any, expectedType: string, fieldName: string): void {
  if (value === null || value === undefined) {
    return; // null/undefined checked separately for required fields
  }

  switch (expectedType) {
    case 'string':
      if (typeof value !== 'string') {
        throw new SchemaValidationError(
          `Field '${fieldName}': expected string, got ${typeof value}`,
        );
      }
      break;
    case 'boolean':
      if (typeof value !== 'boolean') {
        throw new SchemaValidationError(
          `Field '${fieldName}': expected boolean, got ${typeof value}`,
        );
      }
      break;
    case 'number':
      if (typeof value !== 'number') {
        throw new SchemaValidationError(
          `Field '${fieldName}': expected number, got ${typeof value}`,
        );
      }
      break;
    case 'array':
      if (!Array.isArray(value)) {
        throw new SchemaValidationError(
          `Field '${fieldName}': expected array, got ${typeof value}`,
        );
      }
      break;
    case 'object':
      if (typeof value !== 'object' || value === null || Array.isArray(value)) {
        throw new SchemaValidationError(
          `Field '${fieldName}': expected object, got ${Array.isArray(value) ? 'array' : typeof value}`,
        );
      }
      break;
    case 'record':
      if (typeof value !== 'object' || value === null || Array.isArray(value)) {
        throw new SchemaValidationError(
          `Field '${fieldName}': expected object, got ${Array.isArray(value) ? 'array' : typeof value}`,
        );
      }
      break;
    default:
      break;
  }
}

export function validateField(
  fieldName: string,
  fieldValue: any,
  fieldSchema: FieldSchema,
  stateType?: StateType,
  context?: string,
): void {
  if (fieldSchema.required && (fieldValue === null || fieldValue === undefined)) {
    throw new SchemaValidationError(`Required field '${fieldName}' is missing`, context);
  }

  if (fieldValue === null || fieldValue === undefined) {
    return;
  }

  if (fieldSchema.validForTypes && stateType) {
    if (!fieldSchema.validForTypes.includes(stateType as StateType)) {
      throw new SchemaValidationError(
        `Field '${fieldName}' is only valid for type: ${fieldSchema.validForTypes.join(', ')}. ` +
          `This state has type: ${stateType}`,
        context,
      );
    }
  }

  validateFieldType(fieldValue, fieldSchema.type, fieldName);

  if (fieldSchema.enum && typeof fieldValue === 'string') {
    if (!fieldSchema.enum.includes(fieldValue)) {
      throw new SchemaValidationError(
        `Field '${fieldName}' must be one of: ${fieldSchema.enum.join(', ')}. Got: ${fieldValue}`,
        context,
      );
    }
  }

  if (fieldSchema.recordKeyEnum && fieldSchema.type === 'record') {
    const invalidKeys = Object.keys(fieldValue).filter(
      (key) => !fieldSchema.recordKeyEnum!.includes(key),
    );
    if (invalidKeys.length > 0) {
      throw new SchemaValidationError(
        `Field '${fieldName}': unknown key '${invalidKeys[0]}'. ` +
          `Allowed keys: ${fieldSchema.recordKeyEnum.join(', ')}`,
        context,
      );
    }
  }
}
