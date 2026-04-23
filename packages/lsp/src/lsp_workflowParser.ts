import { parseDocument, isMap, isPair, isScalar, YAMLMap } from 'yaml';
import { StateDef, StateRef, Position, PositionMapEntry } from './lsp_types';

/** Convert a byte offset in `text` to a 1-indexed {line, column}. */
function offsetToPosition(text: string, offset: number): Position {
  let line = 1;
  let col = 1;
  for (let i = 0; i < offset && i < text.length; i++) {
    if (text[i] === '\n') {
      line++;
      col = 1;
    } else {
      col++;
    }
  }
  return { line, column: col };
}

function scalarValue(node: unknown): string | null {
  return isScalar(node) ? String(node.value) : null;
}

function scalarPosition(text: string, node: unknown): Position | null {
  if (isScalar(node) && node.range) {
    return offsetToPosition(text, node.range[0]);
  }
  return null;
}

const APPROVAL_ROUTING_KEYS = new Set(['PASSED', 'FAILED']);

function looksLikeStateRef(value: string): boolean {
  if (value === 'true' || value === 'false' || value === 'null') return false;
  if (/^[0-9]/.test(value)) return false;
  if (value.includes('/') || value.includes('.')) return false;
  return true;
}

export function parseWorkflow(text: string): {
  states: StateDef[];
  references: StateRef[];
  positionMap: Map<string, PositionMapEntry>;
} {
  const states: StateDef[] = [];
  const references: StateRef[] = [];
  const positionMap = new Map<string, PositionMapEntry>();

  const doc = parseDocument(text, { keepSourceTokens: true });
  const root = doc.contents;
  if (!isMap(root)) return { states, references, positionMap };

  const addPos = (pos: Position, entry: PositionMapEntry) => {
    positionMap.set(`${pos.line}:${pos.column}`, entry);
  };

  const addRef = (name: string, context: string, pos: Position) => {
    references.push({ name, context, location: pos });
    addPos(pos, { kind: 'ref', name, context });
  };

  // ── initial: <state> ──────────────────────────────────────────────
  const initialPair = root.items.find((p) => isPair(p) && scalarValue(p.key) === 'initial');
  if (initialPair && isPair(initialPair)) {
    const target = scalarValue(initialPair.value);
    const pos = scalarPosition(text, initialPair.value);
    if (target && pos) {
      addRef(target, 'initial', pos);
    }
  }

  // ── states: ────────────────────────────────────────────────────────
  const statesPair = root.items.find((p) => isPair(p) && scalarValue(p.key) === 'states');
  if (!statesPair || !isPair(statesPair) || !isMap(statesPair.value)) {
    return { states, references, positionMap };
  }

  const statesMap = statesPair.value as YAMLMap;

  for (const item of statesMap.items) {
    if (!isPair(item)) continue;
    const stateName = scalarValue(item.key);
    const statePos = scalarPosition(text, item.key);
    if (!stateName || !statePos) continue;

    // Resolve type
    let type: string | undefined;
    if (isMap(item.value)) {
      const typePair = (item.value as YAMLMap).items.find(
        (p) => isPair(p) && scalarValue(p.key) === 'type',
      );
      if (typePair && isPair(typePair)) {
        type = scalarValue(typePair.value) || undefined;
      }
    }

    states.push({ name: stateName, type, location: statePos });
    addPos(statePos, { kind: 'def', name: stateName });

    // Extract routing references from this state's properties
    if (isMap(item.value)) {
      extractRefsFromState(text, item.value as YAMLMap, addRef);
    }
  }

  return { states, references, positionMap };
}

// ── helpers ──────────────────────────────────────────────────────────

function extractRefsFromState(
  text: string,
  stateMap: YAMLMap,
  addRef: (name: string, ctx: string, pos: Position) => void,
) {
  for (const prop of stateMap.items) {
    if (!isPair(prop)) continue;
    const key = scalarValue(prop.key);
    if (!key) continue;

    if (key === 'on' || key === 'transitions') {
      extractMapRefs(text, prop.value, key, addRef);
    } else if (key === 'continue' || key === 'skip') {
      // Scalar form: continue: state_name
      const target = scalarValue(prop.value);
      const pos = scalarPosition(text, prop.value);
      if (target && pos && looksLikeStateRef(target)) {
        addRef(target, key, pos);
      }
      // Block map form (e.g. continue:\n  key: state)
      if (isMap(prop.value)) {
        extractMapRefs(text, prop.value, key, addRef);
      }
    } else if (key === 'approval') {
      if (isMap(prop.value)) {
        for (const ap of (prop.value as YAMLMap).items) {
          if (!isPair(ap)) continue;
          const apKey = scalarValue(ap.key);
          if (apKey && APPROVAL_ROUTING_KEYS.has(apKey)) {
            const target = scalarValue(ap.value);
            const pos = scalarPosition(text, ap.value);
            if (target && pos) {
              addRef(target, 'approval', pos);
            }
          }
        }
      }
    }
  }
}

function extractMapRefs(
  text: string,
  node: unknown,
  context: string,
  addRef: (name: string, ctx: string, pos: Position) => void,
) {
  if (!isMap(node)) return;
  for (const pair of (node as YAMLMap).items) {
    if (!isPair(pair)) continue;
    const target = scalarValue(pair.value);
    const pos = scalarPosition(text, pair.value);
    if (target && pos && looksLikeStateRef(target)) {
      addRef(target, context, pos);
    }
  }
}
