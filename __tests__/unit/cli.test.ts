import { main, parseRunArgs } from '../../src/cli';
import { RailiCommand } from '../../src/cli/railiCommand';
import { runCommand } from '../../src/run';

jest.mock('../../src/run', () => ({
  runCommand: jest.fn(),
}));

const mockedRunCommand = runCommand as jest.MockedFunction<typeof runCommand>;

describe('parseRunArgs --resolve-vars handling', () => {
  test('flag absent results in undefined', () => {
    const parsed = parseRunArgs([]);
    expect(parsed.resolveVars).toBeUndefined();
  });

  test('--resolve-vars with no args returns empty array', () => {
    const parsed = parseRunArgs(['--resolve-vars']);
    expect(parsed.resolveVars).toEqual([]);
  });

  test('--resolve-vars with single value', () => {
    const parsed = parseRunArgs(['--resolve-vars', 'key=val']);
    expect(parsed.resolveVars).toEqual(['key=val']);
  });

  test('--resolve-vars with multiple values', () => {
    const parsed = parseRunArgs(['--resolve-vars', 'a', 'b', 'c']);
    expect(parsed.resolveVars).toEqual(['a', 'b', 'c']);
  });
});

describe('parseRunArgs --verbose handling', () => {
  test('parses --verbose flag', () => {
    const res = parseRunArgs(['--verbose']);
    expect(res.verbose).toBe(true);
  });

  test('parses -v short flag', () => {
    const res = parseRunArgs(['-v']);
    expect(res.verbose).toBe(true);
  });

  test('default verbose is falsy/undefined', () => {
    const res = parseRunArgs([]);
    expect(res.verbose).toBeFalsy();
  });
});

describe('run cancellation input lifecycle', () => {
  let stdin: NodeJS.ReadStream;
  let originalIsTTY: boolean | undefined;
  let originalIsRaw: boolean | undefined;
  let originalSetRawMode: NodeJS.ReadStream['setRawMode'];
  let onSpy: jest.SpiedFunction<NodeJS.ReadStream['on']>;
  let removeListenerSpy: jest.SpiedFunction<NodeJS.ReadStream['removeListener']>;
  let pauseSpy: jest.SpiedFunction<NodeJS.ReadStream['pause']>;
  let setRawModeSpy: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    stdin = process.stdin;
    originalIsTTY = stdin.isTTY;
    originalIsRaw = stdin.isRaw;
    originalSetRawMode = stdin.setRawMode;
    Object.defineProperty(stdin, 'isTTY', { configurable: true, value: true });
    Object.defineProperty(stdin, 'isRaw', { configurable: true, value: false });
    onSpy = jest.spyOn(stdin, 'on');
    removeListenerSpy = jest.spyOn(stdin, 'removeListener');
    pauseSpy = jest.spyOn(stdin, 'pause');
    setRawModeSpy = jest.fn(() => stdin);
    Object.defineProperty(stdin, 'setRawMode', {
      configurable: true,
      writable: true,
      value: setRawModeSpy,
    });
  });

  afterEach(() => {
    onSpy.mockRestore();
    removeListenerSpy.mockRestore();
    pauseSpy.mockRestore();
    Object.defineProperty(stdin, 'isTTY', { configurable: true, value: originalIsTTY });
    Object.defineProperty(stdin, 'isRaw', { configurable: true, value: originalIsRaw });
    if (originalSetRawMode) {
      Object.defineProperty(stdin, 'setRawMode', {
        configurable: true,
        value: originalSetRawMode,
      });
    } else {
      Object.defineProperty(stdin, 'setRawMode', {
        configurable: true,
        value: undefined,
      });
    }
  });

  test('installs a run-scoped raw input listener and requests cancellation for Ctrl+X', async () => {
    let cancellationToken: { isCancellationRequested: boolean } | undefined;
    mockedRunCommand.mockImplementation(async (...args) => {
      cancellationToken = args[9];
      const dataListener = (
        onSpy.mock.calls as unknown as Array<[string, (chunk: Buffer) => void]>
      ).find(([event]) => event === 'data')?.[1];
      expect(dataListener).toBeDefined();
      (dataListener as (chunk: Buffer) => void)(Buffer.from([0x18]));
    });

    await main(new RailiCommand('run'), ['--continue']);

    expect(cancellationToken?.isCancellationRequested).toBe(true);
    expect(setRawModeSpy).toHaveBeenNthCalledWith(1, true);
    expect(setRawModeSpy).toHaveBeenLastCalledWith(false);
    expect(removeListenerSpy).toHaveBeenCalledWith('data', expect.any(Function));
    expect(pauseSpy).toHaveBeenCalled();
  });

  test('does not treat Ctrl+C as cancellation and still cleans up after failure', async () => {
    let cancellationToken: { isCancellationRequested: boolean } | undefined;
    const kill = jest.spyOn(process, 'kill').mockImplementation(() => true);
    mockedRunCommand.mockImplementation(async (...args) => {
      cancellationToken = args[9];
      const dataListener = (
        onSpy.mock.calls as unknown as Array<[string, (chunk: Buffer) => void]>
      ).find(([event]) => event === 'data')?.[1];
      (dataListener as (chunk: Buffer) => void)(Buffer.from([0x03]));
      throw new Error('run failed');
    });
    const exit = jest.spyOn(process, 'exit').mockImplementation((code?: string | number | null) => {
      throw new Error(`EXIT:${code ?? 0}`);
    });

    await expect(main(new RailiCommand('run'), ['--continue'])).rejects.toThrow('EXIT:1');

    expect(cancellationToken?.isCancellationRequested).toBe(false);
    expect(kill).toHaveBeenCalledWith(process.pid, 'SIGINT');
    expect(removeListenerSpy).toHaveBeenCalledWith('data', expect.any(Function));
    expect(setRawModeSpy).toHaveBeenLastCalledWith(false);
    kill.mockRestore();
    exit.mockRestore();
  });

  test('does not install the cancellation listener for non-run commands', async () => {
    const exit = jest.spyOn(process, 'exit').mockImplementation((code?: string | number | null) => {
      throw new Error(`EXIT:${code ?? 0}`);
    });

    await expect(main(new RailiCommand('help'), [])).rejects.toThrow('EXIT:0');

    expect(onSpy).not.toHaveBeenCalledWith('data', expect.any(Function));
    expect(setRawModeSpy).not.toHaveBeenCalled();
    exit.mockRestore();
  });
});
