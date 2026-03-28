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
      existsSync: (p: string) => true,
      statSync: (p: string) =>
        ({
          isFile: () => true,
        }) as any,
      readFileSync: (p: string) => 'ok',
      writeFileSync: (p: string, data: string) => {},
      appendFileSync: (p: string, data: string) => {},
      mkdirSync: (p: string) => {},
      unlinkSync: (p: string) => {},
      rmSync: (p: string) => {},
      chmodSync: (p: string, mode: number) => {},
      readdirSync: (p: string) => [],
    };

    setFileSystem(fakeFs);
    const got = getFileSystem();
    expect(got).toBe(fakeFs);

    // restore default
    setFileSystem(new NodeFileSystem());
  });
});
