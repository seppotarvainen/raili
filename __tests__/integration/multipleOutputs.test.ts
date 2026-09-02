/// <reference path="../types/copilot-sdk.d.ts" />
import fs from 'fs';
import path from 'path';
import { runCommand } from '../../src/run';
import {
  cleanupRailiEnvVars,
  cleanupTmpWorkspace,
  createTmpWorkspace,
  writeAgentFile,
  writeAgentRegistry,
  writeScriptRegistry,
  writeWorkflow,
} from './testUtils';
import { mockSession, resetCopilotSdkMock } from '@github/copilot-sdk';

jest.mock('@github/copilot-sdk');

let tmpDir: string;

beforeEach(() => {
  tmpDir = createTmpWorkspace();
  resetCopilotSdkMock();
});

afterEach(() => {
  cleanupTmpWorkspace(tmpDir);
  cleanupRailiEnvVars();
});

/**
 * Write pre-existing stored outputs to simulate N previous agent runs.
 * First run has no separator; subsequent runs use the `--- Run <ISO> ---` format
 * that outputStore.saveOutput produces.
 */
function writeStoredOutputs(dir: string, stateId: string, runs: string[]): void {
  const outputsDir = path.join(dir, '.raili', 'main', 'outputs');
  fs.mkdirSync(outputsDir, { recursive: true });
  let content = runs[0] ?? '';
  for (let i = 1; i < runs.length; i++) {
    content += `\n\n--- Run 2026-04-02T0${i}:00:00.000Z ---\n\n${runs[i]}`;
  }
  fs.writeFileSync(path.join(outputsDir, `${stateId}.md`), content, 'utf8');
}

describe('integration: multiple stored outputs and use_latest passthrough', () => {
  it('default behavior: includes all previous runs in prompt', async () => {
    writeWorkflow(
      tmpDir,
      `initial: code
states:
  code:
    type: agent
    agent: raili-coding
    output:
      store: true
    on:
      PASSED: done
  done:
    type: engine
`,
    );

    writeAgentRegistry(tmpDir, { 'raili-coding': { path: '.github/agents/raili-coding.md' } });
    writeScriptRegistry(tmpDir, {});
    writeAgentFile(tmpDir, '.github/agents/raili-coding.md', '---\nmodel: test\n---\n');

    // Simulate two previous stored runs written by earlier workflow executions
    writeStoredOutputs(tmpDir, 'code', ['first-run-output', 'second-run-output']);

    let finalPrompt = '';
    mockSession.sendAndWait.mockImplementationOnce(async ({ prompt }) => {
      finalPrompt = prompt;
      return {
        type: 'assistant.message',
        id: 'event',
        parentId: null,
        timestamp: new Date(0).toISOString(),
        data: { content: 'PASSED', messageId: 'message' },
      };
    });

    // No context.json → continue starts at the initial state 'code' with pre-existing outputs
    await runCommand(tmpDir, 'continue', {});

    expect(finalPrompt).toContain('Your previous output(s):');
    expect(finalPrompt).toContain('first-run-output');
    expect(finalPrompt).toContain('second-run-output');
  });

  it('use_latest N behavior: only last N runs injected', async () => {
    writeWorkflow(
      tmpDir,
      `initial: code
states:
  code:
    type: agent
    agent: raili-coding
    output:
      store: true
      use_latest: 1
    on:
      PASSED: done
  done:
    type: engine
`,
    );

    writeAgentRegistry(tmpDir, { 'raili-coding': { path: '.github/agents/raili-coding.md' } });
    writeScriptRegistry(tmpDir, {});
    writeAgentFile(tmpDir, '.github/agents/raili-coding.md', '---\nmodel: test\n---\n');

    // Simulate two previous stored runs; with use_latest:1 only the second should appear
    writeStoredOutputs(tmpDir, 'code', ['old-output-1', 'old-output-2']);

    let finalPrompt = '';
    mockSession.sendAndWait.mockImplementationOnce(async ({ prompt }) => {
      finalPrompt = prompt;
      return {
        type: 'assistant.message',
        id: 'event',
        parentId: null,
        timestamp: new Date(0).toISOString(),
        data: { content: 'PASSED', messageId: 'message' },
      };
    });

    // No context.json → continue starts at the initial state 'code' with pre-existing outputs
    await runCommand(tmpDir, 'continue', {});

    expect(finalPrompt).toContain('Your previous output(s):');
    expect(finalPrompt).not.toContain('old-output-1');
    expect(finalPrompt).toContain('old-output-2');
  });
});
