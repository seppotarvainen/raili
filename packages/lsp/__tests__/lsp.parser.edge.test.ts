import { parseWorkflow } from '../src/lsp_workflowParser';

describe('workflowParser edge cases', () => {
  test('handles duplicate state ids as separate definitions', () => {
    const yaml = `states:
  dup:
    type: agent
  dup:
    type: engine
`;
    const { states } = parseWorkflow(yaml);
    expect(states.filter((s) => s.name === 'dup').length).toBe(2);
  });

  test('ignores nested mapping keys as state definitions', () => {
    const yaml = `states:
  a:
    type: agent
    transitions:
      next: b
  b:
    type: engine
`;
    const { states } = parseWorkflow(yaml);
    expect(states.map((s) => s.name).sort()).toEqual(['a', 'b'].sort());
    expect(states.find((s) => s.name === 'transitions')).toBeUndefined();
    expect(states.find((s) => s.name === 'next')).toBeUndefined();
  });

  test('parses states when initial is missing', () => {
    const yaml = `states:
  only:
    type: engine
`;
    const { states } = parseWorkflow(yaml);
    expect(states.map((s) => s.name)).toEqual(['only']);
  });
});
