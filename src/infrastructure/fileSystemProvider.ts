import { IFileSystem, NodeFileSystem } from './fileSystem';

let currentFs: IFileSystem = new NodeFileSystem();

export function getFileSystem(): IFileSystem {
  return currentFs;
}

export function setFileSystem(fs: IFileSystem): void {
  currentFs = fs;
}

;
