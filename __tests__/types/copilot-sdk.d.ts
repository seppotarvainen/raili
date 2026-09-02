import type { AssistantMessageEvent, CopilotSession, SessionConfig } from '@github/copilot-sdk';

declare module '@github/copilot-sdk' {
  export const mockSession: {
    sendAndWait: jest.Mock<Promise<AssistantMessageEvent | undefined>, [{ prompt: string }]>;
    abort: jest.Mock<Promise<void>, []>;
    disconnect: jest.Mock<Promise<void>, []>;
    rpc: {
      usage: {
        getMetrics: jest.Mock;
      };
    };
  };
  export const mockClient: {
    createSession: jest.Mock<Promise<CopilotSession>, [SessionConfig]>;
    stop: jest.Mock<Promise<Error[]>, []>;
  };
  export function resetCopilotSdkMock(): void;
}
