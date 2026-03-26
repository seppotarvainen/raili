import fs from 'fs';
import path from 'path';
import { runCommand } from '../../src/run';
import { loadContext } from '../../src/context/context';
import {
  cleanupRailiEnvVars,
  cleanupTmpWorkspace,
  createTmpWorkspace,
  fakeChild,
  writeAgentFile,
  writeAgentRegistry,
  writeScriptRegistry,
  writeWorkflow,
} from './testUtils';

jest.mock('child_process', () => ({ spawn: jest.fn() }));
const { spawn } = require('child_process');

let tmpDir: string;

beforeEach(() => {
  tmpDir = createTmpWorkspace();
  spawn.mockImplementation(() => fakeChild('', '', 0));
});

afterEach(() => {
  cleanupTmpWorkspace(tmpDir);
  cleanupRailiEnvVars();
  spawn.mockReset();
});

describe('integration: flattened persistence across group/sub-workflow', () => {
  it('saves sub-workflow output into parent .raili/main/outputs and flattens context', async () => {
    // main workflow with a group state that references deploy.yaml in the same workflow dir
    writeWorkflow(
      tmpDir,
      [
        `initial: start`,
        `states:`,
        `  start:`,
        `    type: engine`,
        `    transitions:`,
        `      PASSED: do_group`,
        `  do_group:`,
        `    type: group`,
        `    group: ./deploy.yaml`,
        `    on:`,
        `      PASSED: done`,
        `  done:`,
        `    type: engine`,
        '',
      ].join('\n'),
    );

    // sub-workflow file placed inside .raili/main/deploy.yaml
    const deployYaml = [
      `states:`,
      `  deploy:`,
      `    type: agent`,
      `    agent: deploy_agent`,
      `    out: true`,
      `    output:`,
      `      store: true`,
      '',
    ].join('\n');
    // write as .raili/main/deploy.yaml
    const deployPath = path.join(tmpDir, '.raili', 'main', 'deploy.yaml');
    fs.writeFileSync(deployPath, deployYaml, 'utf8');

    writeAgentRegistry(tmpDir, { deploy_agent: { path: './agents/deploy.agent.md' } });
    writeScriptRegistry(tmpDir, {});
    writeAgentFile(tmpDir, 'agents/deploy.agent.md', 'Agent instructions');

    spawn.mockImplementation((cmd: string) => {
      if (cmd === 'copilot') return fakeChild('OUTPUT:\ndeploy output\ndone', '', 0);
      return fakeChild('', '', 0);
    });

    await runCommand(tmpDir, 'clean', {});

    const outFile = path.join(tmpDir, '.raili', 'main', 'outputs', 'do_group.deploy.md');
    // GroupStateRunner prefixes sub-states with parent id (virtualId). Ensure the file exists.
    expect(fs.existsSync(outFile)).toBe(true);

    const content = fs.readFileSync(outFile, 'utf8');
    expect(content).toContain('deploy output');

    const ctx = loadContext(tmpDir);
    // Expect flattened sequence with virtual id for sub-state in order
    const states = ctx.stateHistory.map((e) => e.state);
    expect(states).toContain('start');
    expect(states).toContain('do_group.deploy');
    expect(states[states.length - 1]).toBe('done');
  });
});
