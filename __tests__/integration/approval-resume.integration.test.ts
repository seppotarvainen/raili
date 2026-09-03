import fs from 'fs';
import path from 'path';
import { createCancellationController } from '../../src/cancellation';
import { loadContext } from '../../src/context/context';
import * as manual from '../../src/handlers/manualHandler';
import { runCommand } from '../../src/run';
import {
  cleanupRailiEnvVars,
  cleanupTmpWorkspace,
  createTmpWorkspace,
  fakeChild,
  writeAgentRegistry,
  writeScriptFile,
  writeScriptRegistry,
  writeWorkflow,
} from './testUtils';

jest.mock('child_process', () => ({ spawn: jest.fn() }));
const { spawn } = require('child_process');

let tmpDir: string;

beforeEach(() => {
  tmpDir = createTmpWorkspace();
  spawn.mockImplementation((command: string) => {
    if (command.endsWith('/scripts/producer.sh')) {
      return fakeChild('PASSED\n', '', 0);
    }
    return fakeChild('', '', 0);
  });
});

afterEach(() => {
  cleanupTmpWorkspace(tmpDir);
  cleanupRailiEnvVars();
  spawn.mockReset();
  jest.restoreAllMocks();
});

function producerCalls(): number {
  return spawn.mock.calls.filter(([command]: [string]) => command.endsWith('/scripts/producer.sh'))
    .length;
}

function writeProducerWorkflow(interactiveState: string): void {
  writeWorkflow(
    tmpDir,
    `initial: produce
states:
  produce:
    type: script
    script: producer
    ${interactiveState}
  done:
    type: engine
`,
  );
  writeScriptRegistry(tmpDir, { producer: { path: './scripts/producer.sh' } });
  writeAgentRegistry(tmpDir, {});
  writeScriptFile(tmpDir, 'scripts/producer.sh', 'echo output\nexit 0');
}

describe('integration: interrupted interactive state resumes without rerunning its producer', () => {
  test('resumes the approval prompt after cancellation', async () => {
    writeProducerWorkflow(`approval:
      question: "Approve?"
      PASSED: done
      FAILED: produce`);

    const firstRunCancellation = createCancellationController();
    const contextPath = path.join(tmpDir, '.raili', 'main', 'context.json');
    const prompt = jest
      .spyOn(manual, 'handleManualTransition')
      .mockImplementationOnce(async () => {
        const context = loadContext(tmpDir);
        expect(fs.existsSync(contextPath)).toBe(true);
        expect(context.stateHistory.at(-1)).toMatchObject({
          state: 'produce',
          meta: { pre_record: true },
        });
        firstRunCancellation.requestCancellation();
        return { chosen: '', target: '', reason: '', cancelled: true };
      })
      .mockResolvedValueOnce({ chosen: 'PASSED', target: 'done', reason: '', waitMs: 0 });

    await runCommand(
      tmpDir,
      'clean',
      {},
      undefined,
      false,
      undefined,
      undefined,
      undefined,
      false,
      firstRunCancellation,
    );

    const afterCancellation = loadContext(tmpDir);
    expect(afterCancellation.stateHistory.at(-1)).toMatchObject({
      state: 'produce',
      meta: { pre_record: true, cancelled: expect.any(String) },
    });
    const callsBeforeContinue = producerCalls();

    await runCommand(tmpDir, 'continue', {});

    expect(producerCalls()).toBe(callsBeforeContinue);
    expect(prompt).toHaveBeenCalledTimes(2);
    expect(loadContext(tmpDir).stateHistory.at(-1)?.state).toBe('done');
  });

  test('resumes the feedback prompt after cancellation', async () => {
    writeProducerWorkflow(`feedback:
      expose_var: reviewer_note
    transitions:
      next: done`);

    const firstRunCancellation = createCancellationController();
    const contextPath = path.join(tmpDir, '.raili', 'main', 'context.json');
    const prompt = jest
      .spyOn(manual, 'handleFeedbackPrompt')
      .mockImplementationOnce(async () => {
        const context = loadContext(tmpDir);
        expect(fs.existsSync(contextPath)).toBe(true);
        expect(context.stateHistory.at(-1)).toMatchObject({
          state: 'produce',
          meta: { pre_record: true },
        });
        firstRunCancellation.requestCancellation();
        return { feedback: '', cancelled: true };
      })
      .mockResolvedValueOnce('approved with notes');

    await runCommand(
      tmpDir,
      'clean',
      {},
      undefined,
      false,
      undefined,
      undefined,
      undefined,
      false,
      firstRunCancellation,
    );

    const afterCancellation = loadContext(tmpDir);
    expect(afterCancellation.stateHistory.at(-1)).toMatchObject({
      state: 'produce',
      meta: { pre_record: true, cancelled: expect.any(String) },
    });
    const callsBeforeContinue = producerCalls();

    await runCommand(tmpDir, 'continue', {});

    expect(producerCalls()).toBe(callsBeforeContinue);
    expect(prompt).toHaveBeenCalledTimes(2);
    const finalContext = loadContext(tmpDir);
    expect(finalContext.vars?.reviewer_note).toBe('approved with notes');
    expect(finalContext.stateHistory.at(-1)?.state).toBe('done');
  });
});
