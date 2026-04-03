import * as realFs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { NodeFileSystem } from '../../../src/infrastructure/fileSystem';

describe('NodeFileSystem', () => {
  let tmpDir: string;
  let nfs: NodeFileSystem;

  beforeEach(() => {
    tmpDir = realFs.mkdtempSync(path.join(os.tmpdir(), 'raili-nfs-'));
    nfs = new NodeFileSystem();
  });

  afterEach(() => {
    realFs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test('existsSync returns true for existing file', () => {
    const p = path.join(tmpDir, 'exists.txt');
    realFs.writeFileSync(p, 'data');
    expect(nfs.existsSync(p)).toBe(true);
  });

  test('existsSync returns false for missing file', () => {
    expect(nfs.existsSync(path.join(tmpDir, 'nope.txt'))).toBe(false);
  });

  test('statSync returns stats for existing file', () => {
    const p = path.join(tmpDir, 'stat.txt');
    realFs.writeFileSync(p, 'data');
    const stat = nfs.statSync(p);
    expect(stat).toBeDefined();
  });

  test('readFileSync reads file content', () => {
    const p = path.join(tmpDir, 'read.txt');
    realFs.writeFileSync(p, 'hello');
    expect(nfs.readFileSync(p)).toBe('hello');
  });

  test('writeFileSync with encoding writes content', () => {
    const p = path.join(tmpDir, 'enc.txt');
    nfs.writeFileSync(p, 'hello', 'utf8');
    expect(realFs.readFileSync(p, 'utf8')).toBe('hello');
  });

  test('writeFileSync without encoding writes content', () => {
    const p = path.join(tmpDir, 'noenc.txt');
    nfs.writeFileSync(p, 'world');
    expect(realFs.readFileSync(p, 'utf8')).toBe('world');
  });

  test('appendFileSync with encoding appends content', () => {
    const p = path.join(tmpDir, 'append-enc.txt');
    nfs.appendFileSync(p, 'a', 'utf8');
    nfs.appendFileSync(p, 'b', 'utf8');
    expect(realFs.readFileSync(p, 'utf8')).toBe('ab');
  });

  test('appendFileSync without encoding appends content', () => {
    const p = path.join(tmpDir, 'append-noenc.txt');
    nfs.appendFileSync(p, 'x');
    nfs.appendFileSync(p, 'y');
    expect(realFs.readFileSync(p, 'utf8')).toBe('xy');
  });

  test('mkdirSync with opts creates nested directory', () => {
    const p = path.join(tmpDir, 'nested', 'dir');
    nfs.mkdirSync(p, { recursive: true });
    expect(realFs.existsSync(p)).toBe(true);
  });

  test('mkdirSync without opts creates directory', () => {
    const p = path.join(tmpDir, 'simple');
    nfs.mkdirSync(p);
    expect(realFs.existsSync(p)).toBe(true);
  });

  test('unlinkSync removes a file', () => {
    const p = path.join(tmpDir, 'torm.txt');
    realFs.writeFileSync(p, 'data');
    nfs.unlinkSync(p);
    expect(realFs.existsSync(p)).toBe(false);
  });

  test('rmSync removes a file', () => {
    const p = path.join(tmpDir, 'rm.txt');
    realFs.writeFileSync(p, 'data');
    nfs.rmSync(p);
    expect(realFs.existsSync(p)).toBe(false);
  });

  test('chmodSync changes file mode without error', () => {
    const p = path.join(tmpDir, 'chmod.txt');
    realFs.writeFileSync(p, 'data');
    expect(() => nfs.chmodSync(p, 0o644)).not.toThrow();
  });

  test('readdirSync returns directory entries', () => {
    realFs.writeFileSync(path.join(tmpDir, 'a.txt'), '');
    realFs.writeFileSync(path.join(tmpDir, 'b.txt'), '');
    const entries = nfs.readdirSync(tmpDir);
    expect(entries).toContain('a.txt');
    expect(entries).toContain('b.txt');
  });
});

