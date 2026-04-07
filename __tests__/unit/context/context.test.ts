import path from 'path';
import { setupFakeFs } from '../infrastructure/fsFake.util';
import { getFileSystem } from '../../../src/infrastructure/fileSystemProvider';
import {
    addStateToHistory,
    clearContext,
    getCurrentState,
    getPreviousState,
    initializeContext,
    loadContext,
    saveContext,
} from '../../../src/context/context';
import * as outputStore from '../../../src/context/outputStore';

jest.mock('../../../src/context/outputStore');

describe('context', () => {
  let tmpdir: string;
  let railiDir: string;
  let restoreFs: () => void;

  beforeEach(() => {
    restoreFs = setupFakeFs();
    tmpdir = '/tmp/test-workspace';
    railiDir = path.join(tmpdir, '.raili');
    getFileSystem().mkdirSync(path.join(railiDir, 'main'), { recursive: true } as any);
  });

  afterEach(() => {
    restoreFs();
  });

  describe('loadContext', () => {
    test('returns empty context if file does not exist', () => {
      const ctx = loadContext(tmpdir);
      expect(ctx.stateHistory).toEqual([]);
      expect(ctx.vars).toEqual({});
    });

    test('loads existing context from file', () => {
      const contextData = {
        vars: { ticket_id: 'TICKET-123', description: 'Test ticket' },
        stateHistory: [
          { state: 'init', enteredAt: '2026-02-24T10:00:00Z' },
          { state: 'analyze', enteredAt: '2026-02-24T10:05:00Z' },
        ],
      };
      getFileSystem().writeFileSync(path.join(railiDir, 'main', 'context.json'), JSON.stringify(contextData));

      const ctx = loadContext(tmpdir);
      expect(ctx.vars?.ticket_id).toBe('TICKET-123');
      expect(ctx.stateHistory).toHaveLength(2);
      expect(ctx.stateHistory[0].state).toBe('init');
    });

    test('throws if context.json has invalid structure', () => {
      getFileSystem().writeFileSync(path.join(railiDir, 'main', 'context.json'), '{ "stateHistory": "not-an-array" }');
      expect(() => loadContext(tmpdir)).toThrow('stateHistory must be an array');
    });
  });

  describe('saveContext', () => {
    test('saves context to file', () => {
      const ctx = {
        vars: { ticket_id: 'TICKET-456', description: 'Another test' },
        stateHistory: [{ state: 'init', enteredAt: '2026-02-24T12:00:00Z' }],
      };

      saveContext(tmpdir, ctx);

      const saved = getFileSystem().readFileSync(path.join(railiDir, 'main', 'context.json'), 'utf8');
      const parsed = JSON.parse(saved);
      expect(parsed.vars.ticket_id).toBe('TICKET-456');
      expect(parsed.stateHistory).toHaveLength(1);
    });

    test('throws if .raili directory does not exist', () => {
      getFileSystem().rmSync(path.join(railiDir, 'main'), { recursive: true });
      const ctx = { stateHistory: [] };
      expect(() => saveContext(tmpdir, ctx)).toThrow('Unable to resolve workflow directory');
    });
  });

  describe('getCurrentState', () => {
    test('returns null if history is empty', () => {
      const ctx = { stateHistory: [] };
      expect(getCurrentState(ctx)).toBeNull();
    });

    test('returns last state from history', () => {
      const ctx = {
        stateHistory: [
          { state: 'init', enteredAt: '2026-02-24T10:00:00Z' },
          { state: 'analyze', enteredAt: '2026-02-24T10:05:00Z' },
          { state: 'plan', enteredAt: '2026-02-24T10:10:00Z' },
        ],
      };
      expect(getCurrentState(ctx)).toBe('plan');
    });
  });

  describe('getPreviousState', () => {
    test('returns null if history has less than 2 entries', () => {
      const ctx1 = { stateHistory: [] };
      expect(getPreviousState(ctx1)).toBeNull();

      const ctx2 = { stateHistory: [{ state: 'init', enteredAt: '2026-02-24T10:00:00Z' }] };
      expect(getPreviousState(ctx2)).toBeNull();
    });

    test('returns second-to-last state from history', () => {
      const ctx = {
        stateHistory: [
          { state: 'init', enteredAt: '2026-02-24T10:00:00Z' },
          { state: 'analyze', enteredAt: '2026-02-24T10:05:00Z' },
          { state: 'plan', enteredAt: '2026-02-24T10:10:00Z' },
        ],
      };
      expect(getPreviousState(ctx)).toBe('analyze');
    });
  });

  describe('addStateToHistory', () => {
    test('appends new state with timestamp', () => {
      const ctx = {
        vars: { ticket_id: 'TICKET-789' },
        stateHistory: [{ state: 'init', enteredAt: '2026-02-24T10:00:00Z' }],
      };

      const updated = addStateToHistory(ctx, 'analyze');
      expect(updated.stateHistory).toHaveLength(2);
      expect(updated.stateHistory[1].state).toBe('analyze');
      expect(updated.stateHistory[1].enteredAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
      expect(updated.vars?.ticket_id).toBe('TICKET-789'); // Preserves other properties
    });

    test('does not mutate original context', () => {
      const ctx = {
        stateHistory: [{ state: 'init', enteredAt: '2026-02-24T10:00:00Z' }],
      };

      const updated = addStateToHistory(ctx, 'analyze');
      expect(ctx.stateHistory).toHaveLength(1); // Original unchanged
      expect(updated.stateHistory).toHaveLength(2);
    });

    test('merges meta into existing last entry when updating same state', () => {
      const ctx = {
        stateHistory: [{ state: 'init', enteredAt: '2026-02-24T10:00:00Z' }],
      };

      const added = addStateToHistory(ctx, 'init', { notify: { command: 'echo hi', success: true } });
      expect(added.stateHistory).toHaveLength(1);
      expect(added.stateHistory[0].meta).toBeDefined();
      expect(added.stateHistory[0].meta?.notify.command).toBe('echo hi');
      expect(added.stateHistory[0].meta?.notify.success).toBe(true);
    });

    test('adds meta when appending a new state', () => {
      const ctx = {
        stateHistory: [{ state: 'init', enteredAt: '2026-02-24T10:00:00Z' }],
      };

      const updated = addStateToHistory(ctx, 'analyze', { approval: { question: 'Q', chosen: 'PASSED' } });
      expect(updated.stateHistory).toHaveLength(2);
      expect(updated.stateHistory[1].meta?.approval.question).toBe('Q');
      expect(updated.stateHistory[1].meta?.approval.chosen).toBe('PASSED');
    });

    test('merges meta into most recent matching state even if not last entry', () => {
      const ctx = {
        stateHistory: [
          { state: 'act', enteredAt: '2026-02-24T10:00:00Z' },
          { state: 'done', enteredAt: '2026-02-24T10:05:00Z' },
        ],
      };

      const updated = addStateToHistory(ctx, 'act', { approval: { question: 'Q', chosen: 'PASSED' } });
      expect(updated.stateHistory).toHaveLength(2);
      // The first entry (act) should have received the meta
      expect(updated.stateHistory[0].meta?.approval.question).toBe('Q');
      expect(updated.stateHistory[0].meta?.approval.chosen).toBe('PASSED');
      // The later 'done' entry must remain untouched
      expect(updated.stateHistory[1].meta).toBeUndefined();
    });
  });

  describe('initializeContext', () => {
    test('creates new context with vars', () => {
      const ctx = initializeContext({ ticket_id: 'TICKET-999', description: 'Test description' });

      expect(ctx.vars?.ticket_id).toBe('TICKET-999');
      expect(ctx.vars?.description).toBe('Test description');
      expect(ctx.stateHistory).toHaveLength(0);
    });

    test('creates context with empty vars', () => {
      const ctx = initializeContext({});
      expect(ctx.vars).toEqual({});
      expect(ctx.stateHistory).toHaveLength(0);
    });
  });

  describe('clearContext', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    test('deletes context.json', () => {
      const contextPath = path.join(railiDir, 'main', 'context.json');
      getFileSystem().writeFileSync(contextPath, JSON.stringify({ stateHistory: [] }));
      expect(getFileSystem().existsSync(contextPath)).toBe(true);

      clearContext(tmpdir);

      expect(getFileSystem().existsSync(contextPath)).toBe(false);
    });

    test('calls clearAllOutputs', () => {
      clearContext(tmpdir);
      expect(outputStore.clearAllOutputs).toHaveBeenCalledWith(tmpdir, undefined);
    });

    test('is silent if context.json does not exist', () => {
      expect(() => clearContext(tmpdir)).not.toThrow();
      expect(outputStore.clearAllOutputs).toHaveBeenCalledWith(tmpdir, undefined);
    });

    test('clears both context.json and outputs when both exist', () => {
      const contextPath = path.join(railiDir, 'main', 'context.json');
      getFileSystem().writeFileSync(contextPath, JSON.stringify({ stateHistory: [] }));
      expect(getFileSystem().existsSync(contextPath)).toBe(true);

      clearContext(tmpdir);

      expect(getFileSystem().existsSync(contextPath)).toBe(false);
      expect(outputStore.clearAllOutputs).toHaveBeenCalledWith(tmpdir, undefined);
    });
  });
});

