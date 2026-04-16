import { WorkflowDocumentShape, StateDef, StateRef, PositionMapEntry } from './lsp_types';

export class WorkflowDocument implements WorkflowDocumentShape {
  private _states: StateDef[];
  references: StateRef[];
  positionMap: Map<string, PositionMapEntry>;

  constructor(shape: WorkflowDocumentShape) {
    // shape.states may be either an array (from parser) or a callable (from
    // other WorkflowDocument-like shapes). Normalize to an array here.
    this._states = typeof shape.states === 'function' ? shape.states() : shape.states;
    this.references = shape.references;
    this.positionMap = shape.positionMap;
  }

  // Backwards-compatible alias that returns the internal states array
  statesList(): StateDef[] {
    return this._states;
  }

  // Public API expected by callers: states()
  states(): StateDef[] {
    return this._states;
  }

  stateReferences(): StateRef[] {
    return this.references;
  }

  findAtPosition(line: number, column: number): PositionMapEntry | null {
    // Exact match first
    const exact = this.positionMap.get(`${line}:${column}`);
    if (exact) return exact;

    // Range match: check if cursor is within any name span on this line
    for (const [key, entry] of this.positionMap) {
      const [l, c] = key.split(':').map(Number);
      if (l === line && column >= c && column < c + entry.name.length) {
        return entry;
      }
    }
    return null;
  }
}
