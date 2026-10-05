import { appendFile, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { computeCost } from "@/lib/pricing";

const MODEL = "claude-sonnet-4-5";
const USAGE = { input_tokens: 100, output_tokens: 50, cache_read_input_tokens: 1_000 };

function assistant(uuid: string, messageId: string, timestamp: string, sessionId = "s1") {
  return JSON.stringify({
    type: "assistant",
    uuid,
    timestamp,
    sessionId,
    cwd: "/Users/me/proj",
    message: { id: messageId, model: MODEL, usage: USAGE },
  });
}

function user(uuid: string, timestamp: string, extra: Record<string, unknown> = {}) {
  return JSON.stringify({ type: "user", uuid, timestamp, sessionId: "s1", ...extra });
}

let root: string;
let projectDir: string;
let scanUsage: typeof import("@/lib/scan").scanUsage;

beforeAll(async () => {
  root = await mkdtemp(path.join(tmpdir(), "tempo-scan-"));
  projectDir = path.join(root, "-Users-me-proj");
  await mkdir(projectDir);
  // Le module lit sa racine au chargement : on la fixe avant de l'importer.
  process.env.CLAUDE_PROJECTS_PATH = root;
  vi.resetModules();
  ({ scanUsage } = await import("@/lib/scan"));
});

afterAll(async () => {
  await rm(root, { recursive: true, force: true });
});

describe("scanUsage", () => {
  it("bills a reply split over several lines only once", async () => {
    await writeFile(
      path.join(projectDir, "a.jsonl"),
      [
        user("u1", "2026-10-01T10:00:00.000Z"),
        // Un message injecté par l'outil n'est pas un prompt humain.
        user("u2", "2026-10-01T10:00:01.000Z", { isMeta: true }),
        // Deux lignes, un seul message API : même `usage` répété.
        assistant("a1", "msg_1", "2026-10-01T10:00:05.000Z"),
        assistant("a2", "msg_1", "2026-10-01T10:00:05.000Z"),
        assistant("a3", "msg_2", "2026-10-01T10:01:00.000Z"),
        // Les messages générés localement ne sont pas facturés.
        JSON.stringify({
          type: "assistant",
          uuid: "a4",
          timestamp: "2026-10-01T10:02:00.000Z",
          sessionId: "s1",
          message: { id: "msg_3", model: "<synthetic>", usage: USAGE },
        }),
        JSON.stringify({ type: "cost-state", sessionId: "s1", totalCostUSD: 0.5 }),
        "pas du json",
      ]
        .map((line) => `${line}\n`)
        .join(""),
    );

    const scan = await scanUsage();
    expect(scan.events.map((event) => event.requestKey)).toEqual(["msg_1", "msg_2"]);
    expect(scan.prompts.map((prompt) => prompt.uuid)).toEqual(["u1"]);
    expect(scan.skippedLines).toBe(1);
    expect(scan.events[0].projectName).toBe("proj");
    expect(scan.events[0].cost.total).toBeCloseTo(
      computeCost(
        MODEL,
        {
          inputTokens: 100,
          outputTokens: 50,
          cacheReadTokens: 1_000,
          cacheWrite5mTokens: 0,
          cacheWrite1hTokens: 0,
        },
        "standard",
      ).total,
    );
    expect(scan.sessionCosts).toHaveLength(1);
    expect(scan.sessionCosts[0].totalCostUSD).toBe(0.5);
  });

  it("does not bill again a message rewritten by a resumed session", async () => {
    await writeFile(
      path.join(projectDir, "b.jsonl"),
      `${assistant("b1", "msg_1", "2026-10-01T10:00:05.000Z")}\n${assistant(
        "b2",
        "msg_4",
        "2026-10-01T11:00:00.000Z",
      )}\n`,
    );

    const scan = await scanUsage();
    expect(scan.events.map((event) => event.requestKey)).toEqual(["msg_1", "msg_2", "msg_4"]);
  });

  it("reads appended lines, but never a line still being written", async () => {
    const file = path.join(projectDir, "b.jsonl");
    const line = assistant("b3", "msg_5", "2026-10-01T12:00:00.000Z");

    await appendFile(file, line.slice(0, 40));
    let scan = await scanUsage();
    expect(scan.events).toHaveLength(3);
    expect(scan.skippedLines).toBe(1);

    await appendFile(file, `${line.slice(40)}\n`);
    scan = await scanUsage();
    expect(scan.events.map((event) => event.requestKey)).toContain("msg_5");
    expect(scan.skippedLines).toBe(1);
  });
});
