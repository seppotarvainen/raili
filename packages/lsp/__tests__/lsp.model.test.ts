import { WorkflowDocument } from '../src/lsp_workflowDocument';

const dummyShape = {
  states: [
    { name: 'a', location: { line: 1, column: 1 } },
    { name: 'b', location: { line: 2, column: 1 } },
  ],
  references: [{ name: 'b', context: 'transitions', location: { line: 1, column: 10 } }],
  positionMap: new Map<string, { kind: 'def' | 'ref'; name: string; context?: string }>(),
};

dummyShape.positionMap.set('1:1', { kind: 'def', name: 'a' });

describe('WorkflowDocument model', () => {
  test('exposes states and references', () => {
    const doc = new WorkflowDocument(dummyShape as any);
    expect(doc.statesList().length).toBe(2);
    expect(doc.states().length).toBe(2);
    expect(doc.stateReferences().length).toBe(1);
    expect(doc.findAtPosition(1, 1)).toEqual({ kind: 'def', name: 'a' });
    expect(doc.findAtPosition(9, 9)).toBeNull();
  });
});
