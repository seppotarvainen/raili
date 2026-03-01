import fs from 'fs';
import path from 'path';
import os from 'os';
import {
  loadContext,
  saveContext,
  getCurrentState,
  getPreviousState,
  addStateToHistory,
  initializeContext,
} from '../src/context';

describe('context', () => {
  let tmpdir: string;
  let railiDir: string;

  beforeEach(() => {
    tmpdir = fs.mkdtempSync(path.join(os.tmpdir(), 'raili-ctx-test-'));
    railiDir = path.join(tmpdir, '.raili');
    fs.mkdirSync(railiDir);
  });

  afterEach(() => {
    fs.rmSync(tmpdir, { recursive: true, force: true });
  });

  describe('loadContext', () => {
    test('returns empty context if file does not exist', () => {
      const ctx = loadContext(tmpdir);
      expect(ctx.stateHistory).toEqual([]);
      expect(ctx.vars).toBeUndefined();
    });

    test('loads existing context from file', () => {
      const contextData = {
        vars: { ticket_id: 'TICKET-123', description: 'Test ticket' },
        stateHistory: [
          { state: 'init', enteredAt: '2026-02-24T10:00:00Z' },
          { state: 'analyze', enteredAt: '2026-02-24T10:05:00Z' },
        ],
      };
      fs.writeFileSync(path.join(railiDir, 'context.json'), JSON.stringify(contextData));

      const ctx = loadContext(tmpdir);
      expect(ctx.vars?.ticket_id).toBe('TICKET-123');
      expect(ctx.stateHistory).toHaveLength(2);
      expect(ctx.stateHistory[0].state).toBe('init');
    });

    test('throws if context.json has invalid structure', () => {
      fs.writeFileSync(path.join(railiDir, 'context.json'), '{ "stateHistory": "not-an-array" }');
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

      const saved = fs.readFileSync(path.join(railiDir, 'context.json'), 'utf8');
      const parsed = JSON.parse(saved);
      expect(parsed.vars.ticket_id).toBe('TICKET-456');
      expect(parsed.stateHistory).toHaveLength(1);
    });

    test('throws if .raili directory does not exist', () => {
      fs.rmSync(railiDir, { recursive: true });
      const ctx = { stateHistory: [] };
      expect(() => saveContext(tmpdir, ctx)).toThrow('.raili/ directory does not exist');
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
});

