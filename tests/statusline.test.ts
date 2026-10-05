import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

const STATUSLINE = path.resolve(import.meta.dirname, "../scripts/statusline.mjs");
// Compilé par `pretest` (scripts/build-cli.mjs) avant la suite.
const CLI = path.resolve(import.meta.dirname, "../dist/tempo.mjs");

let dir: string;

beforeEach(async () => {
  dir = await mkdtemp(path.join(tmpdir(), "tempo-statusline-"));
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

function run(
  script: string,
  input: string,
  args: string[] = [],
  lang = "fr",
  env: Record<string, string> = {},
) {
  const result = spawnSync("node", [script, ...args], {
    input,
    encoding: "utf8",
    env: {
      ...process.env,
      TEMPO_LANG: lang,
      TEMPO_LIMITS_PATH: path.join(dir, "rate-limits.json"),
      CLAUDE_SETTINGS_PATH: path.join(dir, "settings.json"),
      TEMPO_ALERT_DRY_RUN: "1",
      ...env,
    },
  });
  return {
    status: result.status,
    stdout: result.stdout.replace(/\x1b\[[0-9;]*m/g, ""),
    stderr: result.stderr,
  };
}

function limitsInput(session: number, week: number, resetIn = 7_200) {
  const now = Math.floor(Date.now() / 1000);
  return JSON.stringify({
    model: { display_name: "Opus 5.5" },
    effort: { level: "high" },
    context_window: { used_percentage: 52 },
    rate_limits: {
      five_hour: { used_percentage: session, resets_at: now + resetIn },
      seven_day: { used_percentage: week, resets_at: now + 300_000 },
    },
  });
}

async function historyLines() {
  try {
    return (await readFile(path.join(dir, "rate-limits-history.jsonl"), "utf8"))
      .split("\n")
      .filter(Boolean);
  } catch {
    return [];
  }
}

describe("statusline", () => {
  it("renders the model, effort, context and limit gauges", () => {
    const { stdout, status } = run(STATUSLINE, limitsInput(6, 35));
    expect(status).toBe(0);
    expect(stdout).toContain("Opus 5.5 ◑ high");
    expect(stdout).not.toContain("✻");
    expect(stdout).toMatch(/ctx ▰{4}▱{4} 52 %/);
    // Une heure pour la session, une durée pour la semaine : la préposition
    // évite de confondre les deux.
    expect(stdout).toMatch(/5h ▰▱{7} 6 % ↻ à \d+h(\d{2})?/);
    expect(stdout).toMatch(/7j ▰{3}▱{5} 35 % ↻ dans 3j\d+h\d+m/);
  });

  it("follows the requested language", () => {
    const { stdout } = run(STATUSLINE, limitsInput(6, 35), [], "en");
    expect(stdout).toMatch(/5h ▰▱{7} 6% ↻ at \d+:\d{2}/);
    expect(stdout).toMatch(/7d ▰{3}▱{5} 35% ↻ in 3d\d+h\d+m/);
  });

  it("never fails on unreadable input", () => {
    const { status } = run(STATUSLINE, "pas du json");
    expect(status).toBe(0);
  });

  it("appends to the history only when something changed", async () => {
    run(STATUSLINE, limitsInput(10, 20));
    run(STATUSLINE, limitsInput(10, 20));
    run(STATUSLINE, limitsInput(11, 20));
    expect(await historyLines()).toHaveLength(2);

    // Sans `rate_limits`, le relevé précédent reste en place.
    run(STATUSLINE, JSON.stringify({ model: { display_name: "Opus 5.5" } }));
    const latest = JSON.parse(await readFile(path.join(dir, "rate-limits.json"), "utf8"));
    expect(latest.rate_limits.five_hour.used_percentage).toBe(11);
  });

  it("alerts once per threshold crossed, and again in a new window", () => {
    expect(run(STATUSLINE, limitsInput(79, 20)).stderr).toBe("");
    expect(run(STATUSLINE, limitsInput(81, 20)).stderr).toContain("session à 81 %");
    expect(run(STATUSLINE, limitsInput(85, 20)).stderr).toBe("");
    // Deux seuils franchis d'un coup : une seule notification, pour le plus haut.
    const crossedTwo = run(STATUSLINE, limitsInput(70, 96));
    expect(crossedTwo.stderr.match(/\[alerte\]/g)).toHaveLength(1);
    expect(crossedTwo.stderr).toContain("semaine à 96 %");
    // Nouvelle fenêtre de session : le seuil peut de nouveau être notifié.
    expect(run(STATUSLINE, limitsInput(82, 96, 20_000)).stderr).toContain("session à 82 %");
  });
});

describe("statusline pace", () => {
  it("shows when the session will hit its limit before the reset", async () => {
    const now = Math.floor(Date.now() / 1000);
    const reset = now + 3 * 3600;
    const sample = (minutesAgo: number, used: number) =>
      JSON.stringify({
        capturedAt: new Date((now - minutesAgo * 60) * 1000).toISOString(),
        rate_limits: { five_hour: { used_percentage: used, resets_at: reset } },
      });
    await writeFile(
      path.join(dir, "rate-limits-history.jsonl"),
      `${[sample(100, 10), sample(70, 20), sample(40, 30)].join("\n")}\n`,
    );
    const input = (used: number) =>
      JSON.stringify({ rate_limits: { five_hour: { used_percentage: used, resets_at: reset } } });

    // 25 points en 70 min : les 55 restants arrivent avant la réinitialisation.
    expect(run(STATUSLINE, input(45)).stdout).toMatch(/· limite ~\d+h/);
    // 11 points en 70 min : la limite tombe après la réinitialisation.
    expect(run(STATUSLINE, input(31)).stdout).not.toContain("limite");
  });
});

describe("tempo setup", () => {
  const settingsPath = () => path.join(dir, "settings.json");
  const settings = async () => JSON.parse(await readFile(settingsPath(), "utf8"));

  it("installs next to the existing settings", async () => {
    await writeFile(settingsPath(), JSON.stringify({ theme: "dark" }));
    expect(run(CLI, "", ["setup"]).status).toBe(0);
    const result = await settings();
    expect(result.theme).toBe("dark");
    expect(result.statusLine.command).toContain("statusline.mjs");
  });

  it("adds the session hook next to other tools' hooks, once", async () => {
    const other = { hooks: [{ type: "command", command: "echo other-tool" }] };
    await writeFile(settingsPath(), JSON.stringify({ hooks: { SessionEnd: [other] } }));
    run(CLI, "", ["setup"]);
    run(CLI, "", ["setup"]);

    const sessionEnd = (await settings()).hooks.SessionEnd;
    expect(sessionEnd).toHaveLength(2);
    expect(sessionEnd[0]).toEqual(other);
    expect(sessionEnd[1].hooks[0].command).toMatch(/tempo\.mjs" session-end$/);

    run(CLI, "", ["setup", "--remove"]);
    expect((await settings()).hooks.SessionEnd).toEqual([other]);
  });

  it("refuses to replace another statusline without --force, then restores it on --remove", async () => {
    const other = { type: "command", command: "echo hi" };
    await writeFile(settingsPath(), JSON.stringify({ statusLine: other }));

    expect(run(CLI, "", ["setup"]).status).toBe(1);
    expect((await settings()).statusLine).toEqual(other);

    expect(run(CLI, "", ["setup", "--force"]).status).toBe(0);
    expect((await settings()).statusLine.command).toContain("statusline.mjs");

    expect(run(CLI, "", ["setup", "--remove"]).status).toBe(0);
    expect((await settings()).statusLine).toEqual(other);
  });
});
