import * as path from 'path';
import * as fsTypes from '../../../src/infrastructure/fileSystem';
import { getFileSystem, setFileSystem } from '../../../src/infrastructure/fileSystemProvider';

type MakeDirOptions = { recursive?: boolean } | number;

// Utility: In-memory file system used by unit tests
export class InMemoryFileSystem implements fsTypes.IFileSystem {
  private files: Map<string, Buffer> = new Map();
  private dirs: Set<string> = new Set();

  constructor() {
    // root exists
    this.dirs.add(path.normalize('/'));
  }

  private normalize(p: string): string {
    return path.normalize(p);
  }

  existsSync(p: string): boolean {
    const n = this.normalize(p);
    return this.files.has(n) || this.dirs.has(n);
  }

  statSync(p: string): import('fs').Stats {
    const n = this.normalize(p);
    const isFile = this.files.has(n);
    const isDir = this.dirs.has(n);
    if (!isFile && !isDir) {
      const err: NodeJS.ErrnoException = new Error(`ENOENT: no such file or directory, stat '${p}'`);
      err.code = 'ENOENT';
      throw err;
    }

    const fake = {
      isFile: () => isFile,
      isDirectory: () => isDir,
      // other properties/methods are not used by tests; provide safe defaults
    } as unknown as import('fs').Stats;

    return fake;
  }

  readFileSync(p: string, enc: string = 'utf8'): string {
    const n = this.normalize(p);
    const buf = this.files.get(n);
    if (!buf) {
      const err: NodeJS.ErrnoException = new Error(`ENOENT: no such file or directory, open '${p}'`);
      err.code = 'ENOENT';
      throw err;
    }
    return buf.toString(enc as BufferEncoding);
  }

  writeFileSync(p: string, data: string | Buffer, enc?: string): void {
    const n = this.normalize(p);
    const dir = path.dirname(n);
    if (!this.dirs.has(dir)) {
      const err: NodeJS.ErrnoException = new Error(`ENOENT: no such file or directory, open '${p}'`);
      err.code = 'ENOENT';
      throw err;
    }
    const buf = Buffer.isBuffer(data) ? data : Buffer.from(data, (enc as BufferEncoding) || 'utf8');
    this.files.set(n, buf);
  }

  appendFileSync(p: string, data: string | Buffer, enc?: string): void {
    const n = this.normalize(p);
    const prev = this.files.get(n);
    const buf = Buffer.isBuffer(data) ? data : Buffer.from(data, (enc as BufferEncoding) || 'utf8');
    if (!prev) {
      // create file if missing (node's appendFileSync creates files)
      const dir = path.dirname(n);
      if (!this.dirs.has(dir)) {
        const err: NodeJS.ErrnoException = new Error(`ENOENT: no such file or directory, open '${p}'`);
        err.code = 'ENOENT';
        throw err;
      }
      this.files.set(n, buf);
      return;
    }
    const next = Buffer.concat([prev, buf]);
    this.files.set(n, next);
  }

  mkdirSync(p: string, opts?: MakeDirOptions | number): void {
    const n = this.normalize(p);
    const recursive = typeof opts === 'object' && (opts as any).recursive === true;
    if (recursive) {
      let cur = n;
      const parts: string[] = [];
      while (cur !== path.dirname(cur)) {
        parts.unshift(cur);
        cur = path.dirname(cur);
      }
      // ensure root
      parts.forEach((dir) => this.dirs.add(dir));
      return;
    }
    // non-recursive: parent must exist
    const parent = path.dirname(n);
    if (!this.dirs.has(parent)) {
      const err: NodeJS.ErrnoException = new Error(`ENOENT: no such file or directory, mkdir '${p}'`);
      err.code = 'ENOENT';
      throw err;
    }
    this.dirs.add(n);
  }

  unlinkSync(p: string): void {
    const n = this.normalize(p);
    if (!this.files.has(n)) {
      const err: NodeJS.ErrnoException = new Error(`ENOENT: no such file or directory, unlink '${p}'`);
      err.code = 'ENOENT';
      throw err;
    }
    this.files.delete(n);
  }

  rmSync(p: string, opts?: { recursive?: boolean }): void {
    const n = this.normalize(p);
    const recursive = opts && (opts as any).recursive === true;
    if (this.files.has(n)) {
      this.files.delete(n);
      return;
    }
    if (this.dirs.has(n)) {
      // if dir not empty and not recursive -> throw
      const children = Array.from(this.files.keys()).concat(Array.from(this.dirs.values())).filter((k) => k !== n && k.startsWith(n + path.sep));
      if (children.length > 0 && !recursive) {
        const err: NodeJS.ErrnoException = new Error(`ENOTEMPTY: directory not empty, rmdir '${p}'`);
        err.code = 'ENOTEMPTY';
        throw err;
      }
      // remove all children
      this.files.forEach((_, key) => {
        if (key.startsWith(n + path.sep)) this.files.delete(key);
      });
      Array.from(this.dirs).forEach((d) => {
        if (d.startsWith(n + path.sep) || d === n) this.dirs.delete(d);
      });
      return;
    }
    const err: NodeJS.ErrnoException = new Error(`ENOENT: no such file or directory, rm '${p}'`);
    err.code = 'ENOENT';
    throw err;
  }

  chmodSync(p: string, mode: number): void {
    const n = this.normalize(p);
    if (!this.files.has(n) && !this.dirs.has(n)) {
      const err: NodeJS.ErrnoException = new Error(`ENOENT: no such file or directory, chmod '${p}'`);
      err.code = 'ENOENT';
      throw err;
    }
    // no-op for in-memory
  }

  readdirSync(p: string): string[] {
    const n = this.normalize(p);
    if (!this.dirs.has(n)) {
      const err: NodeJS.ErrnoException = new Error(`ENOENT: no such directory, scandir '${p}'`);
      err.code = 'ENOENT';
      throw err;
    }
    const entries = new Set<string>();
    this.dirs.forEach((d) => {
      if (d === n) return;
      if (d.startsWith(n + path.sep)) {
        const rest = d.slice(n.length + 1);
        const first = rest.split(path.sep)[0];
        entries.add(first);
      }
    });
    this.files.forEach((_, f) => {
      if (f === n) return;
      if (f.startsWith(n + path.sep)) {
        const rest = f.slice(n.length + 1);
        const first = rest.split(path.sep)[0];
        entries.add(first);
      }
    });
    return Array.from(entries);
  }
}

export function setupFakeFs(): () => void {
  const original = getFileSystem();
  const fake = new InMemoryFileSystem();
  // ensure root and /tmp exist for tests that use /tmp as base
  fake.mkdirSync('/', { recursive: true } as any);
  fake.mkdirSync('/tmp', { recursive: true } as any);
  setFileSystem(fake as unknown as fsTypes.IFileSystem);

  return () => setFileSystem(original);
}
