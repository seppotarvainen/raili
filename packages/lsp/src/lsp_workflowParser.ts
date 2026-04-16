import { StateDef, StateRef, Position, PositionMapEntry } from './lsp_types';

export function parseWorkflow(text: string): { states: StateDef[]; references: StateRef[]; positionMap: Map<string, PositionMapEntry> } {
  const lines = text.split(/\r?\n/);
  const states: StateDef[] = [];
  const references: StateRef[] = [];
  const positionMap = new Map<string, PositionMapEntry>();

  // Parse 'initial: <state>' reference
  for (let i = 0; i < lines.length; i++) {
    const initialMatch = lines[i].match(/^\s*initial\s*:\s*(?:"|')?([A-Za-z0-9_-]+)(?:"|')?\s*(#.*)?$/);
    if (initialMatch) {
      const target = initialMatch[1];
      const col = lines[i].indexOf(target) + 1;
      const refPos: Position = { line: i + 1, column: col };
      references.push({ name: target, context: 'initial', location: refPos });
      positionMap.set(`${refPos.line}:${refPos.column}`, { kind: 'ref', name: target, context: 'initial' });
      break;
    }
  }

  let statesLineIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    if (/^\s*states\s*:\s*(#.*)?$/.test(lines[i])) {
      statesLineIdx = i;
      break;
    }
  }

  if (statesLineIdx === -1) {
    return { states, references, positionMap };
  }

  const statesIndentMatch = lines[statesLineIdx].match(/^(\s*)/);
  const statesIndent = statesIndentMatch ? statesIndentMatch[1].length : 0;

   const addPos = (pos: Position, entry: PositionMapEntry) => {
     positionMap.set(`${pos.line}:${pos.column}`, entry);
   };

   // Helper: check if a value looks like a state reference (not a boolean, not a shell command)
   const looksLikeStateRef = (value: string): boolean => {
     if (value === 'true' || value === 'false' || value === 'null') return false;
     if (/^[0-9]/.test(value)) return false; // starts with number
     if (value.includes('/') || value.includes('.')) return false; // looks like a path
     return true;
   };

   let firstStateIndent = -1;
   for (let i = statesLineIdx + 1; i < lines.length; i++) {
     const line = lines[i];
     if (/^\s*$/.test(line)) continue;
     const indentMatch = line.match(/^(\s*)/);
     const indent = indentMatch ? indentMatch[1].length : 0;
     if (indent <= statesIndent) break;


     const stateKeyMatch = line.match(/^\s*([A-Za-z0-9_-]+)\s*:\s*(#.*)?$/);
     if (!stateKeyMatch) continue;

     // Only treat keys at the first-level state indent as state definitions.
     if (firstStateIndent === -1) {
       firstStateIndent = indent;
     }
     if (indent !== firstStateIndent) {
       // This is a deeper property (e.g. 'transitions:' under a state) — skip treating as a state.
       continue;
     }

     const name = stateKeyMatch[1];
     const col = line.indexOf(name) + 1;
     const pos: Position = { line: i + 1, column: col };
     let type: string | undefined;
     for (let j = i + 1; j < lines.length; j++) {
       const l = lines[j];
       const lIndent = (l.match(/^(\s*)/) || ['',''])[1].length;
       if (lIndent <= indent) break;
       const typeMatch = l.match(/^\s*type\s*:\s*([A-Za-z0-9_-]+)/);
       if (typeMatch) {
         type = typeMatch[1];
         break;
       }
     }
     const def: StateDef = { name, type, location: pos };
     states.push(def);
     addPos(pos, { kind: 'def', name });

     for (let j = i + 1; j < lines.length; j++) {
       const l = lines[j];
       const lIndent = (l.match(/^(\s*)/) || ['',''])[1].length;
       if (lIndent <= indent) break;

       const inlineOn = l.match(/\bon\s*:\s*\{([^}]*)\}/);
       if (inlineOn) {
         const inside = inlineOn[1];
         const pairs = inside.split(',');
         pairs.forEach(pair => {
           const m = pair.match(/\s*([A-Za-z0-9_-]+)\s*:\s*([A-Za-z0-9_-]+)/);
           if (m) {
             const target = m[2];
             const colRef = l.indexOf(target) + 1;
             const refPos: Position = { line: j + 1, column: colRef };
             references.push({ name: target, context: 'on', location: refPos });
             addPos(refPos, { kind: 'ref', name: target, context: 'on' });
           }
         });
       }

         const refBlockMatch = l.match(/^\s*(on|transitions|skip|continue)\s*:\s*(#.*)?$/);
         if (refBlockMatch) {
           const context = refBlockMatch[1];
           const blockIndent = lIndent;
           for (let k = j + 1; k < lines.length; k++) {
             const ll = lines[k];
             const llIndent = (ll.match(/^(\s*)/) || ['',''])[1].length;
             if (llIndent <= blockIndent) break;
             const kv = ll.match(/^\s*([A-Za-z0-9_-]+)\s*:\s*(?:"|')?([A-Za-z0-9_-]+)(?:"|')?\s*(#.*)?$/);
             if (kv) {
               const target = kv[2];
               if (looksLikeStateRef(target)) {
                 const colRef = ll.indexOf(target) + 1;
                 const refPos: Position = { line: k + 1, column: colRef };
                 references.push({ name: target, context, location: refPos });
                 addPos(refPos, { kind: 'ref', name: target, context });
               }
             }
           }
         }

        // Special handling for 'approval:' block - only PASSED and FAILED are state references
        const approvalMatch = l.match(/^\s*approval\s*:\s*(#.*)?$/);
        if (approvalMatch) {
          const blockIndent = lIndent;
          for (let k = j + 1; k < lines.length; k++) {
            const ll = lines[k];
            const llIndent = (ll.match(/^(\s*)/) || ['',''])[1].length;
            if (llIndent <= blockIndent) break;
            // Only capture PASSED and FAILED keys which contain state references
            const kv = ll.match(/^\s*(PASSED|FAILED)\s*:\s*(?:"|')?([A-Za-z0-9_-]+)(?:"|')?\s*(#.*)?$/);
            if (kv) {
              const target = kv[2];
              const colRef = ll.indexOf(target) + 1;
              const refPos: Position = { line: k + 1, column: colRef };
              references.push({ name: target, context: 'approval', location: refPos });
              addPos(refPos, { kind: 'ref', name: target, context: 'approval' });
            }
          }
        }

        const inlineTrans = l.match(/\btransitions\s*:\s*\{([^}]*)\}/);
        if (inlineTrans) {
          const inside = inlineTrans[1];
          const pairs = inside.split(',');
          pairs.forEach(pair => {
            const m = pair.match(/\s*([A-Za-z0-9_-]+)\s*:\s*([A-Za-z0-9_-]+)/);
            if (m) {
              const target = m[2];
              if (looksLikeStateRef(target)) {
                const colRef = l.indexOf(target) + 1;
                const refPos: Position = { line: j + 1, column: colRef };
                references.push({ name: target, context: 'transitions', location: refPos });
                addPos(refPos, { kind: 'ref', name: target, context: 'transitions' });
              }
            }
          });
        }
     }
   }

  return { states, references, positionMap };
}
