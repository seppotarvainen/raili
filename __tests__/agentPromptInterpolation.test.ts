import { runAgentState } from '../src/engine/AgentStateRunner';
import * as agentHandler from '../src/handlers/agentHandler';
import { WorkflowContext, StateDef } from '../src/types';

jest.mock('../src/handlers/agentHandler');

const mockExecuteAgent = agentHandler.executeAgent as jest.MockedFunction<typeof agentHandler.executeAgent>;

beforeEach(() => {
  jest.resetAllMocks();
  mockExecuteAgent.mockResolvedValue({ success: true, stdout: 'PASSED', stderr: '' });
});

describe('variable interpolation in agent prompts', () => {
  test('interpolates variables in agent prompt', async () => {
    const context: WorkflowContext = {
      stateHistory: [],
      vars: { TICKET_ID: 'PROJ-456', BRANCH: 'feature/login' },
    };

    const registry = { 'analyzer.agent': { path: './agents/analyzer.md' } };
    const state: StateDef = {
      id: 'analyze',
      config: {
        type: 'agent',
        agent: 'analyzer.agent',
        prompt: 'Analyze ticket ${TICKET_ID} from branch ${BRANCH}',
        on: { PASSED: 'done' },
      },
      transitions: ['done'],
    };

    await runAgentState(state, registry, '/tmp', context.vars);

    expect(mockExecuteAgent).toHaveBeenCalledWith(
      registry,
      'analyzer.agent',
      '/tmp',
      null,
      'Analyze ticket PROJ-456 from branch feature/login'
    );
  });

  test('throws if variable in agent prompt is not defined', async () => {
    const context: WorkflowContext = {
      stateHistory: [],
      vars: { TICKET_ID: 'PROJ-456' },
    };

    const registry = { 'analyzer.agent': { path: './agents/analyzer.md' } };
    const state: StateDef = {
      id: 'analyze',
      config: {
        type: 'agent',
        agent: 'analyzer.agent',
        prompt: 'Analyze ${TICKET_ID} in ${MISSING_CONTEXT}',
        on: { PASSED: 'done' },
      },
      transitions: ['done'],
    };

    await expect(runAgentState(state, registry, '/tmp', context.vars)).rejects.toThrow(
      "Variable 'MISSING_CONTEXT' is not defined"
    );
  });

  test('handles escaped dollar signs in agent prompt', async () => {
    const context: WorkflowContext = {
      stateHistory: [],
      vars: { VAR: 'value' },
    };

    const registry = { 'analyzer.agent': { path: './agents/analyzer.md' } };
    const state: StateDef = {
      id: 'analyze',
      config: {
        type: 'agent',
        agent: 'analyzer.agent',
        prompt: 'Price: $$100, var: ${VAR}',
        on: { PASSED: 'done' },
      },
      transitions: ['done'],
    };

    await runAgentState(state, registry, '/tmp', context.vars);

    expect(mockExecuteAgent).toHaveBeenCalledWith(
      registry,
      'analyzer.agent',
      '/tmp',
      null,
      'Price: $100, var: value'
    );
  });

  test('works with no variables in context', async () => {
    const context: WorkflowContext = {
      stateHistory: [],
      vars: {},
    };

    const registry = { 'analyzer.agent': { path: './agents/analyzer.md' } };
    const state: StateDef = {
      id: 'analyze',
      config: {
        type: 'agent',
        agent: 'analyzer.agent',
        prompt: 'static prompt',
        on: { PASSED: 'done' },
      },
      transitions: ['done'],
    };

    await runAgentState(state, registry, '/tmp', context.vars);

    expect(mockExecuteAgent).toHaveBeenCalledWith(
      registry,
      'analyzer.agent',
      '/tmp',
      null,
      'static prompt'
    );
  });

  test('works with no context provided', async () => {
    const registry = { 'analyzer.agent': { path: './agents/analyzer.md' } };
    const state: StateDef = {
      id: 'analyze',
      config: {
        type: 'agent',
        agent: 'analyzer.agent',
        prompt: 'static prompt',
        on: { PASSED: 'done' },
      },
      transitions: ['done'],
    };

    await runAgentState(state, registry, '/tmp', undefined);

    expect(mockExecuteAgent).toHaveBeenCalledWith(
      registry,
      'analyzer.agent',
      '/tmp',
      null,
      'static prompt'
    );
  });

  test('handles special regex characters in variable value', async () => {
    const context: WorkflowContext = {
      stateHistory: [],
      vars: { PATTERN: '.*+?[]{}()' },
    };

    const registry = { 'analyzer.agent': { path: './agents/analyzer.md' } };
    const state: StateDef = {
      id: 'analyze',
      config: {
        type: 'agent',
        agent: 'analyzer.agent',
        prompt: 'Find pattern: ${PATTERN}',
        on: { PASSED: 'done' },
      },
      transitions: ['done'],
    };

    await runAgentState(state, registry, '/tmp', context.vars);

    expect(mockExecuteAgent).toHaveBeenCalledWith(
      registry,
      'analyzer.agent',
      '/tmp',
      null,
      'Find pattern: .*+?[]{}()'
    );
  });
});

