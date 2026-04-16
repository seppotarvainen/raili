import { WorkflowDocument } from '../src/lsp_workflowDocument';
import { gotoDefinition } from '../src/protocol_definition';
import { findReferences } from '../src/protocol_references';
import { hover } from '../src/protocol_hover';
import { mapDiagnostics } from '../src/protocol_diagnostics';
import { computeRenameEdits } from '../src/protocol_rename';

const shape = {
  states: [
    { name: 'stateA', type: 'agent', location: { line: 1, column: 1 } },
    { name: 'stateB', type: 'engine', location: { line: 2, column: 1 } },
    // state with no explicit type to exercise hover unknown-type branch
    { name: 'stateC', location: { line: 5, column: 1 } },
  ],
  references: [
    { name: 'stateA', context: 'transitions', location: { line: 3, column: 5 } },
    { name: 'stateB', context: 'on', location: { line: 4, column: 5 } },
    { name: 'stateC', context: 'approval', location: { line: 6, column: 5 } },
  ],
  positionMap: new Map<string, { kind: 'def' | 'ref'; name: string; context?: string }>(),
};

shape.positionMap.set('1:1', { kind: 'def', name: 'stateA' });
shape.positionMap.set('3:5', { kind: 'ref', name: 'stateA', context: 'transitions' });
shape.positionMap.set('2:1', { kind: 'def', name: 'stateB' });
shape.positionMap.set('4:5', { kind: 'ref', name: 'stateB', context: 'on' });
shape.positionMap.set('5:1', { kind: 'def', name: 'stateC' });
shape.positionMap.set('6:5', { kind: 'ref', name: 'stateC', context: 'approval' });

describe('LSP protocol handlers', () => {
  const doc = new WorkflowDocument(shape as any);

  test('definition handler returns state definition location', () => {
    const def = gotoDefinition(doc, { line: 3, column: 5 });
    expect(def).not.toBeNull();
    // Definition now returns LSPLocation with range (0-indexed)
    expect(def?.range).toBeDefined();
    expect(def?.range.start.line).toBe(0); // 1-1 = 0 (0-indexed in LSP)
    expect(def?.range.start.character).toBe(0); // 1-1 = 0
  });

  test('references handler returns definition + all usages', () => {
    const refs = findReferences(doc, { line: 3, column: 5 });
    // definition + one usage
    expect(refs.length).toBe(2);
    const names = refs.map((r) => r.name);
    expect(names).toContain('stateA');
  });

  test('hover shows type and routing', () => {
    const h = hover(doc, { line: 3, column: 5 });
    expect(h).not.toBeNull();
    const content = h?.contents || '';
    expect(content).toContain('agent');
    expect(content).toContain('Routing');
  });

  test('hover handles unknown/absent type and prints unknown', () => {
    const h = hover(doc, { line: 6, column: 5 });
    expect(h).not.toBeNull();
    // stateC has no type, hover should show 'unknown' for Type
    const content = h?.contents || '';
    expect(content).toContain('unknown');
  });

  test('diagnostics maps validator output to diagnostics', () => {
    const errors = [
      {
        message: "State 'missing' not found",
        severity: 'error' as const,
        location: { line: 10, column: 2 },
      },
      {
        message: 'Potential issue',
        severity: 'warning' as const,
        location: { line: 11, column: 3 },
      },
      { message: 'FYI', severity: 'info' as const, location: { line: 12, column: 4 } },
      // exercise default branch by using an unknown severity (casted to any)
      { message: 'Unknown severity', severity: 'note' as any, location: { line: 13, column: 5 } },
    ];
    const diags = mapDiagnostics(errors);
    expect(diags.length).toBe(4);
    expect(diags[0].message).toContain('missing');
    // error -> 1
    expect(diags[0].severity).toBe(1);
    // warning -> 2
    expect(diags[1].severity).toBe(2);
    // info -> 3
    expect(diags[2].severity).toBe(3);
    // unknown/default -> 3
    expect(diags[3].severity).toBe(3);
  });

  test('rename produces edits for definition and references', () => {
    const edits = computeRenameEdits(doc, { line: 1, column: 1 }, 'newStateA');
    // should edit definition + one reference
    expect(edits!.length).toBe(2);
    expect(edits![0].newText).toBe('newStateA');
    expect(edits![1].newText).toBe('newStateA');
  });

  // Negative / branch coverage tests
  test('definition returns null when position unknown', () => {
    const def = gotoDefinition(doc, { line: 99, column: 1 });
    expect(def).toBeNull();
  });

  test('references returns empty array when position unknown', () => {
    const refs = findReferences(doc, { line: 99, column: 1 });
    expect(refs).toEqual([]);
  });

  test('hover returns null when position unknown', () => {
    const h = hover(doc, { line: 99, column: 1 });
    expect(h).toBeNull();
  });

  test('rename returns no edits when position unknown', () => {
    const edits = computeRenameEdits(doc, { line: 99, column: 1 }, 'noop');
    expect(edits).toBeNull();
  });

  test('definition returns null when entry exists but definition missing', () => {
    // add a reference entry to shape without adding a corresponding state definition
    shape.positionMap.set('7:5', { kind: 'ref', name: 'missingState', context: 'transitions' });
    const doc2 = new WorkflowDocument(shape as any);
    const def = gotoDefinition(doc2, { line: 7, column: 5 });
    expect(def).toBeNull();
  });
});
