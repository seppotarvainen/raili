import { getFileSystem, setFileSystem } from '../../../src/infrastructure/fileSystemProvider';
import { IFileSystem, NodeFileSystem } from '../../../src/infrastructure/fileSystem';

describe('fileSystemProvider', () => {
  test('default provider is NodeFileSystem with expected methods', () => {
    const fs = getFileSystem();
    expect(typeof fs.existsSync).toBe('function');
    expect(typeof fs.readFileSync).toBe('function');
    expect(typeof fs.writeFileSync).toBe('function');
  });

  test('setFileSystem overrides provider and getFileSystem returns the set instance', () => {
    const fakeFs: IFileSystem = {
      existsSync: (_p: string) => true,
      statSync: (_p: string) =>
        ({
          isFile: () => true,
        }) as any,
      readFileSync: (_p: string) => 'ok',
      writeFileSync: (_p: string, _data: string) => {},
      appendFileSync: (_p: string, _data: string) => {},
      mkdirSync: (_p: string) => {},
      unlinkSync: (_p: string) => {},
      rmSync: (_p: string) => {},
      chmodSync: (_p: string, _mode: number) => {},
      readdirSync: (_p: string) => [],
    };

    setFileSystem(fakeFs);
    const got = getFileSystem();
    expect(got).toBe(fakeFs);

    // restore default
    setFileSystem(new NodeFileSystem());
  });
});
