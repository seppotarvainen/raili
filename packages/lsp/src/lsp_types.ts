export type Position = { line: number; column: number };

export type StateDef = {
  name: string;
  type?: string;
  location: Position;
};

export type StateRef = {
  name: string;
  context: string; // e.g. 'on' | 'transitions' | 'approval' | 'skip'
  location: Position;
};

export type PositionMapEntry = {
  kind: 'def' | 'ref';
  name: string;
  context?: string;
};

export interface WorkflowDocumentShape {
  // Accept either a concrete array of states (used by parsers) or a function
  // that returns states (allows WorkflowDocument instances to expose a callable
  // API while still being constructible from plain shape objects).
  states: StateDef[] | (() => StateDef[]);
  references: StateRef[];
  positionMap: Map<string, PositionMapEntry>;
}
