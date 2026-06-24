import { renderAgentVerbose } from '../../src/presenter';

describe('renderAgentVerbose', () => {
  let logs: string[] = [];
  const originalLog = console.log;

  beforeEach(() => {
    logs = [];
    // capture console.log output
    console.log = (msg?: any) => logs.push(String(msg));
    // set terminal width deterministically
    (process.stdout as any).columns = 80;
  });

  afterEach(() => {
    console.log = originalLog;
    delete (process.stdout as any).columns;
  });

  test('prints verbose block with unspecified model and truncated prompt', () => {
    const longPrompt = 'a'.repeat(600);
    renderAgentVerbose('agentX', undefined, longPrompt);

    const combined = logs.join('\n');
    expect(combined).toContain('VERBOSE: Agent context');
    expect(combined).toContain('agent: agentX');
    expect(combined).toContain('model: (uses frontmatter)');
    expect(combined).toContain('prompt: ' + 'a'.repeat(500) + '...');
    // bottom separator should be 80 wide
    expect(combined).toMatch(/─{80}/);
  });
});
