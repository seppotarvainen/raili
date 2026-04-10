import {interpolateObject, interpolateString} from '../../../src/variables/variableInterpolation';

describe('variableInterpolation', () => {
  describe('interpolateString', () => {
    test('substitutes single variable', () => {
      const result = interpolateString('Hello ${NAME}', { NAME: 'World' });
      expect(result).toBe('Hello World');
    });

    test('substitutes multiple variables', () => {
      const result = interpolateString('${GREETING} ${NAME}!', {
        GREETING: 'Hello',
        NAME: 'Alice',
      });
      expect(result).toBe('Hello Alice!');
    });

    test('substitutes variables in multiline text', () => {
      const text = `Did you update the ticket?
Ticket: \${TICKET_ID}
Description: \${DESCRIPTION}`;
      const result = interpolateString(text, {
        TICKET_ID: 'PROJ-123',
        DESCRIPTION: 'Fix login bug',
      });
      expect(result).toContain('Ticket: PROJ-123');
      expect(result).toContain('Description: Fix login bug');
    });

    test('leaves non-variable $ characters as-is', () => {
      const result = interpolateString('Price: $100 and ${VAR}', { VAR: 'more' });
      expect(result).toBe('Price: $100 and more');
    });

    test('handles $$ escape sequence (becomes single $)', () => {
      const result = interpolateString('Price: $$100', {});
      expect(result).toBe('Price: $100');
    });

    test('$$ escape protects following braces from interpolation', () => {
      const result = interpolateString('Literal: $${NAME}', { NAME: 'Alice' });
      expect(result).toBe('Literal: ${NAME}');
    });

    test('multiple $$ escapes', () => {
      const result = interpolateString('$$1 + $$2 = ${RESULT}', { RESULT: '3' });
      expect(result).toBe('$1 + $2 = 3');
    });

    test('throws error if variable is missing (fail-fast default)', () => {
      expect(() => {
        interpolateString('Hello ${NAME}', {});
      }).toThrow("Variable 'NAME' is not defined");
    });

    test('includes context in error message', () => {
      const text = 'Ticket: ${TICKET_ID}';
      expect(() => {
        interpolateString(text, {});
      }).toThrow(`Variable 'TICKET_ID' is not defined. Referenced in: "${text}"`);
    });

    test('does not throw if throwOnMissing is false', () => {
      const result = interpolateString('Hello ${NAME}', {}, { throwOnMissing: false });
      expect(result).toBe('Hello ${NAME}');
    });

    test('replaces missing variable with empty string when requested', () => {
      const result = interpolateString('Hello ${NAME}', {}, { throwOnMissing: false, missingValue: '' });
      expect(result).toBe('Hello ');
    });

    test('handles variable names with underscores', () => {
      const result = interpolateString('${MY_VAR_NAME}', { MY_VAR_NAME: 'value' });
      expect(result).toBe('value');
    });

    test('handles variable names with numbers', () => {
      const result = interpolateString('${VAR123}', { VAR123: 'value' });
      expect(result).toBe('value');
    });

    test('rejects invalid variable names (starting with number)', () => {
      const result = interpolateString('${123VAR}', { '123VAR': 'value' }, { throwOnMissing: false });
      // Should not match invalid variable pattern
      expect(result).toBe('${123VAR}');
    });

    test('handles empty variables dict', () => {
      expect(() => {
        interpolateString('${VAR}', {});
      }).toThrow();
    });

    test('handles empty string', () => {
      const result = interpolateString('', { VAR: 'value' });
      expect(result).toBe('');
    });

    test('handles string with only escaped dollars', () => {
      const result = interpolateString('$$$$', {});
      expect(result).toBe('$$');
    });

    test('interpolates variable with special regex characters in value', () => {
      const result = interpolateString('Pattern: ${PATTERN}', { PATTERN: '.*+?[]{}()' });
      expect(result).toBe('Pattern: .*+?[]{}()');
    });
  });

  test('interpolates workflow variable in string', () => {
    const res = interpolateString('Run ${workflow} now', { workflow: 'main' });
    expect(res).toBe('Run main now');
  });

  describe('interpolateObject', () => {
    test('interpolates string values in object', () => {
      const obj = { name: '${NAME}', greeting: 'Hello ${NAME}' };
      const result = interpolateObject(obj, { NAME: 'Alice' });
      expect(result).toEqual({ name: 'Alice', greeting: 'Hello Alice' });
    });

    test('interpolates workflow in object recursively', () => {
      const obj = { a: 'deploy ${workflow}', list: ['x', '${workflow}'] };
      const res = interpolateObject(obj, { workflow: 'feature/1' });
      expect(res).toEqual({ a: 'deploy feature/1', list: ['x', 'feature/1'] });
    });

    test('preserves non-string values', () => {
      const obj = { count: 42, active: true, missing: null };
      const result = interpolateObject(obj, {});
      expect(result).toEqual({ count: 42, active: true, missing: null });
    });

    test('interpolates array of strings', () => {
      const arr = ['Hello ${NAME}', 'Goodbye ${NAME}'];
      const result = interpolateObject(arr, { NAME: 'World' });
      expect(result).toEqual(['Hello World', 'Goodbye World']);
    });

    test('interpolates nested object', () => {
      const obj = {
        user: {
          name: '${NAME}',
          email: '${EMAIL}',
        },
      };
      const result = interpolateObject(obj, { NAME: 'Alice', EMAIL: 'alice@example.com' });
      expect(result).toEqual({
        user: {
          name: 'Alice',
          email: 'alice@example.com',
        },
      });
    });

    test('interpolates array of objects', () => {
      const arr = [
        { name: '${NAME}' },
        { name: '${OTHER_NAME}' },
      ];
      const result = interpolateObject(arr, { NAME: 'Alice', OTHER_NAME: 'Bob' });
      expect(result).toEqual([{ name: 'Alice' }, { name: 'Bob' }]);
    });

    test('handles complex nested structure', () => {
      const obj = {
        title: '${TITLE}',
        items: [
          { name: '${ITEM_1}' },
          { name: '${ITEM_2}' },
        ],
        metadata: {
          description: '${DESC}',
        },
      };
      const result = interpolateObject(obj, {
        TITLE: 'My Title',
        ITEM_1: 'First',
        ITEM_2: 'Second',
        DESC: 'Description',
      });
      expect(result).toEqual({
        title: 'My Title',
        items: [{ name: 'First' }, { name: 'Second' }],
        metadata: { description: 'Description' },
      });
    });

    test('throws on missing variable in nested structure', () => {
      const obj = {
        user: {
          name: '${NAME}',
        },
      };
      expect(() => {
        interpolateObject(obj, {});
      }).toThrow("Variable 'NAME' is not defined");
    });
  });
});

