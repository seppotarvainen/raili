import { getFileSystem } from '../../../src/infrastructure/fileSystemProvider';
import { InMemoryFileSystem, setupFakeFs } from './fsFake.util';

describe('InMemoryFileSystem', () => {
  test('write/read/append works', () => {
    const restore = setupFakeFs();
    const fs = getFileSystem();

    // create parent dir
    (fs as any).mkdirSync('/tmp', { recursive: true });
    fs.writeFileSync('/tmp/hello.txt', 'hello');
    const r1 = fs.readFileSync('/tmp/hello.txt');
    expect(r1).toBe('hello');

    fs.appendFileSync('/tmp/hello.txt', ' world');
    const r2 = fs.readFileSync('/tmp/hello.txt');
    expect(r2).toBe('hello world');

    restore();
  });

  test('mkdir recursive and readdirSync', () => {
    const restore = setupFakeFs();
    const fs = getFileSystem();

    fs.mkdirSync('/a/b/c', { recursive: true } as any);
    expect(fs.existsSync('/a/b/c')).toBe(true);

    fs.writeFileSync('/a/b/c/file.txt', 'x');
    const list = fs.readdirSync('/a/b');
    expect(list.sort()).toEqual(['c']);

    restore();
  });

  test('unlink and rm recursive', () => {
    const restore = setupFakeFs();
    const fs = getFileSystem();

    fs.mkdirSync('/x/y', { recursive: true } as any);
    fs.writeFileSync('/x/y/f.txt', '1');
    expect(fs.existsSync('/x/y/f.txt')).toBe(true);

    fs.unlinkSync('/x/y/f.txt');
    expect(fs.existsSync('/x/y/f.txt')).toBe(false);

    // recreate and rm directory recursively
    fs.writeFileSync('/x/y/f2.txt', '2');
    fs.rmSync('/x', { recursive: true } as any);
    expect(fs.existsSync('/x')).toBe(false);

    restore();
  });

  test('ENOENT errors on missing files', () => {
    const restore = setupFakeFs();
    const fs = getFileSystem();

    expect(() => fs.readFileSync('/does/not/exist.txt')).toThrow();
    expect(() => fs.unlinkSync('/nope.txt')).toThrow();

    restore();
  });

  test('setupFakeFs restores original provider', () => {
    const original = getFileSystem();
    const restore = setupFakeFs();
    const after = getFileSystem();
    expect(after).not.toBe(original);
    restore();
    const restored = getFileSystem();
    expect(restored).toBe(original);
  });
});
