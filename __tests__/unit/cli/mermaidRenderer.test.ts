import { renderMermaid } from '../../../src/cli/mermaidRenderer';
import { Graph } from '../../../src/types';

describe('renderMermaid', () => {
  const sample: Graph = {
    nodes: [
      { id: 'start', type: 'agent', config: {} as any },
      { id: 'run_tests', type: 'script', config: { output: { store: true } } as any },
      { id: 'deploy', type: 'command', config: {} as any },
      { id: 'done', type: 'engine', config: {} as any },
    ],
    edges: [
      { from: 'start', to: 'run_tests', outcome: 'PASSED' },
      { from: 'start', to: 'done', outcome: 'default', isDefault: true },
      { from: 'run_tests', to: 'deploy', outcome: 'PASSED' },
      { from: 'run_tests', to: 'start', outcome: 'FAILED' },
    ],
    terminals: ['done'],
  };

  test('starts with graph TD', () => {
    const out = renderMermaid(sample);
    expect(out.startsWith('graph TD')).toBe(true);
  });

  test('includes style lines for node colors', () => {
    const out = renderMermaid(sample);
    expect(out).toMatch(/style start fill:#87CEEB/); // agent color
    expect(out).toMatch(/style run_tests fill:#90EE90/); // script color
    expect(out).toMatch(/style deploy fill:#FFA500/); // command color
    expect(out).toMatch(/style done fill:#D3D3D3/); // engine color
  });

  test('terminal state rendered with triple-paren notation', () => {
    const out = renderMermaid(sample);
    expect(out).toContain('done(((');
  });

  test('edges labeled correctly', () => {
    const out = renderMermaid(sample);
    expect(out).toContain('start -->|PASSED| run_tests');
    expect(out).toContain('run_tests -->|PASSED| deploy');
    expect(out).toContain('run_tests -->|FAILED| start');
  });

  test('default edges are dashed and labeled default', () => {
    const out = renderMermaid(sample);
    expect(out).toContain('start -.->|default| done');
  });

  test('initial arrow points to graph.initial when provided', () => {
    const g = { ...sample, initial: 'deploy' } as Graph;
    const out = renderMermaid(g);
    expect(out).toContain('[*] -->|initial| deploy');
  });

  test('initial arrow emitted to first node when graph.initial missing', () => {
    const out = renderMermaid(sample);
    expect(out).toContain('[*] -->|initial| start');
  });

  test('notes include output.store and max_visits when present', () => {
    const withMax: Graph = JSON.parse(JSON.stringify(sample));
    // add max_visits to run_tests
    withMax.nodes = withMax.nodes.map((n) => (n.id === 'run_tests' ? { ...n, config: { ...(n.config || {}), max_visits: { count: 3 } } } : n));
    const out = renderMermaid(withMax);
    expect(out).toContain('Note over run_tests: max_visits=3, output.store=true');
  });
});
