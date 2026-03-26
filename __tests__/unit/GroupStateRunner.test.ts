import { runGroupState } from '../../src/runner/groupStateRunner';
import { runAgentState } from '../../src/runner/agentStateRunner';
import { runScriptState } from '../../src/runner/scriptStateRunner';

jest.mock('fs', () => ({
  existsSync: jest.fn(() => true),
  readFileSync: jest.fn(() => 'dummy'),
}));

jest.mock('js-yaml', () => ({ load: jest.fn(() => ({
  states: {
    subA: { type: 'agent', agent: 'analyzer', expose: ['valueA'] },
    subB: { type: 'script', script: 'do_it', out: true, expose: ['resultB'] },
  },
})) }));

jest.mock('../../src/runner/agentStateRunner', () => ({ runAgentState: jest.fn() }));
jest.mock('../../src/runner/scriptStateRunner', () => ({ runScriptState: jest.fn() }));
jest.mock('../../src/context/context', () => ({
  loadContext: jest.fn(() => ({ stateHistory: [] })),
  addStateToHistory: jest.fn((ctx, state) => ({ ...ctx, stateHistory: [...(ctx.stateHistory || []), { state }] })),
  saveContext: jest.fn(),
}));

const mockAgent = (runAgentState as unknown) as jest.Mock;
const mockScript = (runScriptState as unknown) as jest.Mock;

describe('GroupStateRunner', () => {
  beforeEach(() => {
    mockAgent.mockReset();
    mockScript.mockReset();
  });

  it('parses outcome from out:true sub-state and returns merged exports', async () => {
    mockAgent.mockResolvedValue({ outcome: 'IGNORED', exports: { valueA: 'va' } });
    mockScript.mockResolvedValue({ outcome: 'APPROVE', exports: { resultB: 'rb' } });

    const state: any = {
      id: 'parent_group',
      config: { type: 'group', group: 'sub.yaml', on: { PASSED: 'after_ok' } },
    };

    const res = await runGroupState(state, process.cwd(), { ticket: '123' }, undefined, {}, {} as any);

    expect(res.outcome).toBe('APPROVE');
    expect(res.exports).toBeDefined();
    expect(res.exports!['valueA']).toBe('va');
    expect(res.exports!['resultB']).toBe('rb');
  });
});
