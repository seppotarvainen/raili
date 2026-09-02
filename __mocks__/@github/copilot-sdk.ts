import type {
  AssistantMessageEvent,
  CopilotSession,
  SessionConfig,
} from '@github/copilot-sdk';

export const mockSession = {
  sendAndWait: jest.fn<Promise<AssistantMessageEvent | undefined>, [{ prompt: string }]>(),
  send: jest.fn<Promise<string>, [{ prompt: string }]>(),
  on: jest.fn<() => void, [(event: AssistantMessageEvent | { type: 'session.idle' }) => void]>(),
  abort: jest.fn<Promise<void>, []>(),
  disconnect: jest.fn<Promise<void>, []>(),
  rpc: {
    usage: {
      getMetrics: jest.fn(),
    },
  },
};

export const mockClient = {
  createSession: jest.fn<Promise<CopilotSession>, [SessionConfig]>(),
  stop: jest.fn<Promise<Error[]>, []>(),
};

export const CopilotClient = jest.fn().mockImplementation(() => mockClient);

export const approveAll = jest.fn();

export function resetCopilotSdkMock(): void {
  mockSession.sendAndWait.mockReset();
  mockSession.send.mockReset();
  mockSession.on.mockReset();
  mockSession.abort.mockReset();
  mockSession.disconnect.mockReset();
  mockSession.rpc.usage.getMetrics.mockReset();
  mockClient.createSession.mockReset();
  mockClient.stop.mockReset();
  CopilotClient.mockClear();
  approveAll.mockReset();

  mockSession.sendAndWait.mockResolvedValue({
    type: 'assistant.message',
    id: 'mock-event',
    parentId: null,
    timestamp: new Date(0).toISOString(),
    data: { content: 'agent output', messageId: 'mock-message' },
  } as AssistantMessageEvent);
  mockSession.abort.mockResolvedValue();
  mockSession.disconnect.mockResolvedValue();
  mockSession.rpc.usage.getMetrics.mockResolvedValue({
    totalPremiumRequestCost: 0,
    totalUserRequests: 1,
    totalApiDurationMs: 1500,
    sessionStartTime: new Date(0).toISOString(),
    codeChanges: { linesAdded: 0, linesRemoved: 0, filesModifiedCount: 0, filesModified: [] },
    modelMetrics: {},
    totalNanoAiu: 2000000000,
    lastCallInputTokens: 12,
    lastCallOutputTokens: 7,
  });
  mockSession.on.mockImplementation((handler) => {
    mockSession.send.mockImplementationOnce(async (options) => {
      const response = await mockSession.sendAndWait(options);
      if (response) handler(response);
      handler({ type: 'session.idle' });
      return response?.data.messageId ?? 'mock-message';
    });
    return jest.fn();
  });
  mockClient.createSession.mockResolvedValue(mockSession as unknown as CopilotSession);
  mockClient.stop.mockResolvedValue([]);
  approveAll.mockReturnValue({ kind: 'approve-once' });
}

resetCopilotSdkMock();
