import { parseWorkflow } from '../src/lsp_workflowParser';

describe('workflowParser', () => {
  test('parses state definitions and positions', () => {
    const yaml = `initial: start
states:
  start:
    type: agent
    transitions:
      approve: merge
      reject: fix
  merge:
    type: engine
  fix:
    type: script
`;
    const { states, references, positionMap } = parseWorkflow(yaml);
    expect(states.map((s) => s.name).sort()).toEqual(['fix', 'merge', 'start'].sort());
    const start = states.find((s) => s.name === 'start')!;
    expect(start.location.line).toBe(3);
    expect(start.location.column).toBeGreaterThan(0);

    const refNames = references.map((r) => r.name).sort();
    expect(refNames).toEqual(['fix', 'merge', 'start'].sort());

    const anyRef = Array.from(positionMap.values()).find((v) => v.kind === 'ref');
    expect(anyRef).toBeDefined();
  });

  test('parses inline mappings in on: {PASSED: done}', () => {
    const yaml = `states:
   checker:
     type: script
     on: {PASSED: done, FAILED: error}
   done:
     type: engine
   error:
     type: engine
 `;
    const { states, references } = parseWorkflow(yaml);
    expect(states.map((s) => s.name).sort()).toEqual(['checker', 'done', 'error'].sort());
    expect(references.map((r) => r.name).sort()).toEqual(['done', 'error'].sort());
  });

  test('parses approval block with PASSED/FAILED state references', () => {
    const yaml = `states:
   review:
     type: engine
     approval:
       multiline: true
       question: "Do you approve?"
       notify: say "waiting for approval"
       PASSED: merge
       FAILED: rework
   merge:
     type: engine
   rework:
     type: engine
 `;
    const { states, references } = parseWorkflow(yaml);
    expect(states.map((s) => s.name).sort()).toEqual(['merge', 'review', 'rework'].sort());
    // Should only capture merge and rework, not true or "waiting..." or other values
    expect(references.map((r) => r.name).sort()).toEqual(['merge', 'rework'].sort());
    // Should all be marked as approval context
    expect(references.every((r) => r.context === 'approval')).toBe(true);
  });

  test('does not extract non-state values from approval block properties', () => {
    const yaml = `states:
   check_done:
     type: engine
     approval:
       multiline: true
       notify: say "Completed RAI-76"
       question: "Do you want to commit?"
       PASSED: final_diff
       FAILED: invented
   final_diff:
     type: engine
   invented:
     type: engine
 `;
    const { states, references } = parseWorkflow(yaml);
    const refNames = references.map((r) => r.name).sort();
    // Should NOT include: true, "Completed", "RAI-76", "Do", "you", "want", "to", "commit", etc.
    // Should only include: final_diff, invented
    expect(refNames.sort()).toEqual(['final_diff', 'invented'].sort());
  });
});
