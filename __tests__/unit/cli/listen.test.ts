import path from 'path';
import { getFileSystem } from '../../../src/infrastructure/fileSystemProvider';
import { setupFakeFs } from '../infrastructure/fsFake.util';

jest.mock('../../../src/handlers/triggerHandler', () => ({
  loadTriggerModule: jest.fn(),
}));
jest.mock('../../../src/run', () => ({
  runCommand: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('../../../src/workflow/workflowLoader', () => ({
  loadWorkflowConfig: jest.fn().mockReturnValue({ initial: 'start', states: {} }),
}));
jest.mock('../../../src/registry/registryValidator', () => ({
  validateAgentRegistry: jest.fn().mockReturnValue({}),
  validateScriptRegistry: jest.fn().mockReturnValue({}),
  validateWorkflowReferences: jest.fn(),
}));

import { loadTriggerModule } from '../../../src/handlers/triggerHandler';
import { runCommand } from '../../../src/run';
import { listenCommand } from '../../../src/cli/listen';

let restoreFs: () => void;
let restoreSetTimeout: () => void;

beforeEach(() => {
  restoreFs = setupFakeFs();
  // Make setTimeout resolve immediately so the poll loop doesn't hang
  const original = global.setTimeout;
  jest.spyOn(global, 'setTimeout').mockImplementation((cb: any) => { cb(); return 0 as any; });
  restoreSetTimeout = () => { (global.setTimeout as any) = original; };
});

afterEach(() => {
  jest.clearAllMocks();
  jest.restoreAllMocks();
  const r = restoreFs;
  if (r) r();
});

function setupValidFs(cwd: string, withTrigger = false) {
  const fs = getFileSystem();
  fs.mkdirSync(cwd, { recursive: true } as any);
  const raili = path.join(cwd, '.raili');
  fs.mkdirSync(raili, { recursive: true } as any);
  const main = path.join(raili, 'main');
  fs.mkdirSync(main, { recursive: true } as any);
  fs.writeFileSync(path.join(raili, 'agent-registry.json'), '{}');
  fs.writeFileSync(path.join(raili, 'script-registry.json'), '{}');
  fs.writeFileSync(path.join(main, 'workflow.yaml'), 'initial: start\nstates: {}\n');
  if (withTrigger) {
    fs.writeFileSync(path.join(main, 'trigger.js'), 'module.exports = async function() { return null; };');
  }
}

test('throws when .raili dir does not exist', async () => {
  const fs = getFileSystem();
  fs.mkdirSync('/repo', { recursive: true } as any);
  await expect(listenCommand('/repo', 'main')).rejects.toThrow('.raili/ directory not found');
});

test('throws when .raili is a file not a directory', async () => {
  const fs = getFileSystem();
  fs.mkdirSync('/repo', { recursive: true } as any);
  fs.writeFileSync('/repo/.raili', 'not-a-dir');
  await expect(listenCommand('/repo', 'main')).rejects.toThrow('.raili/ directory not found');
});

test('throws when agent-registry.json is missing', async () => {
  const fs = getFileSystem();
  fs.mkdirSync('/repo', { recursive: true } as any);
  const raili = '/repo/.raili';
  fs.mkdirSync(raili, { recursive: true } as any);
  fs.mkdirSync(path.join(raili, 'main'), { recursive: true } as any);
  fs.writeFileSync(path.join(raili, 'script-registry.json'), '{}');
  fs.writeFileSync(path.join(raili, 'main', 'workflow.yaml'), 'initial: start\nstates: {}\n');
  await expect(listenCommand('/repo', 'main')).rejects.toThrow('agent-registry.json not found');
});

test('throws when script-registry.json is missing', async () => {
  const fs = getFileSystem();
  fs.mkdirSync('/repo', { recursive: true } as any);
  const raili = '/repo/.raili';
  fs.mkdirSync(raili, { recursive: true } as any);
  fs.mkdirSync(path.join(raili, 'main'), { recursive: true } as any);
  fs.writeFileSync(path.join(raili, 'agent-registry.json'), '{}');
  fs.writeFileSync(path.join(raili, 'main', 'workflow.yaml'), 'initial: start\nstates: {}\n');
  await expect(listenCommand('/repo', 'main')).rejects.toThrow('script-registry.json not found');
});

test('throws when trigger missing', async () => {
  setupValidFs('/repo', false);
  await expect(listenCommand('/repo', 'main')).rejects.toThrow(/trigger/i);
});

test('throws when trigger export invalid (handler throws)', async () => {
  setupValidFs('/repo', true);
  (loadTriggerModule as jest.Mock).mockRejectedValue(new Error('Trigger invalid'));
  await expect(listenCommand('/repo', 'main')).rejects.toThrow(/Trigger invalid/);
});

// Helper: Date.now mock that makes the timeout trigger after 2 catch-block iterations.
// failureStart = 1000 (truthy, non-zero), timeout check = 700_000 (diff = 699_000 > 600_000)
function mockDateNowForTimeout() {
  return jest.spyOn(Date, 'now')
    .mockReturnValueOnce(1000)   // sets failureStart = 1000 (truthy)
    .mockReturnValue(700_000);   // 700_000 - 1000 = 699_000 > failureTimeoutMs (600_000)
}

test('poll: trigger error causes failureStart tracking then timeout', async () => {
  setupValidFs('/repo', true);
  (loadTriggerModule as jest.Mock).mockResolvedValue(
    jest.fn().mockRejectedValue(new Error('poll failed')),
  );
  mockDateNowForTimeout();
  await expect(listenCommand('/repo', 'main')).rejects.toThrow('Trigger failing continuously');
});

test('poll: null event resets failureStart, then subsequent error causes timeout', async () => {
  setupValidFs('/repo', true);
  let callCount = 0;
  const triggerFn = jest.fn().mockImplementation(async () => {
    callCount++;
    if (callCount === 1) return null;
    throw new Error('boom after null');
  });
  (loadTriggerModule as jest.Mock).mockResolvedValue(triggerFn);
  mockDateNowForTimeout();
  await expect(listenCommand('/repo', 'main')).rejects.toThrow('Trigger failing continuously');
  expect(callCount).toBeGreaterThan(1);
});

test('poll: valid event calls runCommand with event vars', async () => {
  setupValidFs('/repo', true);
  let callCount = 0;
  const triggerFn = jest.fn().mockImplementation(async () => {
    callCount++;
    if (callCount === 1) return { ticket_id: 'T-1', title: 'My Ticket' };
    throw new Error('done polling');
  });
  (loadTriggerModule as jest.Mock).mockResolvedValue(triggerFn);
  mockDateNowForTimeout();
  await expect(listenCommand('/repo', 'main')).rejects.toThrow('Trigger failing continuously');
  expect(runCommand).toHaveBeenCalledWith(
    '/repo', 'clean', { ticket_id: 'T-1', title: 'My Ticket' }, 'main', false,
  );
});

test('poll: array event is treated as invalid and caught as error', async () => {
  setupValidFs('/repo', true);
  let callCount = 0;
  const triggerFn = jest.fn().mockImplementation(async () => {
    callCount++;
    if (callCount === 1) return []; // invalid: array
    throw new Error('boom');
  });
  (loadTriggerModule as jest.Mock).mockResolvedValue(triggerFn);
  mockDateNowForTimeout();
  // Invalid event becomes an error caught in catch block, eventually times out
  await expect(listenCommand('/repo', 'main')).rejects.toThrow('Trigger failing continuously');
});
