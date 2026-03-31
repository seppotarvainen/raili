import path from 'path';
import { setupFakeFs } from '../infrastructure/fsFake.util';
import { getFileSystem } from '../../../src/infrastructure/fileSystemProvider';
import { loadAgentRegistry } from '../../../src/registry/agentRegistry';

let restoreFs: () => void;
const TMP = '/tmp';

beforeAll(() => { restoreFs = setupFakeFs(); });
afterAll(() => { restoreFs(); });

test('loads valid registry', () => {
  const reg = { 'analyzer.agent': { path: './agents/analyzer.agent.md' } };
  const rail = path.join(TMP, '.raili');
  getFileSystem().mkdirSync(rail, { recursive: true } as any);
  getFileSystem().writeFileSync(path.join(rail, 'agent-registry.json'), JSON.stringify(reg));
  const loaded = loadAgentRegistry(TMP);
  expect(loaded['analyzer.agent'].path).toBe('./agents/analyzer.agent.md');
});

test('throws on missing file', () => {
  const dir = path.join(TMP, 'missing');
  getFileSystem().mkdirSync(dir, { recursive: true } as any);
  expect(() => loadAgentRegistry(dir)).toThrow();
});
