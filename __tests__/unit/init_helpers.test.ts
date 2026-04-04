import {
  generateWorkflowYaml,
  generateAgentRegistry,
  generateScriptRegistry,
} from '../../src/init';

describe('init helpers', () => {
  test('generateWorkflowYaml returns expected header and initial state', () => {
    const yaml = generateWorkflowYaml();
    expect(typeof yaml).toBe('string');
    expect(yaml.startsWith('# Raili Workflow Configuration')).toBe(true);
    expect(yaml).toContain('initial: init');
  });

  test('generateAgentRegistry returns expected keys', () => {
    const reg = generateAgentRegistry();
    expect(typeof reg).toBe('object');
    const keys = Object.keys(reg);
    expect(keys).toEqual(
      expect.arrayContaining([
        'analyzer.agent',
        'planner.agent',
        'executor.agent',
        'verifier.agent',
      ]),
    );
    // Values should have a path property
    expect(reg['analyzer.agent']).toHaveProperty('path');
  });

  test('generateScriptRegistry returns expected keys', () => {
    const reg = generateScriptRegistry();
    expect(typeof reg).toBe('object');
    const keys = Object.keys(reg);
    expect(keys).toEqual(expect.arrayContaining(['archive-part', 'test-runner', 'git-commit']));
    expect(reg['test-runner']).toHaveProperty('path');
  });
});
