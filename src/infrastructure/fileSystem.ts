import * as fs from 'fs';

export interface IFileSystem {
  existsSync(path: string): boolean;
  statSync(path: string): fs.Stats;
  readFileSync(path: string, enc?: string): string;
  writeFileSync(path: string, data: string | Buffer, enc?: string): void;
  appendFileSync(path: string, data: string | Buffer, enc?: string): void;
  mkdirSync(path: string, opts?: fs.MakeDirectoryOptions | number): void;
  unlinkSync(path: string): void;
  rmSync(path: string, opts?: fs.RmOptions): void;
  chmodSync(path: string, mode: number): void;
  readdirSync(path: string): string[];
}

export class NodeFileSystem implements IFileSystem {
  existsSync(path: string): boolean {
    return fs.existsSync(path);
  }

  statSync(path: string): fs.Stats {
    return fs.statSync(path);
  }

  readFileSync(path: string, enc: string = 'utf8'): string {
    return fs.readFileSync(path, enc as any) as unknown as string;
  }

  writeFileSync(path: string, data: string | Buffer, enc?: string): void {
    if (enc) {
      fs.writeFileSync(path, data, enc as any);
    } else {
      fs.writeFileSync(path, data as any);
    }
  }

  appendFileSync(path: string, data: string | Buffer, enc?: string): void {
    if (enc) {
      fs.appendFileSync(path, data, enc as any);
    } else {
      fs.appendFileSync(path, data as any);
    }
  }

  mkdirSync(path: string, opts?: fs.MakeDirectoryOptions | number): void {
    if (opts !== undefined) {
      // @ts-ignore Allow passing number for mode
      fs.mkdirSync(path, opts as any);
    } else {
      fs.mkdirSync(path);
    }
  }

  unlinkSync(path: string): void {
    fs.unlinkSync(path);
  }

  rmSync(path: string, opts?: fs.RmOptions): void {
    if ((fs as any).rmSync) {
      (fs as any).rmSync(path, opts as any);
    } else {
      // fallback for older Node versions
      fs.rmdirSync(path as any, opts as any);
    }
  }

  chmodSync(path: string, mode: number): void {
    fs.chmodSync(path, mode);
  }

  readdirSync(path: string): string[] {
    return fs.readdirSync(path);
  }
}
