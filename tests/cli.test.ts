import { spawnSync } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

// Compilé par `pretest` (scripts/build-cli.mjs) avant la suite.
const CLI = path.resolve(import.meta.dirname, "../dist/tempo.mjs");

let dir: string;

function assistant(id: string, minutesAgo: number) {
  return JSON.stringify({
    type: "assistant",
    uuid: `u-${id}`,
    timestamp: new Date(Date.now() - minutesAgo * 60_000).toISOString(),
    sessionId: "s1",
    cwd: "/Users/me/proj",
    gitBranch: "feat/x",
    message: {
      id,
      model: "claude-sonnet-4-5",
      usage: { input_tokens: 1000, output_tokens: 500, cache_read_input_tokens: 20_000 },
    },
  });
}

beforeAll(async () => {
  dir = await mkdtemp(path.join(tmpdir(), "tempo-cli-"));
  const project = path.join(dir, "projects", "-Users-me-proj");
  await mkdir(project, { recursive: true });
  await writeFile(path.join(project, "s1.jsonl"), `${assistant("m1", 30)}\n${assistant("m2", 10)}\n`);
});

afterAll(async () => {
  await rm(dir, { recursive: true, force: true });
});

function run(args: string[], input = "") {
  const result = spawnSync("node", [CLI, ...args], {
    input,
    encoding: "utf8",
    cwd: dir,
    env: {
      ...process.env,
      CLAUDE_PROJECTS_PATH: path.join(dir, "projects"),
      CLAUDE_CONFIG_PATH: path.join(dir, "missing.json"),
      CLAUDE_SETTINGS_PATH: path.join(dir, "settings.json"),
      TEMPO_LIMITS_PATH: path.join(dir, "tempo", "rate-limits.json"),
      TEMPO_LANG: "en",
      NO_COLOR: "1",
      TEMPO_SUMMARY_TO_STDOUT: "1",
    },
  });
  return { status: result.status, stdout: result.stdout, stderr: result.stderr };
}

describe("tempo session-end", () => {
  it("prints one summary line when the session closes", () => {
    const { stdout, status } = run(
      ["session-end"],
      JSON.stringify({ session_id: "s1", reason: "prompt_input_exit" }),
    );
    expect(status).toBe(0);
    expect(stdout).toMatch(/^tempo · 20 min · \$\d+\.\d{2} · 2 req · feat\/x\n$/);
  });

  it("stays silent on /clear, while the interface is still on screen", () => {
    const { stdout } = run(["session-end"], JSON.stringify({ session_id: "s1", reason: "clear" }));
    expect(stdout).toBe("");
  });
});

describe("tempo status", () => {
  it("summarizes cost and says how to get limits", () => {
    const { stdout, status } = run(["status"]);
    expect(status).toBe(0);
    expect(stdout).toContain("No limits reading");
    expect(stdout).toMatch(/24 hours\s+\$\d+\.\d{2}\s+2 req/);
    expect(stdout).toMatch(/7 days\s+\$\d+\.\d{2}/);
  });
});

describe("tempo doctor", () => {
  it("lists each check and fails when something is missing", () => {
    const { stdout, status } = run(["doctor"]);
    expect(status).toBe(1);
    expect(stdout).toContain("1 transcripts in");
    expect(stdout).toMatch(/missing\s+Statusline not installed: tempo setup/);
  });
});

describe("tempo help", () => {
  it("rejects an unknown command", () => {
    const { status, stderr } = run(["nope"]);
    expect(status).toBe(1);
    expect(stderr).toContain("Unknown command: nope");
  });
});
