import type { ScanResult, SessionCost, UsageEvent } from "@/lib/types";

let counter = 0;

/** Requête minimale, au coût choisi : les tests d'agrégation n'ont pas besoin de tarifs réels. */
export function makeEvent(
  overrides: Partial<UsageEvent> & { time: number; costTotal?: number },
): UsageEvent {
  counter += 1;
  const { costTotal = 1, ...rest } = overrides;
  return {
    uuid: `uuid-${counter}`,
    requestKey: `msg-${counter}`,
    timestamp: new Date(overrides.time).toISOString(),
    model: "claude-sonnet-4-5",
    inputTokens: 0,
    outputTokens: 0,
    cacheReadTokens: 0,
    cacheWrite5mTokens: 0,
    cacheWrite1hTokens: 0,
    thinkingTokens: 0,
    webSearchRequests: 0,
    webFetchRequests: 0,
    speed: "standard",
    serviceTier: "standard",
    effort: null,
    sessionId: "session-1",
    projectId: "-Users-me-proj",
    projectName: "proj",
    projectPath: "/Users/me/proj",
    gitBranch: null,
    isSidechain: false,
    cost: { input: 0, output: costTotal, cacheRead: 0, cacheWrite: 0, total: costTotal, estimated: false },
    ...rest,
  };
}

export function makeScan(events: UsageEvent[], sessionCosts: SessionCost[] = []): ScanResult {
  return {
    events: [...events].sort((a, b) => a.time - b.time),
    prompts: [],
    sessionCosts,
    fileCount: 1,
    byteCount: 0,
    skippedLines: 0,
    scannedAt: Date.now(),
    root: "/tmp",
  };
}

export function makeSessionCost(sessionId: string, totalCostUSD: number): SessionCost {
  return {
    sessionId,
    projectId: "-Users-me-proj",
    totalCostUSD,
    byModel: {},
    apiDurationMs: 0,
    linesAdded: 0,
    linesRemoved: 0,
    hasUnknownModelCost: false,
  };
}
