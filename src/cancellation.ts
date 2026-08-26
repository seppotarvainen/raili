import { CancellationController } from './types';

export function createCancellationController(): CancellationController {
  let cancellationRequested = false;
  const listeners = new Set<() => void>();

  return {
    get isCancellationRequested(): boolean {
      return cancellationRequested;
    },
    onCancellationRequested(listener: () => void): () => void {
      if (cancellationRequested) {
        listener();
        return () => undefined;
      }
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    requestCancellation(): void {
      if (cancellationRequested) return;
      cancellationRequested = true;
      for (const listener of [...listeners]) {
        listener();
      }
    },
  };
}
