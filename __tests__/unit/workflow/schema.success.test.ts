import {validateStateConfig} from '../../../src/workflow/schemaValidator';

describe('SchemaValidator - success field', () => {
  it('accepts engine state with success boolean', () => {
    const config = { type: 'engine', success: true };
    expect(() => validateStateConfig(config, 'term')).not.toThrow();
  });

  it('throws when non-engine state has success field', () => {
    const config = { type: 'agent', agent: 'a', success: true };
    expect(() => validateStateConfig(config, 'bad')).toThrow(/field 'success' is only valid for type: engine/i);
  });

  it('throws when success has wrong type', () => {
    const config = { type: 'engine', success: 'yes' };
    expect(() => validateStateConfig(config, 'badtype')).toThrow(/Field 'success': expected boolean/i);
  });
});
