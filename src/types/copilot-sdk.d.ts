import type { AssistantMessageEvent, CopilotSession, SessionConfig } from '@github/copilot-sdk';

declare module '@github/copilot-sdk' {
  // Minimal test-time helpers exposed by our manual mock. Keep types lightweight to avoid
  // importing internal SDK shapes in production code paths.
  export const mockSession: {
    sendAndWait: jest.Mock<Promise<AssistantMessageEvent | undefined>, [any]>;
    send: jest.Mock<Promise<void>, [any]>;
    abort: jest.Mock<Promise<void>, []>;
    disconnect: jest.Mock<Promise<void>, []>;
    rpc: {
      usage: {
        getMetrics: jest.Mock<any, any>;
      };
    };
  };
  export const mockClient: {
    createSession: jest.Mock<Promise<CopilotSession>, [SessionConfig]>;
    stop: jest.Mock<Promise<Error[]>, []>;
  };
  export function resetCopilotSdkMock(): void;
}

export {};
